import type { Drill, DrillRepository } from "@eight2five/mobile/drill";
import {
  safeParseDrillDocument,
  type DrillDocument,
} from "@eight2five/drill-schema";

export const EIGHT2FIVE_DRILL_FILE_SUFFIX = ".eight2five.json";
export const MAX_DRILL_UPLOAD_BYTES = 10 * 1024 * 1024;

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

  assertMobileImportSupport(parsed.data);
  return parsed.data;
}

export async function importEight2FiveDrillJson(
  repository: DrillRepository,
  json: string,
): Promise<Drill> {
  return await importEight2FiveDrillDocument(
    repository,
    parseImportableDrillJson(json),
  );
}

export async function importEight2FiveDrillDocument(
  repository: DrillRepository,
  document: DrillDocument,
): Promise<Drill> {
  assertMobileImportSupport(document);

  const fieldPreset = document.field.preset;
  const performer = document.entities[0];
  const positionsBySet = new Map(
    document.positions
      .filter((position) => position.entityId === performer.id)
      .map((position) => [position.setId, position] as const),
  );
  const createdAt = Date.parse(document.metadata.createdAt);

  const drill = await repository.createDrill({
    name: document.metadata.title,
    fieldPreset,
    createdAt,
    updatedAt: createdAt,
  });

  try {
    for (const set of document.sets) {
      const position = positionsBySet.get(set.id);
      if (!position) {
        throw new Error(
          `Set ${set.number}${set.suffix ?? ""} is missing the performer's position.`,
        );
      }

      await repository.createSet({
        drillId: drill.id,
        number: set.number,
        ...(set.suffix !== undefined ? { suffix: set.suffix } : {}),
        kind: set.kind,
        countsFromPrevious: set.countsFromPrevious,
        ...(set.measureRange ? { measureRange: set.measureRange } : {}),
        position: {
          xSteps: position.xSteps,
          ySteps: position.ySteps,
        },
        ...(position.facingDegrees !== undefined
          ? { facingDegrees: position.facingDegrees }
          : {}),
      });
    }
  } catch (cause) {
    try {
      await repository.deleteDrill(drill.id);
    } catch {
      // Preserve the original import failure. The repository normally cascades
      // drill deletion to any sets already inserted.
    }
    throw cause;
  }

  return drill;
}

function assertMobileImportSupport(
  document: DrillDocument,
): asserts document is DrillDocument & {
  readonly field: Extract<DrillDocument["field"], { readonly type: "preset" }>;
  readonly entities: readonly [DrillDocument["entities"][number]];
} {
  if (document.field.type !== "preset") {
    throw new Error(
      "Custom field definitions are not supported in the mobile app yet.",
    );
  }

  if (
    document.entities.length !== 1 ||
    document.entities[0]?.type !== "performer"
  ) {
    throw new Error(
      "The mobile app currently supports drill files with exactly one performer and no props.",
    );
  }

  const performerId = document.entities[0].id;
  const performerPositions = document.positions.filter(
    (position) => position.entityId === performerId,
  );
  if (performerPositions.length !== document.sets.length) {
    throw new Error("Every set must include a position for the performer.");
  }

  if (document.paths?.some((path) => path.kind !== "straight")) {
    throw new Error(
      "Polyline and Bézier drill paths are not supported in the mobile app yet.",
    );
  }
}
