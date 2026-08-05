import {
  type Drill,
  type DrillRepository,
  type DrillTerms,
} from "@eight2five/mobile/drill";

export const DRILL_NAME_MAX_LENGTH = 80;

export interface DrillListEntry {
  readonly drill: Drill;
  readonly pageCount: number;
}

export function normalizeDrillName(value: string): string {
  return value.trim();
}

export function validateDrillName(value: string): string | undefined {
  const name = normalizeDrillName(value);
  if (!name) return "Enter a drill name.";
  if (name.length > DRILL_NAME_MAX_LENGTH) {
    return `Drill names must be ${DRILL_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function formatDrillCount(count: number, terms: DrillTerms): string {
  return `${count} ${count === 1 ? terms.singular : terms.plural}`;
}

export function getDrillCardActionLabels(drillName: string): {
  readonly info: string;
  readonly performer: string;
  readonly activate: string;
  readonly deactivate: string;
} {
  return {
    info: `Info for ${drillName}`,
    performer: `Select performer for ${drillName}`,
    activate: `Activate ${drillName}`,
    deactivate: `Deactivate ${drillName}`,
  };
}

export async function loadDrillList(
  repository: DrillRepository,
): Promise<readonly DrillListEntry[]> {
  const drills = await repository.listDrills();
  const pageCounts = await Promise.all(
    drills.map(async (drill) => (await repository.listPages(drill.id)).length),
  );
  // Preserve Thread 1's repository-defined deterministic ordering.
  return drills.map((drill, index) => ({
    drill,
    pageCount: pageCounts[index],
  }));
}

export async function deleteDrillAndRefreshSettings(
  repository: DrillRepository,
  drillId: string,
  reloadSettings: () => Promise<unknown>,
): Promise<void> {
  await repository.deleteDrill(drillId);
  // SQLite foreign keys clear active/selected pointers; publish that snapshot.
  await reloadSettings();
}

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
