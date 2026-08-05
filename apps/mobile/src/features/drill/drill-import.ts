import type { Drill, DrillRepository } from "@eight2five/mobile/drill";
import type {
  DocumentPickerAsset,
  DocumentPickerResult,
} from "expo-document-picker";
import {
  safeParseDrillDocument,
  type DrillDocument,
  type DrillEntity,
} from "@eight2five/drill-schema";

export const EIGHT2FIVE_DRILL_FILE_SUFFIX = ".eight2five.json";
export const MAX_DRILL_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface ParsedDrillPickerResult {
  readonly document: DrillDocument;
  readonly fileName: string;
}

export interface PerformerSymbolGroup {
  readonly symbol: string;
  readonly performers: readonly DrillEntity[];
}

export function isEight2FiveDrillFileName(fileName: string): boolean {
  const normalized = fileName.trim().toLowerCase();
  return (
    normalized === "eight2five.json" ||
    normalized.endsWith(EIGHT2FIVE_DRILL_FILE_SUFFIX)
  );
}

/**
 * Applies the existing file-name and size checks to a native picker asset,
 * then reads and validates its JSON through the caller-provided Expo file
 * reader. Keeping the reader injectable makes the import boundary testable
 * without a native document picker or filesystem.
 */
export async function parseDrillPickerResult(
  result: DocumentPickerResult,
  readText: (uri: string) => Promise<string>,
): Promise<ParsedDrillPickerResult | undefined> {
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset) return undefined;
  return {
    document: await parseDrillPickerAsset(asset, readText),
    fileName: asset.name,
  };
}

export async function parseDrillPickerAsset(
  asset: Pick<DocumentPickerAsset, "name" | "size" | "uri">,
  readText: (uri: string) => Promise<string>,
): Promise<DrillDocument> {
  if (!isEight2FiveDrillFileName(asset.name)) {
    throw new Error(`Select a file ending in ${EIGHT2FIVE_DRILL_FILE_SUFFIX}.`);
  }
  if (typeof asset.size === "number" && asset.size > MAX_DRILL_UPLOAD_BYTES) {
    throw new Error("The selected drill file is too large to import.");
  }

  const json = await readText(asset.uri);
  if (json.length > MAX_DRILL_UPLOAD_BYTES) {
    throw new Error("The selected drill file is too large to import.");
  }
  return parseImportableDrillJson(json);
}

export function parseImportableDrillJson(json: string): DrillDocument {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  const parsed = safeParseDrillDocument(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue?.message ? ` ${issue.message}` : "";
    throw new Error(`This is not a valid Eight2Five drill file.${detail}`);
  }

  assertMobileDocumentSupport(parsed.data);
  return parsed.data;
}

export function getPerformerSymbolGroups(
  document: DrillDocument,
): readonly PerformerSymbolGroup[] {
  const groups = new Map<string, DrillEntity[]>();
  for (const entity of document.entities) {
    if (entity.type !== "performer") continue;
    const performers = groups.get(entity.symbol);
    if (performers) performers.push(entity);
    else groups.set(entity.symbol, [entity]);
  }
  return [...groups.entries()].map(([symbol, performers]) => ({
    symbol,
    performers,
  }));
}

export async function importEight2FiveDrillJson(
  repository: DrillRepository,
  json: string,
  performerEntityId?: number,
): Promise<Drill> {
  return await importEight2FiveDrillDocument(
    repository,
    parseImportableDrillJson(json),
    performerEntityId,
  );
}

export async function importEight2FiveDrillDocument(
  repository: DrillRepository,
  document: DrillDocument,
  performerEntityId?: number,
): Promise<Drill> {
  assertMobileDocumentSupport(document);
  const performer = resolveSelectedPerformer(document, performerEntityId);
  assertSelectedPerformerPositions(document, performer);

  return await repository.createImportedDrill({
    sourceDocument: document,
    selectedPerformerEntityId: performer.id,
  });
}

function assertMobileDocumentSupport(
  document: DrillDocument,
): asserts document is DrillDocument & {
  readonly field: Extract<DrillDocument["field"], { readonly type: "preset" }>;
} {
  if (document.field.type !== "preset") {
    throw new Error(
      "Custom field definitions are not supported in the mobile app yet.",
    );
  }

  if (!document.entities.some((entity) => entity.type === "performer")) {
    throw new Error("This drill file does not contain a performer to select.");
  }
}

function resolveSelectedPerformer(
  document: DrillDocument,
  performerEntityId?: number,
): DrillEntity {
  const performers = document.entities.filter(
    (entity) => entity.type === "performer",
  );
  if (performerEntityId === undefined) {
    if (performers.length === 1) return performers[0];
    throw new Error("Select your performer before importing this drill.");
  }

  const performer = performers.find(
    (entity) => entity.id === performerEntityId,
  );
  if (!performer) {
    throw new Error(
      "The selected performer is not present in this drill file.",
    );
  }
  return performer;
}

function assertSelectedPerformerPositions(
  document: DrillDocument,
  performer: DrillEntity,
): void {
  const positionedSetIds = new Set(
    document.positions
      .filter((position) => position.entityId === performer.id)
      .map((position) => position.setId),
  );
  if (document.sets.some((set) => !positionedSetIds.has(set.id))) {
    throw new Error(
      `Every drill position must include a coordinate for ${performer.label}.`,
    );
  }
}
