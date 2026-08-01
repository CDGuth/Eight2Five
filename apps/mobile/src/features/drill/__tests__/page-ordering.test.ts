import type {
  DrillPage,
  DrillRepository,
  TransitionAnalysis,
} from "@eight2five/mobile/drill";
import { yardsToMeters } from "@eight2five/mobile/field";

import {
  formatTransitionAnalysis,
  getTransitionPresentation,
} from "../transition-presentation";
import { createDefaultPageDraft } from "../page-form";
import {
  deletePageAndRefreshSettings,
  getPageCreationOrdinal,
  movePage,
  normalizePagePlacement,
  reorderedPageIds,
  savePageDraft,
} from "../page-management";

function page(id: string, ordinal: number, xYards = ordinal * 5): DrillPage {
  return {
    id,
    drillId: "drill",
    ordinal,
    label: id.toUpperCase(),
    countsFromPrevious: ordinal === 0 ? 0 : 8,
    position: { xMeters: yardsToMeters(xYards), yMeters: 0 },
  };
}

describe("page ordering and transition presentation", () => {
  const pages = [page("a", 0), page("b", 1), page("c", 2)];

  test("calculates append and insertion ordinals without parsing labels", () => {
    expect(normalizePagePlacement("before")).toBe("before");
    expect(normalizePagePlacement("after")).toBe("after");
    expect(normalizePagePlacement("malformed-deep-link")).toBe("append");
    expect(getPageCreationOrdinal(pages, "append")).toBe(3);
    expect(getPageCreationOrdinal(pages, "before", "b")).toBe(1);
    expect(getPageCreationOrdinal(pages, "after", "b")).toBe(2);
    expect(() => getPageCreationOrdinal(pages, "before", "missing")).toThrow(
      "insertion point",
    );
  });

  test("inserts before and after through the transactional repository contract", async () => {
    const inserted = page("inserted", 1);
    const repository = {
      insertPage: jest.fn(async () => inserted),
    } as unknown as DrillRepository;
    const draft = createDefaultPageDraft({ ordinal: 1, suggestedLabel: "X" });

    await savePageDraft({
      repository,
      drillId: "drill",
      pageId: "new",
      pages,
      placement: "before",
      relativePageId: "b",
      draft,
    });
    expect(repository.insertPage).toHaveBeenLastCalledWith(
      "drill",
      1,
      expect.objectContaining({ label: "X" }),
    );

    await savePageDraft({
      repository,
      drillId: "drill",
      pageId: "new",
      pages,
      placement: "after",
      relativePageId: "b",
      draft,
    });
    expect(repository.insertPage).toHaveBeenLastCalledWith(
      "drill",
      2,
      expect.objectContaining({ label: "X" }),
    );
  });

  test("moves stable IDs up and down and leaves boundaries unchanged", async () => {
    expect(reorderedPageIds(pages, "b", "up")).toEqual(["b", "a", "c"]);
    expect(reorderedPageIds(pages, "b", "down")).toEqual(["a", "c", "b"]);
    expect(reorderedPageIds(pages, "a", "up")).toBeUndefined();
    expect(() => reorderedPageIds(pages, "missing", "up")).toThrow(
      "no longer exists",
    );

    const reordered = [page("b", 0), page("a", 1), page("c", 2)];
    const repository = {
      reorderPages: jest.fn(async () => reordered),
    } as unknown as DrillRepository;
    await expect(movePage(repository, "drill", pages, "b", "up")).resolves.toBe(
      reordered,
    );
    expect(repository.reorderPages).toHaveBeenCalledWith("drill", [
      "b",
      "a",
      "c",
    ]);
  });

  test("deletes before publishing cleared selected-page state", async () => {
    const order: string[] = [];
    const repository = {
      deletePage: jest.fn(async () => {
        order.push("delete");
      }),
    } as unknown as DrillRepository;
    await deletePageAndRefreshSettings(repository, "b", async () => {
      order.push("reload");
    });
    expect(order).toEqual(["delete", "reload"]);
  });

  test("formats unavailable, Halt, Step Size, and xCounts values", () => {
    const base: TransitionAnalysis = {
      distanceSteps: 8,
      stepSizeToFive: 6.5,
      isHalt: false,
      yardLineCrossingCounts: [4, 12],
    };
    expect(formatTransitionAnalysis(base, false, 16)).toEqual({
      stepSize: "–",
      crossingCounts: "–",
    });
    expect(formatTransitionAnalysis(base, true, 0)).toEqual({
      stepSize: "–",
      crossingCounts: "–",
    });
    expect(formatTransitionAnalysis(base, true, 16)).toEqual({
      stepSize: "6.5 to 5",
      crossingCounts: "4, 12",
    });
    expect(
      formatTransitionAnalysis(
        { ...base, isHalt: true, stepSizeToFive: undefined },
        true,
        16,
      ).stepSize,
    ).toBe("Halt");
  });

  test("recalculates both transitions neighboring a changed middle page", () => {
    const originalMiddle = getTransitionPresentation(pages[0], pages[1]);
    const originalFollowing = getTransitionPresentation(pages[1], pages[2]);
    const changedMiddle = {
      ...pages[1],
      position: pages[0].position,
    };
    const nextMiddle = getTransitionPresentation(pages[0], changedMiddle);
    const nextFollowing = getTransitionPresentation(changedMiddle, pages[2]);

    expect(originalMiddle.stepSize).toBe("8 to 5");
    expect(originalFollowing.stepSize).toBe("8 to 5");
    expect(nextMiddle.stepSize).toBe("Halt");
    expect(nextFollowing.stepSize).toBe("4 to 5");
  });
});
