import type {
  DrillRepository,
  DrillSet,
  TransitionAnalysis,
} from "@eight2five/mobile/drill";

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

function set(id: string, ordinal: number, xSteps = ordinal * 8): DrillSet {
  return {
    id,
    drillId: "drill",
    ordinal,
    number: ordinal + 1,
    kind: "set",
    countsFromPrevious: ordinal === 0 ? 0 : 8,
    position: { xSteps, ySteps: 0 },
  };
}

describe("set ordering and transition presentation", () => {
  const sets = [set("a", 0), set("b", 1), set("c", 2)];

  test("calculates append and insertion ordinals without deriving display identity", () => {
    expect(normalizePagePlacement("before")).toBe("before");
    expect(normalizePagePlacement("after")).toBe("after");
    expect(normalizePagePlacement("malformed-deep-link")).toBe("append");
    expect(getPageCreationOrdinal(sets, "append")).toBe(3);
    expect(getPageCreationOrdinal(sets, "before", "b")).toBe(1);
    expect(getPageCreationOrdinal(sets, "after", "b")).toBe(2);
    expect(() => getPageCreationOrdinal(sets, "before", "missing")).toThrow(
      "insertion point",
    );
  });

  test("inserts before and after through the transactional repository contract", async () => {
    const inserted = set("inserted", 1);
    const repository = {
      insertSet: jest.fn(async () => inserted),
    } as unknown as DrillRepository;
    const draft = createDefaultPageDraft({ ordinal: 1, suggestedNumber: 8 });

    await savePageDraft({
      repository,
      drillId: "drill",
      pageId: "new",
      pages: sets,
      placement: "before",
      relativePageId: "b",
      draft,
    });
    expect(repository.insertSet).toHaveBeenLastCalledWith(
      "drill",
      1,
      expect.objectContaining({ number: 8, kind: "set" }),
    );

    await savePageDraft({
      repository,
      drillId: "drill",
      pageId: "new",
      pages: sets,
      placement: "after",
      relativePageId: "b",
      draft,
    });
    expect(repository.insertSet).toHaveBeenLastCalledWith(
      "drill",
      2,
      expect.objectContaining({ number: 8, kind: "set" }),
    );
  });

  test("moves stable IDs up and down and leaves boundaries unchanged", async () => {
    expect(reorderedPageIds(sets, "b", "up")).toEqual(["b", "a", "c"]);
    expect(reorderedPageIds(sets, "b", "down")).toEqual(["a", "c", "b"]);
    expect(reorderedPageIds(sets, "a", "up")).toBeUndefined();
    expect(() => reorderedPageIds(sets, "missing", "up")).toThrow(
      "no longer exists",
    );

    const reordered = [set("b", 0), set("a", 1), set("c", 2)];
    const repository = {
      reorderSets: jest.fn(async () => reordered),
    } as unknown as DrillRepository;
    await expect(movePage(repository, "drill", sets, "b", "up")).resolves.toBe(
      reordered,
    );
    expect(repository.reorderSets).toHaveBeenCalledWith("drill", [
      "b",
      "a",
      "c",
    ]);
  });

  test("deletes before publishing cleared selected-set state", async () => {
    const order: string[] = [];
    const repository = {
      deleteSet: jest.fn(async () => {
        order.push("delete");
      }),
    } as unknown as DrillRepository;
    await deletePageAndRefreshSettings(repository, "b", async () => {
      order.push("reload");
    });
    expect(order).toEqual(["delete", "reload"]);
  });

  test("formats unavailable, Hold, Step Size, and xCounts values", () => {
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
    ).toBe("Hold");
  });

  test("recalculates both transitions neighboring a changed middle set", () => {
    const originalMiddle = getTransitionPresentation(sets[0], sets[1]);
    const originalFollowing = getTransitionPresentation(sets[1], sets[2]);
    const changedMiddle = {
      ...sets[1],
      position: sets[0].position,
    };
    const nextMiddle = getTransitionPresentation(sets[0], changedMiddle);
    const nextFollowing = getTransitionPresentation(changedMiddle, sets[2]);

    expect(originalMiddle.stepSize).toBe("8 to 5");
    expect(originalFollowing.stepSize).toBe("8 to 5");
    expect(nextMiddle.stepSize).toBe("Hold");
    expect(nextFollowing.stepSize).toBe("4 to 5");
  });
});
