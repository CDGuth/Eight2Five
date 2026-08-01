import {
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  fieldPointToMarchingCoordinate,
  formatMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
  marchingCoordinateToFieldPoint,
  standardStepsToMeters,
  yardsToMeters,
} from "../index";

const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;

describe("marching coordinate conversion", () => {
  test("formats exact side examples", () => {
    expect(
      formatMarchingSide(
        fieldPointToMarchingCoordinate({
          xMeters: yardsToMeters(60),
          yMeters: field.bounds.minYMeters,
        }).side,
      ),
    ).toBe("Side 2: On 40 yd ln");
    expect(
      formatMarchingSide(
        fieldPointToMarchingCoordinate({
          xMeters: yardsToMeters(35) + standardStepsToMeters(2),
          yMeters: field.bounds.minYMeters,
        }).side,
      ),
    ).toBe("Side 1: 2 Steps inside 35 yd ln");
    expect(
      formatMarchingSide(
        fieldPointToMarchingCoordinate({
          xMeters: yardsToMeters(60) + standardStepsToMeters(1.25),
          yMeters: field.bounds.minYMeters,
        }).side,
      ),
    ).toBe("Side 2: 1.25 Steps outside 40 yd ln");
    expect(
      formatMarchingSide(
        fieldPointToMarchingCoordinate({
          xMeters: yardsToMeters(50),
          yMeters: field.bounds.minYMeters,
        }).side,
      ),
    ).toBe("On 50 yd ln");
  });

  test("formats exact front/back examples", () => {
    const examples = [
      [field.bounds.minYMeters, "On Front Sideline"],
      [standardStepsToMeters(8), "8 Steps behind Front Sideline"],
      [
        field.frontHashLine.coordinateMeters - standardStepsToMeters(12),
        "12 Steps in front of HS FH",
      ],
      [field.frontHashLine.coordinateMeters, "On HS FH"],
      [
        field.frontHashLine.coordinateMeters + standardStepsToMeters(4),
        "4 Steps behind HS FH",
      ],
      [
        field.backHashLine.coordinateMeters - standardStepsToMeters(3.5),
        "3.5 Steps in front of HS BH",
      ],
      [field.bounds.maxYMeters, "On Back Sideline"],
    ] as const;

    for (const [yMeters, expected] of examples) {
      expect(
        formatMarchingFrontBack(
          fieldPointToMarchingCoordinate({
            xMeters: yardsToMeters(50),
            yMeters,
          }).frontBack,
        ),
      ).toBe(expected);
    }
  });

  test("keeps canonical fractional values while formatting quarter steps", () => {
    const coordinate = fieldPointToMarchingCoordinate({
      xMeters: yardsToMeters(35) + standardStepsToMeters(1.249999999),
      yMeters:
        field.frontHashLine.coordinateMeters +
        standardStepsToMeters(2.500000001),
    });
    expect(coordinate.side.offsetSteps).toBeCloseTo(1.249999999);
    expect(formatMarchingSide(coordinate.side)).toBe(
      "Side 1: 1.25 Steps inside 35 yd ln",
    );
    expect(formatMarchingFrontBack(coordinate.frontBack)).toBe(
      "2.5 Steps behind HS FH",
    );
  });

  test("uses centerward references for exact halfway ties", () => {
    const sideTie = fieldPointToMarchingCoordinate({
      xMeters: yardsToMeters(32.5),
      yMeters: field.bounds.minYMeters,
    });
    expect(sideTie.side).toMatchObject({
      side: 1,
      yardLine: 35,
      relation: "outside",
    });

    const lateralTie = fieldPointToMarchingCoordinate({
      xMeters: yardsToMeters(50),
      yMeters:
        (field.frontHashLine.coordinateMeters +
          field.backHashLine.coordinateMeters) /
        2,
    });
    expect(lateralTie.frontBack.reference).toBe("front-hash");
  });

  test("uses a side and outside terminology when the 50 is nearest", () => {
    const coordinate = fieldPointToMarchingCoordinate({
      xMeters: yardsToMeters(50) - standardStepsToMeters(1.5),
      yMeters: 0,
    });
    expect(formatMarchingSide(coordinate.side)).toBe(
      "Side 1: 1.5 Steps outside 50 yd ln",
    );
    expect(marchingCoordinateToFieldPoint(coordinate).xMeters).toBeCloseTo(
      yardsToMeters(50) - standardStepsToMeters(1.5),
    );
  });

  test("marks out-of-bounds points explicitly while retaining nearest references", () => {
    const coordinate = fieldPointToMarchingCoordinate({
      xMeters: -standardStepsToMeters(2),
      yMeters: field.bounds.maxYMeters + standardStepsToMeters(1.25),
    });
    expect(formatMarchingCoordinate(coordinate)).toBe(
      "Out of Bounds — Side 1: 2 Steps outside Goal Line; 1.25 Steps behind Back Sideline",
    );
    expect(coordinate.outOfBounds).toEqual(["goal-to-goal", "front-back"]);
  });

  test("round trips ordinary finite points without display quantization", () => {
    const points = [
      { xMeters: yardsToMeters(0), yMeters: 0 },
      { xMeters: yardsToMeters(12.345678), yMeters: 1.234567 },
      {
        xMeters: yardsToMeters(50),
        yMeters: field.frontHashLine.coordinateMeters,
      },
      { xMeters: yardsToMeters(87.654321), yMeters: 42.123456 },
      { xMeters: field.goalToGoalMeters, yMeters: field.widthMeters },
    ];
    for (const point of points) {
      const roundTrip = marchingCoordinateToFieldPoint(
        fieldPointToMarchingCoordinate(point),
      );
      expect(roundTrip.xMeters).toBeCloseTo(point.xMeters, 10);
      expect(roundTrip.yMeters).toBeCloseTo(point.yMeters, 10);
    }
  });

  test("rejects non-finite points", () => {
    expect(() =>
      fieldPointToMarchingCoordinate({ xMeters: Number.NaN, yMeters: 0 }),
    ).toThrow("xMeters");
    expect(() =>
      marchingCoordinateToFieldPoint({
        side: {
          side: 1,
          yardLine: 35,
          offsetSteps: -1,
          relation: "inside",
        },
        frontBack: {
          reference: "front-sideline",
          offsetSteps: 0,
          relation: "on",
        },
      }),
    ).toThrow("non-negative");
  });

  test("rejects contradictory structured coordinates", () => {
    expect(() =>
      marchingCoordinateToFieldPoint({
        side: {
          side: 1,
          yardLine: 50,
          offsetSteps: 1,
          relation: "inside",
        },
        frontBack: {
          reference: "front-sideline",
          offsetSteps: 0,
          relation: "on",
        },
      }),
    ).toThrow("50-yard line");
  });
});
