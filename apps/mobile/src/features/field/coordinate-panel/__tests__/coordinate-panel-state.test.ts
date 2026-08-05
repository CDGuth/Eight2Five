import type { DrillSet } from "@eight2five/mobile/drill";
import { drillGridPointToFieldPoint } from "@eight2five/mobile/field";

import {
  areCoordinatePanelControlsDisabled,
  getDrillCoordinatePresentation,
  getLiveCoordinatePresentation,
} from "../coordinate-panel-state";

const first: DrillSet = {
  id: "s1",
  drillId: "d1",
  ordinal: 0,
  number: 31,
  kind: "set",
  countsFromPrevious: 0,
  measureRange: { start: 122, end: 125 },
  position: { xSteps: -16, ySteps: 7 },
};
const second: DrillSet = {
  id: "s2",
  drillId: "d1",
  ordinal: 1,
  number: 32,
  kind: "set",
  countsFromPrevious: 8,
  measureRange: { start: 126, end: 129 },
  position: { xSteps: -8, ySteps: 7 },
};

describe("coordinate panel state", () => {
  test("presents waiting, live, and stale physical-position states", () => {
    expect(
      getLiveCoordinatePresentation({
        connectionState: "idle",
        isStale: false,
      }),
    ).toMatchObject({
      primary: "Waiting for live position",
      secondary: "Connect a PANS tag to begin",
      muted: true,
    });
    const livePosition = drillGridPointToFieldPoint(second.position);
    expect(
      getLiveCoordinatePresentation({
        connectionState: "connected",
        position: livePosition,
        isStale: false,
      }).primary,
    ).toContain("Side 1");
    expect(
      getLiveCoordinatePresentation({
        connectionState: "disconnected",
        position: livePosition,
        isStale: true,
      }),
    ).toMatchObject({ statusLabel: "Last known position", muted: true });
  });

  test("uses the selected terminology and separate count/measure fields", () => {
    expect(
      getDrillCoordinatePresentation({
        metricMode: "step-size",
        terminology: "sets",
      }),
    ).toEqual({
      term: "Set",
      set: "–",
      counts: "–",
      measures: "–",
      metricLabel: "Step Size",
      metric: "–",
      coordinate: null,
      emptyMessage: "No drill set selected",
    });
    expect(
      getDrillCoordinatePresentation({
        metricMode: "step-size",
        terminology: "pages",
      }),
    ).toMatchObject({
      term: "Page",
      emptyMessage: "No drill page selected",
    });
  });

  test("toggles between step-size and crossing-count metrics", () => {
    const stepSize = getDrillCoordinatePresentation({
      page: second,
      previousPage: first,
      metricMode: "step-size",
      terminology: "sets",
    });
    const crossingCounts = getDrillCoordinatePresentation({
      page: second,
      previousPage: first,
      metricMode: "crossing-counts",
      terminology: "sets",
    });

    expect(stepSize).toMatchObject({
      term: "Set",
      set: "32",
      counts: "8",
      measures: "126–129",
      metricLabel: "Step Size",
      metric: "8 to 5",
    });
    expect(crossingCounts.metricLabel).toBe("xCounts");
  });

  test("shows zero counts for the first set instead of using an unavailable marker", () => {
    expect(
      getDrillCoordinatePresentation({
        page: first,
        metricMode: "step-size",
        terminology: "sets",
      }).counts,
    ).toBe("0");
  });

  test("disables controls until storage and drill data are ready", () => {
    expect(
      areCoordinatePanelControlsDisabled({
        settingsReady: false,
        loadingDrills: false,
        selectionBusy: false,
      }),
    ).toBe(true);
    expect(
      areCoordinatePanelControlsDisabled({
        settingsReady: true,
        loadingDrills: false,
        selectionBusy: false,
      }),
    ).toBe(false);
  });
});
