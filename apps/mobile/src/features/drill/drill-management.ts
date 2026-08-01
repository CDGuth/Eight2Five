import type { Drill, DrillRepository } from "@eight2five/mobile/drill";

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

export async function createNamedDrill(
  repository: DrillRepository,
  value: string,
): Promise<Drill> {
  const error = validateDrillName(value);
  if (error) throw new Error(error);
  return await repository.createDrill(normalizeDrillName(value));
}

export async function renameNamedDrill(
  repository: DrillRepository,
  drillId: string,
  value: string,
): Promise<Drill> {
  const error = validateDrillName(value);
  if (error) throw new Error(error);
  return await repository.renameDrill(drillId, normalizeDrillName(value));
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
