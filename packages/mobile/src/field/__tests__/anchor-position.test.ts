import { FIELD_PRESET_IDS } from "@eight2five/drill-schema";
import {
  ANCHOR_POSITION_REFERENCES,
  ANCHOR_POSITION_REFERENCE_POINTS,
  ANCHOR_POSITION_UNITS,
  MAX_ANCHOR_HEIGHT_METERS,
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  anchorFieldPositionFromMarchingCoordinate,
  anchorFieldPositionFromStandard,
  anchorFieldPositionToStandard,
  convertAnchorPositionUnits,
  createStandardFootballFieldTemplate,
  getAnchorPositionReferencePoint,
  metersToAnchorPositionUnits,
  drillGridPointToFieldPoint,
  parseAnchorPositionDraft,
  yardsToMeters,
} from "../index";

const field = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE;
const PRESETS = FIELD_PRESET_IDS;

describe("shared anchor position domain", () => {
  test("defines exactly the standard references and their field points", () => {
    expect(ANCHOR_POSITION_REFERENCES).toEqual([
      "center-field",
      "center-front-sideline",
      "center-back-sideline",
      "side-1-front-corner",
      "side-1-back-corner",
      "side-2-front-corner",
      "side-2-back-corner",
      "side-1-goal-line-center",
      "side-2-goal-line-center",
      "front-hash-center",
      "back-hash-center",
    ]);
    expect(Object.keys(ANCHOR_POSITION_REFERENCE_POINTS)).toHaveLength(11);
    expect(
      ANCHOR_POSITION_REFERENCES.map((reference) =>
        getAnchorPositionReferencePoint(reference),
      ),
    ).toEqual([
      { xMeters: 0, yMeters: field.widthMeters / 2 },
      { xMeters: 0, yMeters: 0 },
      { xMeters: 0, yMeters: field.widthMeters },
      { xMeters: field.bounds.minXMeters, yMeters: 0 },
      { xMeters: field.bounds.minXMeters, yMeters: field.widthMeters },
      { xMeters: field.bounds.maxXMeters, yMeters: 0 },
      { xMeters: field.bounds.maxXMeters, yMeters: field.widthMeters },
      { xMeters: field.bounds.minXMeters, yMeters: field.widthMeters / 2 },
      { xMeters: field.bounds.maxXMeters, yMeters: field.widthMeters / 2 },
      { xMeters: 0, yMeters: field.frontHashLine.coordinateMeters },
      { xMeters: 0, yMeters: field.backHashLine.coordinateMeters },
    ]);
    expect(getAnchorPositionReferencePoint("center-field")).toEqual({
      xMeters: 0,
      yMeters: field.widthMeters / 2,
    });
    expect(getAnchorPositionReferencePoint("front-hash-center")).toEqual({
      xMeters: 0,
      yMeters: field.frontHashLine.coordinateMeters,
    });
    expect(getAnchorPositionReferencePoint("side-2-goal-line-center")).toEqual({
      xMeters: field.bounds.maxXMeters,
      yMeters: field.widthMeters / 2,
    });
  });

  test.each(PRESETS)(
    "%s derives hash reference points from the active field preset",
    (preset) => {
      const template = createStandardFootballFieldTemplate(preset);
      expect(
        getAnchorPositionReferencePoint("front-hash-center", preset),
      ).toEqual({
        xMeters: 0,
        yMeters: template.frontHashLine.coordinateMeters,
      });
      expect(
        getAnchorPositionReferencePoint("back-hash-center", preset),
      ).toEqual({
        xMeters: 0,
        yMeters: template.backHashLine.coordinateMeters,
      });
    },
  );

  test("converts all supported units through one canonical meter path", () => {
    expect(ANCHOR_POSITION_UNITS).toEqual(["meters", "yards", "feet"]);
    const meters = anchorFieldPositionFromStandard({
      reference: "center-field",
      unit: "meters",
      sideToSideOffset: 1.25,
      frontToBackOffset: -2.5,
      height: 3,
    });
    const yards = anchorFieldPositionFromStandard({
      reference: "center-field",
      unit: "yards",
      sideToSideOffset: 1.25 / 0.9144,
      frontToBackOffset: -2.5 / 0.9144,
      height: 3 / 0.9144,
    });
    const feet = anchorFieldPositionFromStandard({
      reference: "center-field",
      unit: "feet",
      sideToSideOffset: 1.25 / 0.3048,
      frontToBackOffset: -2.5 / 0.3048,
      height: 3 / 0.3048,
    });
    expect(yards).toEqual({
      xMeters: expect.closeTo(meters.xMeters, 10),
      yMeters: expect.closeTo(meters.yMeters, 10),
      zMeters: expect.closeTo(meters.zMeters, 10),
    });
    expect(feet).toEqual({
      xMeters: expect.closeTo(meters.xMeters, 10),
      yMeters: expect.closeTo(meters.yMeters, 10),
      zMeters: expect.closeTo(meters.zMeters, 10),
    });
    expect(convertAnchorPositionUnits(10, "yards", "feet")).toBeCloseTo(30);
    expect(metersToAnchorPositionUnits(1, "feet")).toBeCloseTo(1 / 0.3048);
  });

  test("applies signed offsets in the documented field directions", () => {
    const center = anchorFieldPositionFromStandard({
      reference: "center-field",
      unit: "meters",
      sideToSideOffset: 0,
      frontToBackOffset: 0,
      height: 0,
    });
    const shifted = anchorFieldPositionFromStandard({
      reference: "center-field",
      unit: "meters",
      sideToSideOffset: 2,
      frontToBackOffset: -3,
      height: 1,
    });
    expect(shifted.xMeters).toBe(center.xMeters + 2);
    expect(shifted.yMeters).toBe(center.yMeters - 3);
    expect(shifted.zMeters).toBe(1);

    const side1 = anchorFieldPositionFromStandard({
      reference: "side-1-front-corner",
      unit: "yards",
      sideToSideOffset: 5,
      frontToBackOffset: 5,
      height: 1,
    });
    expect(side1.xMeters).toBeCloseTo(
      field.bounds.minXMeters + yardsToMeters(5),
    );
    expect(side1.yMeters).toBeCloseTo(yardsToMeters(5));

    const inverse = anchorFieldPositionToStandard(
      shifted,
      "center-field",
      "meters",
    );
    expect(inverse).toEqual({
      reference: "center-field",
      unit: "meters",
      sideToSideOffset: 2,
      frontToBackOffset: -3,
      height: 1,
    });
  });

  test("reuses marching conversion for horizontal coordinates and adds height", () => {
    const coordinate = {
      side: {
        side: 2 as const,
        yardLine: 40,
        relation: "inside" as const,
        offsetSteps: 1.5,
      },
      frontBack: {
        reference: "front-hash" as const,
        relation: "behind" as const,
        offsetSteps: 2.25,
      },
    };
    const expected = anchorFieldPositionFromMarchingCoordinate(coordinate, 2.4);
    const projected = drillGridPointToFieldPoint({
      xSteps: 16 - 1.5,
      ySteps: 28 + 2.25,
    });
    expect(expected.xMeters).toBeCloseTo(projected.xMeters);
    expect(expected.yMeters).toBeCloseTo(projected.yMeters);
    expect(expected.zMeters).toBe(2.4);
  });

  test.each(PRESETS)(
    "%s projects marching anchor coordinates with that preset's hash convention",
    (preset) => {
      const position = anchorFieldPositionFromMarchingCoordinate(
        {
          side: {
            side: "center",
            yardLine: 50,
            relation: "on",
            offsetSteps: 0,
          },
          frontBack: {
            reference: "front-hash",
            relation: "on",
            offsetSteps: 0,
          },
        },
        2,
        preset,
      );
      const template = createStandardFootballFieldTemplate(preset);
      expect(position.yMeters).toBeCloseTo(
        template.frontHashLine.coordinateMeters,
        8,
      );
      expect(position.zMeters).toBe(2);
    },
  );

  test("parses drafts and rejects empty, non-finite, out-of-field, and excessive values", () => {
    expect(
      parseAnchorPositionDraft({
        reference: "center-field",
        unit: "feet",
        sideToSideOffset: "3",
        frontToBackOffset: "-4",
        height: "6",
      }),
    ).toEqual({
      errors: {},
      value: expect.objectContaining({
        zMeters: expect.closeTo(6 * 0.3048, 10),
      }),
    });

    expect(
      parseAnchorPositionDraft({
        reference: "center-field",
        unit: "meters",
        sideToSideOffset: "",
        frontToBackOffset: "",
        height: "",
      }).errors,
    ).toMatchObject({
      sideToSideOffset: expect.any(String),
      frontToBackOffset: expect.any(String),
      height: expect.any(String),
    });
    expect(
      parseAnchorPositionDraft({
        reference: "center-field",
        unit: "meters",
        sideToSideOffset: "NaN",
        frontToBackOffset: "Infinity",
        height: "",
      }).errors,
    ).toMatchObject({
      sideToSideOffset: expect.any(String),
      frontToBackOffset: expect.any(String),
      height: expect.any(String),
    });
    expect(
      parseAnchorPositionDraft({
        reference: "side-1-front-corner",
        unit: "meters",
        sideToSideOffset: "-0.01",
        frontToBackOffset: "0",
        height: "0",
      }).errors.position,
    ).toContain("standard field bounds");
    expect(
      parseAnchorPositionDraft({
        reference: "center-field",
        unit: "meters",
        sideToSideOffset: "0",
        frontToBackOffset: "0",
        height: "-1",
      }).errors.height,
    ).toContain("negative");
    expect(
      parseAnchorPositionDraft({
        reference: "center-field",
        unit: "meters",
        sideToSideOffset: "0",
        frontToBackOffset: "0",
        height: String(MAX_ANCHOR_HEIGHT_METERS + 1),
      }).errors.position,
    ).toContain("at most");
  });

  test("throws instead of silently clamping invalid canonical and standard values", () => {
    expect(() =>
      anchorFieldPositionFromStandard({
        reference: "side-1-front-corner",
        unit: "meters",
        sideToSideOffset: -1,
        frontToBackOffset: 0,
        height: 0,
      }),
    ).toThrow("standard field bounds");
    expect(() =>
      anchorFieldPositionFromStandard({
        reference: "center-field",
        unit: "meters",
        sideToSideOffset: 0,
        frontToBackOffset: 0,
        height: -0.1,
      }),
    ).toThrow("negative");
    expect(() =>
      anchorFieldPositionFromMarchingCoordinate(
        {
          side: {
            side: 1,
            yardLine: 0,
            relation: "outside",
            offsetSteps: 1,
          },
          frontBack: {
            reference: "front-sideline",
            relation: "on",
            offsetSteps: 0,
          },
        },
        1,
      ),
    ).toThrow("standard field bounds");
  });

  test("does not add a quality field to canonical positions", () => {
    const position = anchorFieldPositionFromStandard({
      reference: "center-field",
      unit: "meters",
      sideToSideOffset: 0,
      frontToBackOffset: 0,
      height: 1,
    });
    expect(position).not.toHaveProperty("quality");
    expect(Object.keys(position)).toEqual(["xMeters", "yMeters", "zMeters"]);
  });
});
