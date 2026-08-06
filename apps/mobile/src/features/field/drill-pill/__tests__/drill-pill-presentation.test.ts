import {
  getCountMetricPresentation,
  getTransitionMetricPresentation,
} from "../drill-pill-presentation";

describe("drill pill metric modes", () => {
  const rows = [
    {
      term: "Set" as const,
      set: "1",
      counts: "0",
      measures: "1",
      metricLabel: "xCounts" as const,
      metric: "–",
      coordinate: null,
    },
    {
      term: "Set" as const,
      set: "2",
      counts: "16",
      measures: "2–3",
      metricLabel: "xCounts" as const,
      metric: "8",
      coordinate: null,
    },
  ];

  test("applies one count mode coherently to every visible row", () => {
    expect(
      rows.map((row) => getCountMetricPresentation(row, "measures")),
    ).toMatchObject([
      { key: "measures", label: "Measures", value: "1", direction: 1 },
      { key: "measures", label: "Measures", value: "2–3", direction: 1 },
    ]);
  });

  test("uses the same animated contract for transition modes", () => {
    expect(
      rows.map((row) =>
        getTransitionMetricPresentation(row, "crossing-counts"),
      ),
    ).toMatchObject([
      { key: "crossing-counts", label: "xCounts", direction: 1 },
      { key: "crossing-counts", label: "xCounts", direction: 1 },
    ]);
  });
});
