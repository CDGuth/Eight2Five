import {
  analyzeDrillTransition,
  analyzeTransition,
  type DrillSet,
} from "../index";

function set(
  id: string,
  xSteps: number,
  countsFromPrevious: number,
  ySteps = 0,
): DrillSet {
  const ordinal = Number(id);
  return {
    id,
    drillId: "drill-1",
    ordinal,
    number: ordinal,
    kind: "set",
    countsFromPrevious,
    position: { xSteps, ySteps },
  };
}

describe("drill transition analysis", () => {
  test("omits derived rates for the first set", () => {
    expect(analyzeDrillTransition(undefined, set("1", -64, 0))).toEqual({
      distanceSteps: 0,
      isHalt: false,
      yardLineCrossingCounts: [],
    });
  });

  test("omits step size and crossing counts for zero counts", () => {
    const analysis = analyzeDrillTransition(set("1", -64, 0), set("2", -48, 0));
    expect(analysis.distanceSteps).toBe(16);
    expect(analysis.stepSizeToFive).toBeUndefined();
    expect(analysis.yardLineCrossingCounts).toEqual([]);
  });

  test("recognizes a same-position positive-count halt", () => {
    const analysis = analyzeDrillTransition(
      set("1", -16, 0),
      set("2", -16, 16),
    );
    expect(analysis).toMatchObject({ distanceSteps: 0, isHalt: true });
    expect(analysis.stepSizeToFive).toBeUndefined();
  });

  test.each([
    [8, 8, 8],
    [4.5, 8, 14.25],
    [16, 13, 6.5],
  ])(
    "derives %s drill-grid steps over %s counts as %s-to-5",
    (distance, counts, expected) => {
      expect(
        analyzeTransition(
          { xSteps: 0, ySteps: 0 },
          { xSteps: distance, ySteps: 0 },
          counts,
        ).stepSizeToFive,
      ).toBe(expected);
    },
  );

  test("returns the transition count at one and multiple five-yard crossings", () => {
    expect(
      analyzeTransition(
        { xSteps: -64, ySteps: 0 },
        { xSteps: -48, ySteps: 0 },
        8,
      ).yardLineCrossingCounts,
    ).toEqual([4]);
    expect(
      analyzeTransition(
        { xSteps: -64, ySteps: 0 },
        { xSteps: -40, ySteps: 0 },
        16,
      ).yardLineCrossingCounts,
    ).toEqual([5.333333, 10.666667]);
    expect(
      analyzeTransition(
        { xSteps: -60, ySteps: 0 },
        { xSteps: -44, ySteps: 0 },
        16,
      ).yardLineCrossingCounts,
    ).toEqual([4, 12]);
  });

  test("returns crossing counts in time order for reverse movement", () => {
    expect(
      analyzeTransition(
        { xSteps: -40, ySteps: 0 },
        { xSteps: -64, ySteps: 0 },
        16,
      ).yardLineCrossingCounts,
    ).toEqual([5.333333, 10.666667]);
  });

  test("excludes exact start and end yard lines", () => {
    expect(
      analyzeTransition(
        { xSteps: -64, ySteps: 0 },
        { xSteps: -56, ySteps: 0 },
        8,
      ).yardLineCrossingCounts,
    ).toEqual([]);
  });

  test("cleans floating-point values near integer and half counts", () => {
    expect(
      analyzeTransition(
        { xSteps: -64, ySteps: 0 },
        { xSteps: -48 + 1e-12, ySteps: 0 },
        8,
      ).yardLineCrossingCounts,
    ).toEqual([4]);
  });

  test("rejects fractional incoming counts", () => {
    expect(() =>
      analyzeTransition(
        { xSteps: 0, ySteps: 0 },
        { xSteps: 8, ySteps: 0 },
        2.5,
      ),
    ).toThrow("integer");
  });

  test("keeps derived values off persisted set records", () => {
    const current = set("2", -48, 8);
    analyzeDrillTransition(set("1", -64, 0), current);
    expect(current).not.toHaveProperty("stepSizeToFive");
    expect(current).not.toHaveProperty("yardLineCrossingCounts");
  });
});
