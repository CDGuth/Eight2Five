import type { DrillRepository, DrillSet } from "@eight2five/mobile/drill";
import type { FieldPresetId } from "@eight2five/drill-schema";

import { validatePageDraft, type MarchingCoordinateDraft } from "./page-form";

export type SetPlacement = "append" | "before" | "after";
export type SetMoveDirection = "up" | "down";
/** @deprecated Use SetPlacement. */
export type PagePlacement = SetPlacement;
/** @deprecated Use SetMoveDirection. */
export type PageMoveDirection = SetMoveDirection;

export function normalizePagePlacement(value: unknown): SetPlacement {
  return value === "before" || value === "after" ? value : "append";
}

export function getPageCreationOrdinal(
  sets: readonly DrillSet[],
  placement: SetPlacement,
  relativeSetId?: string,
): number {
  if (placement === "append") return sets.length;
  const relativeIndex = sets.findIndex((set) => set.id === relativeSetId);
  if (relativeIndex < 0) {
    throw new Error("The selected insertion point no longer exists.");
  }
  return placement === "before" ? relativeIndex : relativeIndex + 1;
}

export async function savePageDraft({
  repository,
  drillId,
  pageId,
  pages,
  placement,
  relativePageId,
  draft,
  fieldPreset = "football-nfhs",
}: {
  repository: DrillRepository;
  drillId: string;
  pageId: string;
  pages: readonly DrillSet[];
  placement: SetPlacement;
  relativePageId?: string;
  draft: MarchingCoordinateDraft;
  fieldPreset?: FieldPresetId;
}): Promise<DrillSet> {
  const validation = validatePageDraft(draft, fieldPreset);
  if (!validation.value) {
    const message =
      Object.values(validation.errors)[0] ?? "Review the drill position form.";
    throw new Error(message);
  }
  const details = {
    number: validation.value.number,
    kind: validation.value.kind,
    ...(validation.value.suffix === undefined
      ? {}
      : { suffix: validation.value.suffix }),
    countsFromPrevious: validation.value.countsFromPrevious,
    ...(validation.value.measureRange === undefined
      ? {}
      : { measureRange: validation.value.measureRange }),
    position: validation.value.position,
  };
  if (pageId !== "new") {
    return await repository.updateSet(pageId, details);
  }

  const ordinal = getPageCreationOrdinal(pages, placement, relativePageId);
  if (placement === "append") {
    return await repository.createSet({ drillId, ...details });
  }
  return await repository.insertSet(drillId, ordinal, details);
}

export function reorderedPageIds(
  sets: readonly DrillSet[],
  setId: string,
  direction: SetMoveDirection,
): readonly string[] | undefined {
  const index = sets.findIndex((set) => set.id === setId);
  if (index < 0) throw new Error("The position to move no longer exists.");
  const destination = direction === "up" ? index - 1 : index + 1;
  if (destination < 0 || destination >= sets.length) return undefined;
  const ids = sets.map((set) => set.id);
  [ids[index], ids[destination]] = [ids[destination], ids[index]];
  return ids;
}

export async function movePage(
  repository: DrillRepository,
  drillId: string,
  sets: readonly DrillSet[],
  setId: string,
  direction: SetMoveDirection,
): Promise<readonly DrillSet[]> {
  const ids = reorderedPageIds(sets, setId, direction);
  return ids ? await repository.reorderSets(drillId, ids) : sets;
}

export async function deletePageAndRefreshSettings(
  repository: DrillRepository,
  setId: string,
  reloadSettings: () => Promise<unknown>,
): Promise<void> {
  await repository.deleteSet(setId);
  // Publish the selected-set pointer cleared by SQLite's foreign key.
  await reloadSettings();
}
