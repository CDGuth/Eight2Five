import {
  DRILL_SCHEMA_URL,
  DRILL_SCHEMA_VERSION,
  formatSetName,
  getGridReference,
  parseDrillDocument,
  type DrillDocument,
  type FieldDefinition,
  type DrillEntity,
  type DrillPosition,
  type DrillSet,
  type MeasureRange,
} from "@eight2five/drill-schema";

import type {
  CoordinateSheetImportOptions,
  CoordinateSheetImportResult,
  ExtractedPdfPage,
  ExtractedPdfTextItem,
  ImportDiagnostic,
  ParsedCoordinateRow,
  ParsedCoordinateSheet,
  ParsedSetIdentity,
} from "./types";

const IMPORTER_NAME = "@eight2five/drill-importers/coordinate-sheet";
const IMPORTER_VERSION = "1";
const DEFAULT_FIELD: FieldDefinition = {
  type: "preset",
  preset: "football-nfhs",
};
const LINE_Y_TOLERANCE = 2.5;
const SHEET_ANCHOR_DEDUPLICATION = 24;
const HEADER_FIELD_PATTERN =
  /Performer:\s*(.*?)\s+Symbol:\s*(.*?)\s+Label:\s*(.*?)\s+ID:\s*([0-9]+)/i;

interface TextLine {
  readonly y: number;
  readonly items: readonly ExtractedPdfTextItem[];
  readonly text: string;
}

type ColumnKey = "set" | "title" | "measure" | "counts" | "side" | "frontBack";

interface ColumnAnchor {
  readonly key: ColumnKey;
  readonly x: number;
}

interface SheetSlice {
  readonly pageNumber: number;
  readonly sheetIndex: number;
  readonly items: readonly ExtractedPdfTextItem[];
}

interface ParsedSheetResult {
  readonly sheet?: ParsedCoordinateSheet;
  readonly diagnostics: readonly ImportDiagnostic[];
}

/**
 * Parse position-aware PDF text extracted from Pyware-style coordinate sheets
 * into the portable Eight2Five drill document. The importer is intentionally
 * independent of PDF.js; browser and native extraction layers only need to
 * supply the generic item geometry in ExtractedPdfPage.
 */
export function importCoordinateSheetPages(
  pages: readonly ExtractedPdfPage[],
  options: CoordinateSheetImportOptions,
): CoordinateSheetImportResult {
  const diagnostics: ImportDiagnostic[] = [];
  const sheets: ParsedCoordinateSheet[] = [];
  const field = options.field ?? DEFAULT_FIELD;

  for (const page of pages) {
    for (const slice of splitPageIntoSheets(page)) {
      const parsed = parseCoordinateSheetSlice(slice, field);
      diagnostics.push(...parsed.diagnostics);
      if (parsed.sheet) sheets.push(parsed.sheet);
    }
  }

  if (sheets.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "NO_COORDINATE_SHEETS",
      message: "No coordinate-sheet tables were found in the PDF text.",
    });
    return { sheets, diagnostics };
  }

  const document = buildDrillDocument(sheets, options, diagnostics);
  if (!document || diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { sheets, diagnostics };
  }

  try {
    return {
      sheets,
      diagnostics,
      document: parseDrillDocument(document),
    };
  } catch (cause) {
    diagnostics.push({
      severity: "error",
      code: "PORTABLE_SCHEMA_VALIDATION_FAILED",
      message:
        cause instanceof Error
          ? `Parsed coordinate sheets did not satisfy the portable drill schema: ${cause.message}`
          : "Parsed coordinate sheets did not satisfy the portable drill schema.",
    });
    return { sheets, diagnostics };
  }
}

export function parseCoordinateSheetPage(
  page: ExtractedPdfPage,
  field: FieldDefinition = DEFAULT_FIELD,
): readonly ParsedSheetResult[] {
  return splitPageIntoSheets(page).map((slice) =>
    parseCoordinateSheetSlice(slice, field),
  );
}

function splitPageIntoSheets(page: ExtractedPdfPage): readonly SheetSlice[] {
  const usefulItems = page.items.filter((item) => item.text.trim().length > 0);
  if (usefulItems.length === 0) return [];

  let anchors = distinctSortedX(
    usefulItems
      .filter((item) => /\bPerformer\s*:/i.test(item.text))
      .map((item) => item.x),
  );
  if (anchors.length < 2) {
    anchors = distinctSortedX(
      usefulItems
        .filter((item) => /^\s*Set(?:\s|$)/i.test(item.text))
        .map((item) => item.x),
    );
  }
  if (anchors.length === 0) anchors = [Math.min(...usefulItems.map((item) => item.x))];

  // Sheet anchors are left-edge origins, not centers. A two-up sheet can use
  // most of the horizontal distance before the next origin, so midpoint
  // partitioning would incorrectly steal the right-side coordinate columns.
  return anchors
    .map((anchor, sheetIndex) => {
      const minX = sheetIndex === 0 ? Number.NEGATIVE_INFINITY : anchor - 0.5;
      const maxX =
        sheetIndex === anchors.length - 1
          ? Number.POSITIVE_INFINITY
          : anchors[sheetIndex + 1] - 0.5;
      return {
        pageNumber: page.pageNumber,
        sheetIndex,
        items: usefulItems.filter((item) => item.x >= minX && item.x < maxX),
      } satisfies SheetSlice;
    })
    .filter((slice) => slice.items.length > 0);
}

function distinctSortedX(values: readonly number[]): number[] {
  const sorted = [...values].sort((left, right) => left - right);
  const distinct: number[] = [];
  for (const value of sorted) {
    const previous = distinct.at(-1);
    if (previous === undefined || Math.abs(value - previous) > SHEET_ANCHOR_DEDUPLICATION) {
      distinct.push(value);
    }
  }
  return distinct;
}

function parseCoordinateSheetSlice(
  slice: SheetSlice,
  field: FieldDefinition,
): ParsedSheetResult {
  const diagnostics: ImportDiagnostic[] = [];
  const lines = groupTextLines(slice.items);
  const headerIndex = lines.findIndex(isTableHeaderLine);
  if (headerIndex < 0) {
    return {
      diagnostics: [
        {
          severity: "error",
          code: "TABLE_HEADER_NOT_FOUND",
          message: "Could not find a Set/Measure/Counts coordinate table header.",
          pageNumber: slice.pageNumber,
          sheetIndex: slice.sheetIndex,
        },
      ],
    };
  }

  const headerText = lines
    .slice(0, headerIndex)
    .map((line) => line.text)
    .join(" ");
  const metadata = parseHeaderMetadata(headerText);
  if (!metadata) {
    diagnostics.push({
      severity: "error",
      code: "PERFORMER_HEADER_NOT_FOUND",
      message: "Could not parse the Performer / Symbol / Label / ID header.",
      pageNumber: slice.pageNumber,
      sheetIndex: slice.sheetIndex,
    });
    return { diagnostics };
  }

  const anchors = deriveColumnAnchors(lines[headerIndex]);
  const rows: ParsedCoordinateRow[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (/\bPrinted\s*:/i.test(line.text) || /^Page\s+\d+/i.test(line.text)) continue;
    const parsed =
      anchors.length >= 5
        ? parsePositionedRow(line, anchors, field)
        : parseFlatRow(line.text, field);
    if (parsed === undefined) continue;
    if (typeof parsed === "string") {
      diagnostics.push({
        severity: "error",
        code: "ROW_PARSE_FAILED",
        message: parsed,
        pageNumber: slice.pageNumber,
        sheetIndex: slice.sheetIndex,
        rowText: line.text,
      });
      continue;
    }
    rows.push(parsed);
  }

  if (rows.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "NO_COORDINATE_ROWS",
      message: "The coordinate sheet header was found, but no set rows could be parsed.",
      pageNumber: slice.pageNumber,
      sheetIndex: slice.sheetIndex,
    });
    return { diagnostics };
  }

  return {
    diagnostics,
    sheet: {
      pageNumber: slice.pageNumber,
      sheetIndex: slice.sheetIndex,
      ...metadata,
      rows,
    },
  };
}

function groupTextLines(items: readonly ExtractedPdfTextItem[]): readonly TextLine[] {
  const sorted = [...items].sort((left, right) => {
    const yDifference = right.y - left.y;
    return Math.abs(yDifference) > LINE_Y_TOLERANCE ? yDifference : left.x - right.x;
  });
  const groups: { y: number; items: ExtractedPdfTextItem[] }[] = [];
  for (const item of sorted) {
    let group = groups.find((candidate) => Math.abs(candidate.y - item.y) <= LINE_Y_TOLERANCE);
    if (!group) {
      group = { y: item.y, items: [] };
      groups.push(group);
    }
    group.items.push(item);
    group.y =
      group.items.reduce((total, current) => total + current.y, 0) / group.items.length;
  }
  return groups
    .sort((left, right) => right.y - left.y)
    .map((group) => {
      const lineItems = [...group.items].sort((left, right) => left.x - right.x);
      return {
        y: group.y,
        items: lineItems,
        text: joinTextItems(lineItems),
      };
    });
}

function joinTextItems(items: readonly ExtractedPdfTextItem[]): string {
  return items
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTableHeaderLine(line: TextLine): boolean {
  const text = line.text.toLowerCase();
  return (
    /\bset\b/.test(text) &&
    /\bcounts?\b/.test(text) &&
    /\bside\b/.test(text) &&
    /\bfront\b/.test(text) &&
    /\bback\b/.test(text)
  );
}

function parseHeaderMetadata(text: string): Omit<ParsedCoordinateSheet, "pageNumber" | "sheetIndex" | "rows"> | undefined {
  const match = text.match(HEADER_FIELD_PATTERN);
  if (!match) return undefined;
  const performerName = cleanOptionalText(match[1]);
  const sourceSymbol = cleanOptionalText(match[2]) ?? "?";
  const sourceLabel = cleanOptionalText(match[3]);
  const sourceId = cleanOptionalText(match[4]);
  const displayLabel = composeDisplayLabel(sourceSymbol, sourceLabel, performerName);
  const tailStart = (match.index ?? 0) + match[0].length;
  const tail = cleanOptionalText(
    text
      .slice(tailStart)
      .replace(/\bPrinted\s*:.*$/i, "")
      .trim(),
  );
  return {
    ...(performerName && !/^\(unnamed\)$/i.test(performerName)
      ? { performerName }
      : {}),
    sourceSymbol,
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(sourceId ? { sourceId } : {}),
    displayLabel,
    ...(tail ? { showTitle: tail } : {}),
  };
}

function cleanOptionalText(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned : undefined;
}

function composeDisplayLabel(
  symbol: string,
  label: string | undefined,
  performerName: string | undefined,
): string {
  if (label) {
    if (symbol === "?") return label;
    return label.startsWith(symbol) ? label : `${symbol}${label}`;
  }
  if (performerName && /^[^\s]{1,8}\d{1,4}$/.test(performerName)) return performerName;
  return symbol;
}

function deriveColumnAnchors(header: TextLine): readonly ColumnAnchor[] {
  const candidates: ColumnAnchor[] = [];
  for (const item of header.items) {
    const text = item.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (/^set\b/.test(text)) candidates.push({ key: "set", x: item.x });
    else if (/^title\b/.test(text)) candidates.push({ key: "title", x: item.x });
    else if (/^measure\b/.test(text)) candidates.push({ key: "measure", x: item.x });
    else if (/^counts?\b/.test(text)) candidates.push({ key: "counts", x: item.x });
    else if (/^side\b/.test(text)) candidates.push({ key: "side", x: item.x });
    else if (/^front\b/.test(text)) candidates.push({ key: "frontBack", x: item.x });
  }
  const byKey = new Map<ColumnKey, ColumnAnchor>();
  for (const candidate of candidates.sort((left, right) => left.x - right.x)) {
    if (!byKey.has(candidate.key)) byKey.set(candidate.key, candidate);
  }
  return [...byKey.values()].sort((left, right) => left.x - right.x);
}

function parsePositionedRow(
  line: TextLine,
  anchors: readonly ColumnAnchor[],
  field: FieldDefinition,
): ParsedCoordinateRow | string | undefined {
  const columns = bucketLineByColumns(line, anchors);
  const setText = columns.get("set")?.trim() ?? "";
  if (!looksLikeSetToken(setText)) return undefined;
  const set = parseSetIdentity(setText);
  if (typeof set === "string") return set;

  const countsText = columns.get("counts")?.trim() ?? "";
  const counts = parseCounts(countsText);
  if (typeof counts === "string") return counts;

  const measureText = columns.get("measure")?.trim() ?? "";
  const measureRange = parseMeasureRange(measureText);
  if (typeof measureRange === "string") return measureRange;

  const sideText = columns.get("side")?.trim() ?? "";
  const frontBackText = columns.get("frontBack")?.trim() ?? "";
  const xSteps = parseSideToSide(sideText);
  if (typeof xSteps === "string") return xSteps;
  const ySteps = parseFrontBack(frontBackText, field);
  if (typeof ySteps === "string") return ySteps;

  return {
    set,
    countsFromPrevious: counts,
    ...(measureRange ? { measureRange } : {}),
    position: { xSteps, ySteps },
    rawText: line.text,
  };
}

function bucketLineByColumns(
  line: TextLine,
  anchors: readonly ColumnAnchor[],
): ReadonlyMap<ColumnKey, string> {
  const sorted = [...anchors].sort((left, right) => left.x - right.x);
  const buckets = new Map<ColumnKey, ExtractedPdfTextItem[]>();
  for (const item of line.items) {
    let index = 0;
    for (let anchorIndex = 0; anchorIndex < sorted.length - 1; anchorIndex += 1) {
      const boundary = (sorted[anchorIndex].x + sorted[anchorIndex + 1].x) / 2;
      if (item.x >= boundary) index = anchorIndex + 1;
      else break;
    }
    const key = sorted[index].key;
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }
  return new Map(
    [...buckets.entries()].map(([key, items]) => [key, joinTextItems(items)]),
  );
}

/** Fallback for extractors that provide a whole row as one text fragment. */
function parseFlatRow(
  text: string,
  field: FieldDefinition,
): ParsedCoordinateRow | string | undefined {
  const normalized = text.replace(/\s+/g, " ").trim();
  const setMatch = normalized.match(/^(\d+(?:[A-Z]|\.[0-9]+)?)\s+(.*)$/);
  if (!setMatch) return undefined;
  const set = parseSetIdentity(setMatch[1]);
  if (typeof set === "string") return set;

  const sideStart = setMatch[2].search(/(?:Side\s*[12]\s*:|On\s+(?:\d+\s*(?:yd\s*ln|yard\s*line)|50\b))/i);
  if (sideStart < 0) return `Could not find the side-to-side coordinate in row: ${normalized}`;
  const prefix = setMatch[2].slice(0, sideStart).trim();
  const coordinateTail = setMatch[2].slice(sideStart).trim();
  const frontStart = coordinateTail.search(
    /(?:\bOn\s+(?:Front|Back|Home|Visitor)|\b[0-9]+(?:\.[0-9]+)?\s*(?:steps?)?\s*(?:Behind|In\s+Front\s+Of)\s+(?:Front|Back|Home|Visitor))/i,
  );
  if (frontStart < 0) return `Could not find the front-to-back coordinate in row: ${normalized}`;
  const sideText = coordinateTail.slice(0, frontStart).trim();
  const frontBackText = coordinateTail.slice(frontStart).trim();

  const prefixTokens = prefix.split(" ").filter(Boolean);
  let countsIndex = -1;
  for (let index = prefixTokens.length - 1; index >= 0; index -= 1) {
    if (/^\d+$/.test(prefixTokens[index])) {
      countsIndex = index;
      break;
    }
  }
  if (countsIndex < 0) return `Could not find whole-number counts in row: ${normalized}`;
  const counts = parseCounts(prefixTokens[countsIndex]);
  if (typeof counts === "string") return counts;
  const beforeCounts = prefixTokens.slice(0, countsIndex);
  const measureToken = [...beforeCounts].reverse().find((token) => /^\d+(?:[-–]\d+)?$/.test(token));
  const measureRange = parseMeasureRange(measureToken ?? "");
  if (typeof measureRange === "string") return measureRange;
  const xSteps = parseSideToSide(sideText);
  if (typeof xSteps === "string") return xSteps;
  const ySteps = parseFrontBack(frontBackText, field);
  if (typeof ySteps === "string") return ySteps;
  return {
    set,
    countsFromPrevious: counts,
    ...(measureRange ? { measureRange } : {}),
    position: { xSteps, ySteps },
    rawText: normalized,
  };
}

function looksLikeSetToken(value: string): boolean {
  return /^\d+(?:[A-Z]|\.[0-9]+)?$/.test(value.trim());
}

export function parseSetIdentity(value: string): ParsedSetIdentity | string {
  const match = value.trim().match(/^(\d+)([A-Z]|\.[0-9]+)?$/);
  if (!match) return `Invalid set identifier "${value}".`;
  const number = Number(match[1]);
  if (!Number.isSafeInteger(number)) return `Set number "${match[1]}" is too large.`;
  const suffix = match[2];
  return suffix
    ? { number, suffix, kind: "subset" }
    : { number, kind: "set" };
}

function parseCounts(value: string): number | string {
  if (!/^\d+$/.test(value)) return `Counts must be a non-negative whole number; received "${value}".`;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : `Counts value "${value}" is too large.`;
}

export function parseMeasureRange(value: string): MeasureRange | undefined | string {
  const normalized = value.trim();
  if (!normalized || normalized === "-" || normalized === "—") return undefined;
  const match = normalized.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!match) return `Invalid measure value "${value}".`;
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    return `Measure value "${value}" is too large.`;
  }
  if (end < start) return `Measure range "${value}" ends before it starts.`;
  return { start, end };
}

export function parseSideToSide(value: string): number | string {
  const normalized = normalizeCoordinateText(value);
  const goalLine = /\bgoal\s*line\b/i.test(normalized);
  const yardMatch = normalized.match(
    /\b(?:on|inside|outside)\s+(50|45|40|35|30|25|20|15|10|5|0)(?:\s*(?:yd\s*ln|yard\s*line))?\b/i,
  );
  const yardLine = goalLine ? 0 : yardMatch ? Number(yardMatch[1]) : undefined;
  if (yardLine === undefined) return `Could not parse yard-line reference "${value}".`;

  const sideMatch = normalized.match(/\bside\s*([12])\s*:/i);
  const side = sideMatch ? Number(sideMatch[1]) : undefined;
  const baseMagnitude = ((50 - yardLine) / 5) * 8;
  if (/\bon\b/i.test(normalized) && !/\b(?:inside|outside)\b/i.test(normalized)) {
    if (yardLine === 50) return 0;
    if (side !== 1 && side !== 2) {
      return `Yard line ${yardLine} requires Side 1 or Side 2 in "${value}".`;
    }
    return side === 1 ? -baseMagnitude : baseMagnitude;
  }

  const offsetMatch = normalized.match(
    /([0-9]+(?:\.[0-9]+)?)\s*(?:steps?)?\s*(inside|outside)\b/i,
  );
  if (!offsetMatch || (side !== 1 && side !== 2)) {
    return `Could not parse side-to-side coordinate "${value}".`;
  }
  const offset = Number(offsetMatch[1]);
  const relation = offsetMatch[2].toLowerCase();
  const base = side === 1 ? -baseMagnitude : baseMagnitude;
  const towardCenter = relation === "inside";
  return side === 1
    ? base + (towardCenter ? offset : -offset)
    : base + (towardCenter ? -offset : offset);
}

export function parseFrontBack(
  value: string,
  field: FieldDefinition = DEFAULT_FIELD,
): number | string {
  const normalized = normalizeCoordinateText(value);
  const reference = parseFrontBackReference(normalized, field);
  if (!reference) return `Could not parse front/back reference "${value}".`;
  const base = reference.ySteps;
  if (/^\s*on\b/i.test(normalized)) return base;
  const movement = normalized.match(
    /^\s*([0-9]+(?:\.[0-9]+)?)\s*(?:steps?)?\s*(behind|in\s+front\s+of)\b/i,
  );
  if (!movement) return `Could not parse front-to-back coordinate "${value}".`;
  const offset = Number(movement[1]);
  return /^behind$/i.test(movement[2]) ? base + offset : base - offset;
}

function normalizeCoordinateText(value: string): string {
  return value
    .replace(/\(\s*HS\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFrontBackReference(
  value: string,
  field: FieldDefinition,
): { readonly name: string; readonly ySteps: number } | undefined {
  const references = [
    {
      pattern: /\b(?:front|home)\s+(?:side\s*line|sideline)\b/i,
      id: "front-sideline",
    },
    { pattern: /\bfront\s+hash\b/i, id: "front-hash" },
    { pattern: /\bback\s+hash\b/i, id: "back-hash" },
    {
      pattern: /\b(?:back|visitor)\s+(?:side\s*line|sideline)\b/i,
      id: "back-sideline",
    },
  ] as const;
  const matched = references.find((reference) => reference.pattern.test(value));
  if (!matched) return undefined;
  const gridReference = getGridReference(field, matched.id);
  return gridReference
    ? { name: matched.id, ySteps: gridReference.coordinateSteps }
    : undefined;
}

function buildDrillDocument(
  sheets: readonly ParsedCoordinateSheet[],
  options: CoordinateSheetImportOptions,
  diagnostics: ImportDiagnostic[],
): DrillDocument | undefined {
  const canonical = sheets[0];
  const canonicalSets: DrillSet[] = canonical.rows.map((row, index) => ({
    id: index,
    number: row.set.number,
    ...(row.set.suffix ? { suffix: row.set.suffix } : {}),
    kind: row.set.kind,
    countsFromPrevious: row.countsFromPrevious,
    ...(row.measureRange ? { measureRange: row.measureRange } : {}),
  }));

  for (const [sheetIndex, sheet] of sheets.entries()) {
    if (sheet.rows.length !== canonical.rows.length) {
      diagnostics.push({
        severity: "error",
        code: "SET_COUNT_MISMATCH",
        message: `${sheet.displayLabel} has ${sheet.rows.length} rows; expected ${canonical.rows.length}.`,
        pageNumber: sheet.pageNumber,
        sheetIndex: sheet.sheetIndex,
      });
      continue;
    }
    for (let index = 0; index < canonical.rows.length; index += 1) {
      const expected = canonical.rows[index];
      const actual = sheet.rows[index];
      if (!sameSetIdentity(expected.set, actual.set)) {
        diagnostics.push({
          severity: "error",
          code: "SET_IDENTITY_MISMATCH",
          message: `${sheet.displayLabel} row ${index + 1} is Set ${formatSetName(actual.set)}, expected Set ${formatSetName(expected.set)}.`,
          pageNumber: sheet.pageNumber,
          sheetIndex: sheet.sheetIndex,
          rowText: actual.rawText,
        });
      }
      if (actual.countsFromPrevious !== expected.countsFromPrevious) {
        diagnostics.push({
          severity: "error",
          code: "COUNTS_MISMATCH",
          message: `Set ${formatSetName(expected.set)} has inconsistent counts (${expected.countsFromPrevious} vs ${actual.countsFromPrevious}) on ${sheet.displayLabel}.`,
          pageNumber: sheet.pageNumber,
          sheetIndex: sheet.sheetIndex,
          rowText: actual.rawText,
        });
      }
      if (!sameMeasureRange(actual.measureRange, expected.measureRange)) {
        diagnostics.push({
          severity: "error",
          code: "MEASURE_MISMATCH",
          message: `Set ${formatSetName(expected.set)} has inconsistent measure metadata on ${sheet.displayLabel}.`,
          pageNumber: sheet.pageNumber,
          sheetIndex: sheet.sheetIndex,
          rowText: actual.rawText,
        });
      }
    }
    if (sheetIndex === 0 && sheet.rows[0]?.countsFromPrevious !== 0) {
      diagnostics.push({
        severity: "error",
        code: "FIRST_SET_COUNTS_NONZERO",
        message: "The first imported set must have 0 counts from previous.",
        pageNumber: sheet.pageNumber,
        sheetIndex: sheet.sheetIndex,
        rowText: sheet.rows[0]?.rawText,
      });
    }
  }

  const entityIds = assignEntityIds(sheets, diagnostics);
  if (!entityIds) return undefined;
  const labels = new Set<string>();
  const entities: DrillEntity[] = [];
  const positions: DrillPosition[] = [];
  const references: NonNullable<NonNullable<DrillDocument["provenance"]>["references"]>[number][] = [];

  for (const [sheetIndex, sheet] of sheets.entries()) {
    if (labels.has(sheet.displayLabel)) {
      diagnostics.push({
        severity: "error",
        code: "DUPLICATE_PERFORMER_LABEL",
        message: `Performer label ${sheet.displayLabel} appears more than once.`,
        pageNumber: sheet.pageNumber,
        sheetIndex: sheet.sheetIndex,
      });
      continue;
    }
    labels.add(sheet.displayLabel);
    const entityId = entityIds[sheetIndex];
    entities.push({
      id: entityId,
      type: "performer",
      symbol: sheet.sourceSymbol,
      label: sheet.displayLabel,
      ...(sheet.performerName ? { name: sheet.performerName } : {}),
    });
    references.push({
      target: { type: "entity", entityId },
      page: sheet.pageNumber,
    });
    for (const [setId, row] of sheet.rows.entries()) {
      positions.push({
        entityId,
        setId,
        xSteps: row.position.xSteps,
        ySteps: row.position.ySteps,
      });
      references.push({
        target: { type: "position", entityId, setId },
        page: sheet.pageNumber,
        rawText: row.rawText,
      });
    }
  }

  return {
    schema: DRILL_SCHEMA_URL,
    schemaVersion: DRILL_SCHEMA_VERSION,
    metadata: {
      title: options.title.trim() || "Imported Drill",
      createdAt: options.createdAt,
    },
    field: options.field ?? DEFAULT_FIELD,
    entities,
    sets: canonicalSets,
    positions,
    provenance: {
      source: {
        kind: "coordinate-sheet-pdf",
        ...(options.fileName ? { fileName: options.fileName } : {}),
      },
      importer: { name: IMPORTER_NAME, version: IMPORTER_VERSION },
      importedAt: options.createdAt,
      references,
    },
    extensions: {
      "eight2five.coordinateSheet": {
        sheets: sheets.map((sheet, index) => ({
          entityId: entityIds[index],
          pageNumber: sheet.pageNumber,
          sheetIndex: sheet.sheetIndex,
          ...(sheet.sourceId ? { sourceId: sheet.sourceId } : {}),
          ...(sheet.sourceLabel ? { sourceLabel: sheet.sourceLabel } : {}),
          ...(sheet.showTitle ? { showTitle: sheet.showTitle } : {}),
        })),
      },
    },
  };
}

function assignEntityIds(
  sheets: readonly ParsedCoordinateSheet[],
  diagnostics: ImportDiagnostic[],
): readonly number[] | undefined {
  const sourceIds = sheets.map((sheet) => {
    if (!sheet.sourceId || !/^\d+$/.test(sheet.sourceId)) return undefined;
    const parsed = Number(sheet.sourceId);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  });
  const validSourceIds = sourceIds.every(
    (id): id is number => id !== undefined,
  );
  if (validSourceIds && new Set(sourceIds).size === sourceIds.length) return sourceIds;

  if (sheets.some((sheet) => sheet.sourceId)) {
    diagnostics.push({
      severity: "warning",
      code: "SOURCE_IDS_REASSIGNED",
      message:
        "One or more source performer IDs were missing, duplicated, or outside JavaScript's safe integer range; portable IDs were assigned sequentially.",
    });
  }
  return sheets.map((_, index) => index + 1);
}

function sameSetIdentity(left: ParsedSetIdentity, right: ParsedSetIdentity): boolean {
  return (
    left.number === right.number &&
    (left.suffix ?? "") === (right.suffix ?? "") &&
    left.kind === right.kind
  );
}

function sameMeasureRange(
  left: MeasureRange | undefined,
  right: MeasureRange | undefined,
): boolean {
  if (!left || !right) return left === right;
  return left.start === right.start && left.end === right.end;
}
