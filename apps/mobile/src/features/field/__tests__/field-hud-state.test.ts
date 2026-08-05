import type { DrillSet } from "@eight2five/mobile/drill";

import {
  INITIAL_FIELD_HUD_STATE,
  formatMeasureRange,
  getDrillSetHudPresentation,
  reduceFieldHudState,
} from "../field-hud-state";

const set = (overrides: Partial<DrillSet> = {}): DrillSet => ({
  id: "set-2",
  drillId: "drill-1",
  ordinal: 1,
  number: 2,
  kind: "set",
  countsFromPrevious: 16,
  measureRange: { start: 3, end: 4 },
  position: { xSteps: 80, ySteps: 28 },
  ...overrides,
});

describe("field HUD state", () => {
  test("keeps count display and expansion as explicit session state", () => {
    const measures = reduceFieldHudState(INITIAL_FIELD_HUD_STATE, {
      type: "toggle-count-display",
    });
    expect(measures).toEqual({
      countDisplayMode: "measures",
      drillPillExpanded: false,
    });
    const expanded = reduceFieldHudState(measures, {
      type: "toggle-drill-pill",
    });
    expect(expanded.drillPillExpanded).toBe(true);
    expect(
      reduceFieldHudState(expanded, { type: "collapse-drill-pill" }),
    ).toEqual({ countDisplayMode: "measures", drillPillExpanded: false });
  });

  test("formats counts, measures, metrics, terminology, and coordinates centrally", () => {
    const presentation = getDrillSetHudPresentation({
      page: set(),
      previousPage: set({ id: "set-1", ordinal: 0, number: 1 }),
      terminology: "pages",
      metricMode: "crossing-counts",
    });
    expect(presentation.term).toBe("Page");
    expect(presentation.counts).toBe("16");
    expect(presentation.measures).toBe("3–4");
    expect(presentation.metricLabel).toBe("xCounts");
    expect(presentation.coordinate).not.toBeNull();
    expect(formatMeasureRange(undefined)).toBe("–");
    expect(formatMeasureRange({ start: 5, end: 5 })).toBe("5");
  });
});
