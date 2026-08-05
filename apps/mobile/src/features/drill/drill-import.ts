import type { Drill, DrillRepository } from "@eight2five/mobile/drill";
import {
  safeParseDrillDocument,
  type DrillDocument,
  type DrillEntity,
} from "@eight2five/drill-schema";

export const EIGHT2FIVE_DRILL_FILE_SUFFIX = ".eight2five.json";
export const MAX_DRILL_UPLOAD_BYTES = 10 * 1024 * 1024;

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
