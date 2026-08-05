import {
  createStandardFootballFieldTemplate,
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  getStandardFieldDimensionsInFeet,
  getStandardFieldDimensionsInYards,
} from "../index";

describe("standard high-school field template", () => {
  test("contains canonical field dimensions and references", () => {
    const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
    expect(field.goalToGoalYards).toBe(100);
    expect(field.widthYards).toBeCloseTo(53 + 1 / 3);
    expect(field.goalToGoalMeters).toBeCloseTo(91.44);
    expect(field.widthMeters).toBeCloseTo(48.768);
    expect(field.dimensions.highSchoolHashFromSidelineFeet).toBeCloseTo(
      53 + 4 / 12,
    );
    expect(field.bounds.minXMeters).toBeCloseTo(-45.72);
    expect(field.bounds.maxXMeters).toBeCloseTo(45.72);
    expect(field.frontHashLine.coordinateMeters).toBeCloseTo(16.256);
    expect(field.backHashLine.coordinateMeters).toBeCloseTo(32.512);
  });

  test("contains goal lines, sidelines, hashes, and every interior five-yard line", () => {
    const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
    expect(field.goalLines.map((line) => line.name)).toEqual([
      "Side 1 Goal Line",
      "Side 2 Goal Line",
    ]);
    expect(field.sidelines.map((line) => line.name)).toEqual([
      "Front Sideline",
      "Back Sideline",
    ]);
    expect(field.hashLines.map((line) => line.name)).toEqual([
      "HS FH",
      "HS BH",
    ]);
    expect(field.fiveYardLines.map((line) => line.yardLineYards)).toEqual(
      Array.from({ length: 19 }, (_, index) => -45 + index * 5),
    );
    expect(field.fiveYardLines[0].start.xMeters).toBeCloseTo(-41.148);
    expect(field.fiveYardLines[18].start.xMeters).toBeCloseTo(41.148);
  });

  test("includes both number rows from goal line zero through the 50", () => {
    const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
    expect(field.yardNumbers).toHaveLength(22);
    expect(
      field.yardNumbers.filter((number) => number.label === "0"),
    ).toHaveLength(4);
    expect(
      field.yardNumbers.filter((number) => number.label === "50"),
    ).toHaveLength(2);
    expect(
      field.yardNumbers
        .filter((number) => number.side === "front")
        .map((number) => number.label),
    ).toEqual(["0", "10", "20", "30", "40", "50", "40", "30", "20", "10", "0"]);
    expect(
      field.yardNumbers.every(
        (number) =>
          number.xMeters ===
          field.allFiveYardLines.find(
            (line) => line.coordinateMeters === number.xMeters,
          )?.coordinateMeters,
      ),
    ).toBe(true);
    expect(field.yardNumbers.every((number) => number.widthMeters > 0)).toBe(
      true,
    );
    expect(field.yardNumbers.every((number) => number.heightMeters > 0)).toBe(
      true,
    );
  });

  test.each([
    ["football-nfhs", 24],
    ["football-ncaa", 24],
    ["football-texas-uil", 24],
    ["football-nfl", 39],
  ] as const)("%s uses schema-defined number centers", (preset, centerFeet) => {
    const field = createStandardFootballFieldTemplate(preset);
    const front = field.yardNumbers.find((number) => number.side === "front")!;
    const back = field.yardNumbers.find((number) => number.side === "back")!;

    expect(field.dimensions.yardNumberHeightFeet).toBeCloseTo(6);
    expect(field.dimensions.yardNumberCenterFromFrontSidelineFeet).toBeCloseTo(
      centerFeet,
    );
    expect(field.dimensions.yardNumberCenterFromBackSidelineFeet).toBeCloseTo(
      centerFeet,
    );
    expect(front.yMeters - field.bounds.minYMeters).toBeCloseTo(
      field.fieldDefinition.markings.yardNumbers.centerFromFrontSidelineMeters,
    );
    expect(field.bounds.maxYMeters - back.yMeters).toBeCloseTo(
      field.fieldDefinition.markings.yardNumbers.centerFromBackSidelineMeters,
    );
  });

  test("is deeply immutable", () => {
    const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE as any;
    expect(Object.isFrozen(field)).toBe(true);
    expect(Object.isFrozen(field.goalLines)).toBe(true);
    expect(Object.isFrozen(field.goalLines[0])).toBe(true);
    expect(Object.isFrozen(field.goalLines[0].start)).toBe(true);
    expect(() => {
      field.goalLines.push(field.goalLines[0]);
    }).toThrow();
  });

  test("offers display-unit dimension helpers", () => {
    expect(getStandardFieldDimensionsInFeet().goalToGoalFeet).toBeCloseTo(300);
    expect(getStandardFieldDimensionsInYards().widthYards).toBeCloseTo(160 / 3);
  });
});
