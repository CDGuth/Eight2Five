import type { DrillPage } from "@eight2five/mobile/drill";

import {
  areCoordinatePanelControlsDisabled,
  getDrillCoordinatePresentation,
  getLiveCoordinatePresentation,
} from "../coordinate-panel-state";

const first: DrillPage = {
  id: "p1",
  drillId: "d1",
  ordinal: 0,
  label: "1",
  countsFromPrevious: 0,
  position: { xMeters: 36.576, yMeters: 4.064 },
};
const second: DrillPage = {
  id: "p2",
  drillId: "d1",
  ordinal: 1,
  label: "2",
  countsFromPrevious: 8,
  position: { xMeters: 41.148, yMeters: 4.064 },
};

describe("coordinate panel state", () => {
  test("presents waiting, live, and stale states", () => {
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
    expect(
      getLiveCoordinatePresentation({
        connectionState: "connected",
        position: second.position,
        isStale: false,
      }).primary,
    ).toContain("Side 1");
    expect(
      getLiveCoordinatePresentation({
        connectionState: "disconnected",
        position: second.position,
        isStale: true,
      }),
    ).toMatchObject({ statusLabel: "Last known position", muted: true });
  });

  test("keeps the empty drill model stable and terminology-aware", () => {
    expect(
      getDrillCoordinatePresentation({
        terminology: "sets",
        metricMode: "step-size",
      }),
    ).toEqual({
      term: "Set",
      page: "–",
      counts: "–",
      metricLabel: "Step Size",
      metric: "–",
      coordinate: null,
      emptyMessage: "No drill page selected",
    });
  });

  test("toggles between step-size and crossing-count metrics", () => {
    const stepSize = getDrillCoordinatePresentation({
      page: second,
      previousPage: first,
      terminology: "pages",
      metricMode: "step-size",
    });
    const crossingCounts = getDrillCoordinatePresentation({
      page: second,
      previousPage: first,
      terminology: "pages",
      metricMode: "crossing-counts",
    });

    expect(stepSize).toMatchObject({
      term: "Page",
      page: "2",
      counts: "8",
      metricLabel: "Step Size",
      metric: "8 to 5",
    });
    expect(crossingCounts.metricLabel).toBe("xCounts");
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
