import type { DrillPage, DrillRepository } from "@eight2five/mobile/drill";

import { validatePageDraft, type MarchingCoordinateDraft } from "./page-form";

export type PagePlacement = "append" | "before" | "after";

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
