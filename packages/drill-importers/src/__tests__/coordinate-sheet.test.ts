import {
  importCoordinateSheetPages,
  parseFrontBack,
  parseMeasureRange,
  parseSetIdentity,
  parseSideToSide,
  type ExtractedPdfPage,
  type ExtractedPdfTextItem,
} from "..";

function item(text: string, x: number, y: number): ExtractedPdfTextItem {
  return { text, x, y, width: Math.max(8, text.length * 5), height: 10 };
}

function sheetItems({
  offsetX,
  offsetY = 0,
  performer,
  symbol,
  label,
  id,
  sideShift = 0,
}: {
  offsetX: number;
  offsetY?: number;
  performer: string;
  symbol: string;
  label: string;
  id: string;
  sideShift?: number;
}): ExtractedPdfTextItem[] {
  const x = (value: number) => offsetX + value;
  const y = (value: number) => offsetY + value;
  return [
    item(
      `Performer: ${performer} Symbol: ${symbol} Label: ${label} ID:${id} Part 4`,
      x(0),
      y(760),
    ),
    item("Set", x(0), y(720)),
    item("Measure", x(55), y(720)),
    item("Counts", x(115), y(720)),
    item("Side 1-Side 2", x(170), y(720)),
    item("Front-Back", x(300), y(720)),
    item("31", x(0), y(700)),
    item("0", x(55), y(700)),
    item("0", x(115), y(700)),
    item("Side 1: On 45 yd ln", x(170), y(700)),
    item("On Front side line", x(300), y(700)),
    item("32", x(0), y(680)),
    item("126-129", x(55), y(680)),
    item("16", x(115), y(680)),
    item(
      `Side 2: ${4 + sideShift}.0 steps Inside 45 yd ln`,
      x(170),
      y(680),
    ),
    item("4.0 steps Behind Front Hash (HS)", x(300), y(680)),
  ];
}

const TWO_UP_PAGE: ExtractedPdfPage = {
  pageNumber: 1,
  width: 800,
  height: 800,
  items: [
    ...sheetItems({
      offsetX: 20,
      performer: "Ada Lovelace",
      symbol: "B",
      label: "1",
      id: "1595433022185",
    }),
    ...sheetItems({
      offsetX: 420,
      performer: "Grace Hopper",
      symbol: "$",
      label: "2",
      id: "1595433022186",
    }),
  ],
};

describe("coordinate sheet importer", () => {
  test("parses two side-by-side Pyware sheets into one portable drill", () => {
    const result = importCoordinateSheetPages([TWO_UP_PAGE], {
      title: "Part 4",
      fileName: "Part 4 Coordinates.pdf",
      createdAt: "2026-08-02T18:00:00.000Z",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.sheets).toHaveLength(2);
    expect(result.sheets.map((sheet) => sheet.displayLabel)).toEqual(["B1", "$2"]);
    expect(result.document).toBeDefined();
    expect(result.document?.sets).toEqual([
      {
        id: 0,
        number: 31,
        kind: "set",
        countsFromPrevious: 0,
        measureRange: { start: 0, end: 0 },
      },
      {
        id: 1,
        number: 32,
        kind: "set",
        countsFromPrevious: 16,
        measureRange: { start: 126, end: 129 },
      },
    ]);
    expect(result.document?.entities).toMatchObject([
      {
        id: 1595433022185,
        symbol: "B",
        label: "B1",
        name: "Ada Lovelace",
      },
      {
        id: 1595433022186,
        symbol: "$",
        label: "$2",
        name: "Grace Hopper",
      },
    ]);
    expect(result.document?.positions).toEqual([
      { entityId: 1595433022185, setId: 0, xSteps: -8, ySteps: 0 },
      { entityId: 1595433022185, setId: 1, xSteps: 4, ySteps: 32 },
      { entityId: 1595433022186, setId: 0, xSteps: -8, ySteps: 0 },
      { entityId: 1595433022186, setId: 1, xSteps: 4, ySteps: 32 },
    ]);
  });

  test("splits four-up physical pages into logical sheets in row-major order", () => {
    const fourUpPage: ExtractedPdfPage = {
      pageNumber: 1,
      width: 800,
      height: 800,
      items: [
        ...sheetItems({
          offsetX: 20,
          performer: "Top Left",
          symbol: "B",
          label: "1",
          id: "101",
        }),
        ...sheetItems({
          offsetX: 420,
          performer: "Top Right",
          symbol: "B",
          label: "2",
          id: "102",
        }),
        ...sheetItems({
          offsetX: 20,
          offsetY: -400,
          performer: "Bottom Left",
          symbol: "C",
          label: "1",
          id: "103",
        }),
        ...sheetItems({
          offsetX: 420,
          offsetY: -400,
          performer: "Bottom Right",
          symbol: "C",
          label: "2",
          id: "104",
        }),
      ],
    };
    const finalPartialPage: ExtractedPdfPage = {
      pageNumber: 2,
      width: 800,
      height: 800,
      items: [
        ...sheetItems({
          offsetX: 20,
          performer: "Tenth Trumpet",
          symbol: "T",
          label: "10",
          id: "105",
        }),
        ...sheetItems({
          offsetX: 420,
          performer: "(unnamed)",
          symbol: "X",
          label: "(unlabeled)",
          id: "639161623594264901",
        }),
      ],
    };

    const result = importCoordinateSheetPages([fourUpPage, finalPartialPage], {
      title: "Part 4",
      createdAt: "2026-08-02T18:00:00.000Z",
    });

    expect(result.sheets).toHaveLength(6);
    expect(result.sheets.map((sheet) => sheet.displayLabel)).toEqual([
      "B1",
      "B2",
      "C1",
      "C2",
      "T10",
      "X",
    ]);
    expect(result.sheets.every((sheet) => sheet.rows.length === 2)).toBe(true);
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SET_COUNT_MISMATCH" }),
        expect.objectContaining({ code: "SOURCE_IDS_REASSIGNED" }),
      ]),
    );
    expect(result.document?.entities.map((entity) => entity.id)).toEqual([
      101,
      102,
      103,
      104,
      105,
      0,
    ]);
    expect(result.document?.extensions?.["eight2five.coordinateSheet"]).toMatchObject({
      sheets: expect.arrayContaining([
        expect.objectContaining({
          entityId: 0,
          sourceId: "639161623594264901",
        }),
      ]),
    });
    expect(result.document).toBeDefined();
  });

  test("rejects global set metadata disagreements instead of silently choosing one", () => {
    const mismatched: ExtractedPdfPage = {
      ...TWO_UP_PAGE,
      items: [
        ...sheetItems({
          offsetX: 20,
          performer: "Ada Lovelace",
          symbol: "B",
          label: "1",
          id: "1595433022185",
        }),
        ...sheetItems({
          offsetX: 420,
          performer: "Grace Hopper",
          symbol: "$",
          label: "2",
          id: "1595433022186",
          sideShift: 1,
        }).map((entry) =>
          entry.text === "16" && entry.y === 680
            ? { ...entry, text: "12" }
            : entry,
        ),
      ],
    };

    const result = importCoordinateSheetPages([mismatched], {
      title: "Part 4",
      createdAt: "2026-08-02T18:00:00.000Z",
    });
    expect(result.document).toBeUndefined();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "error", code: "COUNTS_MISMATCH" }),
      ]),
    );
  });

  test("supports Pyware coordinate wording and conventional NFHS hashes", () => {
    expect(parseSideToSide("On 50 yd ln")).toBe(0);
    expect(parseSideToSide("Side 1: On 45 yd ln")).toBe(-8);
    expect(parseSideToSide("Side 1: 2.0 steps Outside 50 yd ln")).toBe(-2);
    expect(parseSideToSide("Side 2: 4.0 steps Inside 45 yd ln")).toBe(4);
    expect(parseFrontBack("On Front side line")).toBe(0);
    expect(parseFrontBack("4.0 steps Behind Front Hash (HS)")).toBe(32);
    expect(parseFrontBack("3.5 steps In Front Of Back Hash (HS)")).toBe(52.5);
    expect(parseFrontBack("On Back Sideline")).toBe(84);
    expect(
      parseFrontBack("On Front Hash", {
        type: "preset",
        preset: "football-ncaa",
      }),
    ).toBe(32);
  });

  test("keeps set identity and measure ranges structured", () => {
    expect(parseSetIdentity("31A")).toEqual({
      number: 31,
      suffix: "A",
      kind: "subset",
    });
    expect(parseSetIdentity("31.5")).toEqual({
      number: 31,
      suffix: ".5",
      kind: "subset",
    });
    expect(parseMeasureRange("126-129")).toEqual({ start: 126, end: 129 });
    expect(parseMeasureRange("0")).toEqual({ start: 0, end: 0 });
  });
});
