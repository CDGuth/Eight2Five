import { formatTransitionAnalysis } from "../transition-presentation";

describe("transition presentation", () => {
  test("rounds yard-line crossing xCounts to the nearest whole count", () => {
    expect(
      formatTransitionAnalysis(
        {
          distanceSteps: 24,
          stepSizeToFive: 5.33,
          isHalt: false,
          yardLineCrossingCounts: [0.2, 5.333333, 10.666667],
        },
        true,
        16,
      ).crossingCounts,
    ).toBe("1, 5, 11");
  });
});
