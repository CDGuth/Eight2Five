import {
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  drillGridPointToFieldPoint,
  fieldPointToMarchingCoordinate,
  formatMarchingCoordinate,
  formatMarchingFrontBack,
  formatMarchingSide,
  marchingCoordinateToDrillGridPoint,
  marchingCoordinateToFieldPoint,
  standardStepsToMeters,
} from "../index";

const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;

function gridPoint(xSteps: number, ySteps: number) {
  return drillGridPointToFieldPoint({ xSteps, ySteps });
}

describe("marching coordinate conversion", () => {
  test("formats exact side examples in the centered field convention", () => {
    expect(
      formatMarchingSide(
        fieldPointToMarchingCoordinate(gridPoint(16, 0)).side,
      ),
    ).toBe("Side 2: On 40 yd ln");
    expect(
      formatMarchingSide(
        fieldPointToMarchingCoordinate(gridPoint(-24 + 2, 0)).side,
      ),
    ).toBe("Side 1: 2 Steps inside 35 yd ln");
    expect(
      formatMarchingSide(
        fieldPointToMarchingCoordinate(gridPoint(16 + 1.25, 0)).side,
      ),
    ).toBe("Side 2: 1.25 Steps outside 40 yd ln");
    expect(
      formatMarchingSide(fieldPointToMarchingCoordinate(gridPoint(0, 0)).side),
    ).toBe("On 50 yd ln");
  });

  test("uses the conventional 0/28/56/84 NFHS marching grid", () => {
    const examples = [
      [0, "On Front Sideline"],
      [8, "8 Steps behind Front Sideline"],
      [16, "12 Steps in front of HS FH"],
      [28, "On HS FH"],
      [32, "4 Steps behind HS FH"],
      [52.5, "3.5 Steps in front of HS BH"],
      [84, "On Back Sideline"],
    ] as const;

    for (const [ySteps, expected] of examples) {
      expect(
        formatMarchingFrontBack(
          fieldPointToMarchingCoordinate(gridPoint(0, ySteps)).frontBack,
        ),
      ).toBe(expected);
    }
  });

  test("keeps canonical fractional values while formatting quarter steps", () => {
    const coordinate = fieldPointToMarchingCoordinate(
      gridPoint(-24 + 1.249999999, 28 + 2.500000001),
    );
    expect(coordinate.side.offsetSteps).toBeCloseTo(1.249999999);
    expect(formatMarchingSide(coordinate.side)).toBe(
      "Side 1: 1.25 Steps inside 35 yd ln",
    );
    expect(formatMarchingFrontBack(coordinate.frontBack)).toBe(
      "2.5 Steps behind HS FH",
    );
  });

  test("uses centerward references for exact halfway ties", () => {
    const sideTie = fieldPointToMarchingCoordinate(gridPoint(-28, 0));
    expect(sideTie.side).toMatchObject({
      side: 1,
      yardLine: 35,
      relation: "outside",
    });

    const lateralTie = fieldPointToMarchingCoordinate(gridPoint(0, 42));
    expect(lateralTie.frontBack.reference).toBe("front-hash");
  });

  test("uses a side and outside terminology when the 50 is nearest", () => {
    const coordinate = fieldPointToMarchingCoordinate(gridPoint(-1.5, 0));
    expect(formatMarchingSide(coordinate.side)).toBe(
      "Side 1: 1.5 Steps outside 50 yd ln",
    );
    expect(marchingCoordinateToDrillGridPoint(coordinate).xSteps).toBeCloseTo(
      -1.5,
    );
    expect(marchingCoordinateToFieldPoint(coordinate).xMeters).toBeCloseTo(
      -standardStepsToMeters(1.5),
    );
  });

  test("marks out-of-bounds points explicitly while retaining nearest references", () => {
    const coordinate = fieldPointToMarchingCoordinate(gridPoint(-82, 85.25));
    expect(formatMarchingCoordinate(coordinate)).toBe(
      "Out of Bounds — Side 1: 2 Steps outside Goal Line; 1.25 Steps behind Back Sideline",
    );
    expect(coordinate.outOfBounds).toEqual(["goal-to-goal", "front-back"]);
  });

  test("round trips ordinary finite physical points without display quantization", () => {
    const points = [
      gridPoint(-80, 0),
      gridPoint(-41.234567, 2.345678),
      gridPoint(0, 28),
      gridPoint(52.654321, 71.123456),
      gridPoint(80, 84),
    ];
    for (const point of points) {
      const roundTrip = marchingCoordinateToFieldPoint(
        fieldPointToMarchingCoordinate(point),
      );
      expect(roundTrip.xMeters).toBeCloseTo(point.xMeters, 10);
      expect(roundTrip.yMeters).toBeCloseTo(point.yMeters, 10);
    }
  });

  test("keeps exact physical NFHS hash geometry separate from the marching grid", () => {
    const frontHash = gridPoint(0, 28);
    expect(frontHash.xMeters).toBeCloseTo(0);
    expect(frontHash.yMeters).toBeCloseTo(field.frontHashLine.coordinateMeters);
    expect(field.frontHashLine.coordinateMeters).not.toBeCloseTo(
      standardStepsToMeters(28),
      4,
    );
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
