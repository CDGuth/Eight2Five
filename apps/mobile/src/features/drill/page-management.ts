import type { DrillPage, DrillRepository } from "@eight2five/mobile/drill";

import { validatePageDraft, type MarchingCoordinateDraft } from "./page-form";

export type PagePlacement = "append" | "before" | "after";
export type PageMoveDirection = "up" | "down";

export function normalizePagePlacement(value: unknown): PagePlacement {
  return value === "before" || value === "after" ? value : "append";
}

export function getPageCreationOrdinal(
  pages: readonly DrillPage[],
  placement: PagePlacement,
  relativePageId?: string,
): number {
  if (placement === "append") return pages.length;
  const relativeIndex = pages.findIndex((page) => page.id === relativePageId);
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
}: {
  repository: DrillRepository;
  drillId: string;
  pageId: string;
  pages: readonly DrillPage[];
  placement: PagePlacement;
  relativePageId?: string;
  draft: MarchingCoordinateDraft;
}): Promise<DrillPage> {
  const validation = validatePageDraft(draft);
  if (!validation.value) {
    const message =
      Object.values(validation.errors)[0] ?? "Review the page form.";
    throw new Error(message);
  }
  const details = {
    label: validation.value.label,
    countsFromPrevious: validation.value.countsFromPrevious,
    position: validation.value.position,
  };
  if (pageId !== "new") {
    return await repository.updatePage(pageId, details);
  }

  const ordinal = getPageCreationOrdinal(pages, placement, relativePageId);
  if (placement === "append") {
    return await repository.createPage({ drillId, ...details });
  }
  return await repository.insertPage(drillId, ordinal, details);
}

export function reorderedPageIds(
  pages: readonly DrillPage[],
  pageId: string,
  direction: PageMoveDirection,
): readonly string[] | undefined {
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0) throw new Error("The page to move no longer exists.");
  const destination = direction === "up" ? index - 1 : index + 1;
  if (destination < 0 || destination >= pages.length) return undefined;
  const ids = pages.map((page) => page.id);
  [ids[index], ids[destination]] = [ids[destination], ids[index]];
  return ids;
}

export async function movePage(
  repository: DrillRepository,
  drillId: string,
  pages: readonly DrillPage[],
  pageId: string,
  direction: PageMoveDirection,
): Promise<readonly DrillPage[]> {
  const ids = reorderedPageIds(pages, pageId, direction);
  return ids ? await repository.reorderPages(drillId, ids) : pages;
}

export async function deletePageAndRefreshSettings(
  repository: DrillRepository,
  pageId: string,
  reloadSettings: () => Promise<unknown>,
): Promise<void> {
  await repository.deletePage(pageId);
  // Publish the selected-page pointer cleared by SQLite's foreign key.
  await reloadSettings();
}
