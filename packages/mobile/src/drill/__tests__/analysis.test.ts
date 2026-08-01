import {
  analyzeDrillTransition,
  analyzeTransition,
  type DrillPage,
} from "../index";
import { standardStepsToMeters, yardsToMeters } from "../../field";

function page(
  id: string,
  xYards: number,
  countsFromPrevious: number,
  yMeters = 0,
): DrillPage {
  return {
    id,
    drillId: "drill-1",
    ordinal: Number(id),
    label: id,
    countsFromPrevious,
    position: { xMeters: yardsToMeters(xYards), yMeters },
  };
}

describe("drill transition analysis", () => {
  test("omits derived rates for the first page", () => {
    expect(analyzeDrillTransition(undefined, page("1", 10, 0))).toEqual({
      distanceSteps: 0,
      isHalt: false,
      yardLineCrossingCounts: [],
    });
  });

  test("omits step size and crossing counts for zero counts", () => {
    const analysis = analyzeDrillTransition(page("1", 10, 0), page("2", 20, 0));
    expect(analysis.distanceSteps).toBe(16);
    expect(analysis.stepSizeToFive).toBeUndefined();
    expect(analysis.yardLineCrossingCounts).toEqual([]);
  });

  test("recognizes a same-position positive-count halt", () => {
    const analysis = analyzeDrillTransition(
      page("1", 40, 0),
      page("2", 40, 16),
    );
    expect(analysis).toMatchObject({ distanceSteps: 0, isHalt: true });
    expect(analysis.stepSizeToFive).toBeUndefined();
  });

  test.each([
    [standardStepsToMeters(8), 8, 8],
    [standardStepsToMeters(4.5), 8, 14.25],
    [standardStepsToMeters(16), 13, 6.5],
  ])(
    "derives %s meters over %s counts as %s-to-5",
    (distance, counts, expected) => {
      expect(
        analyzeTransition(
          { xMeters: 0, yMeters: 0 },
          { xMeters: distance, yMeters: 0 },
          counts,
        ).stepSizeToFive,
      ).toBe(expected);
    },
  );

  test("returns the transition count at one and multiple line crossings", () => {
    expect(
      analyzeTransition(
        { xMeters: yardsToMeters(10), yMeters: 0 },
        { xMeters: yardsToMeters(20), yMeters: 0 },
        8,
      ).yardLineCrossingCounts,
    ).toEqual([4]);
    expect(
      analyzeTransition(
        { xMeters: yardsToMeters(10), yMeters: 0 },
        { xMeters: yardsToMeters(25), yMeters: 0 },
        16,
      ).yardLineCrossingCounts,
    ).toEqual([5.333333, 10.666667]);
    expect(
      analyzeTransition(
        { xMeters: yardsToMeters(12.5), yMeters: 0 },
        { xMeters: yardsToMeters(22.5), yMeters: 0 },
        16,
      ).yardLineCrossingCounts,
    ).toEqual([4, 12]);
  });

  test("returns crossing counts in time order for reverse movement", () => {
    expect(
      analyzeTransition(
        { xMeters: yardsToMeters(25), yMeters: 0 },
        { xMeters: yardsToMeters(10), yMeters: 0 },
        16,
      ).yardLineCrossingCounts,
    ).toEqual([5.333333, 10.666667]);
  });

  test("excludes exact start and end yard lines", () => {
    expect(
      analyzeTransition(
        { xMeters: yardsToMeters(10), yMeters: 0 },
        { xMeters: yardsToMeters(15), yMeters: 0 },
        8,
      ).yardLineCrossingCounts,
    ).toEqual([]);
  });

  test("cleans floating-point values near integer and half counts", () => {
    expect(
      analyzeTransition(
        { xMeters: yardsToMeters(10), yMeters: 0 },
        { xMeters: yardsToMeters(20) + 1e-12, yMeters: 0 },
        8,
      ).yardLineCrossingCounts,
    ).toEqual([4]);
  });

  test("keeps derived values off persisted page records", () => {
    const current = page("2", 20, 8);
    analyzeDrillTransition(page("1", 10, 0), current);
    expect(current).not.toHaveProperty("stepSizeToFive");
    expect(current).not.toHaveProperty("yardLineCrossingCounts");
  });
});
