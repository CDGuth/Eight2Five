import type { DrillSet } from "@eight2five/mobile/drill";
import {
  formatMarchingFrontBack,
  formatMarchingSide,
  marchingCoordinateToDrillGridPoint,
} from "@eight2five/mobile/field";

import {
  createDefaultPageDraft,
  pageToDraft,
  validatePageDraft,
  type MarchingCoordinateDraft,
} from "../page-form";

const VALID_DRAFT: MarchingCoordinateDraft = {
  setNumber: "31",
  setKind: "subset",
  setSuffix: "A",
  countsFromPrevious: "16",
  measureStart: "126",
  measureEnd: "129",
  side: "2",
  yardLine: "40",
  sideRelation: "inside",
  sideOffsetSteps: "2.25",
  frontBackReference: "front-hash",
  frontBackRelation: "in-front-of",
  frontBackOffsetSteps: "4.5",
};

describe("structured marching coordinate form", () => {
  test("defaults the first entry to zero counts and a numeric set identity", () => {
    expect(
      createDefaultPageDraft({ ordinal: 0, suggestedNumber: 1 }),
    ).toMatchObject({
      setNumber: "1",
      setKind: "set",
      setSuffix: "",
      countsFromPrevious: "0",
      measureStart: "",
      measureEnd: "",
      side: "center",
      yardLine: "50",
      sideRelation: "on",
      frontBackReference: "front-sideline",
      frontBackRelation: "on",
    });
    expect(
      createDefaultPageDraft({ ordinal: 2, suggestedNumber: 7 })
        .countsFromPrevious,
    ).toBe("8");
  });

  test("converts structured fractional controls to the canonical drill grid", () => {
    const result = validatePageDraft(VALID_DRAFT);
    expect(result.errors).toEqual({});
    expect(result.value).toBeDefined();
    expect(formatMarchingSide(result.value!.coordinate.side)).toBe(
      "Side 2: 2.25 Steps inside 40 yd ln",
    );
    expect(formatMarchingFrontBack(result.value!.coordinate.frontBack)).toBe(
      "4.5 Steps in front of HS FH",
    );
    expect(result.value).toMatchObject({
      number: 31,
      kind: "subset",
      suffix: "A",
      countsFromPrevious: 16,
      measureRange: { start: 126, end: 129 },
    });
    expect(result.value!.position).toEqual(
      marchingCoordinateToDrillGridPoint(result.value!.coordinate),
    );
  });

  test.each([
    ["football-nfhs", 28],
    ["football-ncaa", 32],
    ["football-texas-uil", 32],
  ] as const)(
    "%s uses its schema-defined front-hash marching reference",
    (fieldPreset, expectedFrontHashSteps) => {
      const result = validatePageDraft(
        {
          ...VALID_DRAFT,
          frontBackRelation: "on",
          frontBackOffsetSteps: "0",
        },
        fieldPreset,
      );
      expect(result.value?.position.ySteps).toBeCloseTo(
        expectedFrontHashSteps,
        8,
      );
    },
  );

  test("NFL uses its schema-defined fractional front-hash marching reference", () => {
    const result = validatePageDraft(
      {
        ...VALID_DRAFT,
        frontBackRelation: "on",
        frontBackOffsetSteps: "0",
      },
      "football-nfl",
    );
    expect(result.value?.position.ySteps).toBeCloseTo(
      ((70 + 9 / 12) / 160) * 84,
      8,
    );
  });

  test("initializes controls through inverse grid conversion and round trips", () => {
    const position = marchingCoordinateToDrillGridPoint({
      side: { side: 1, yardLine: 35, relation: "outside", offsetSteps: 1.25 },
      frontBack: {
        reference: "back-hash",
        relation: "behind",
        offsetSteps: 3.75,
      },
    });
    const set: DrillSet = {
      id: "set-1",
      drillId: "drill",
      ordinal: 0,
      number: 47,
      kind: "set",
      countsFromPrevious: 12,
      measureRange: { start: 210, end: 214 },
      position,
    };
    const draft = pageToDraft(set);
    const roundTrip = validatePageDraft(draft);

    expect(draft).toMatchObject({
      setNumber: "47",
      setKind: "set",
      countsFromPrevious: "12",
      measureStart: "210",
      measureEnd: "214",
      side: "1",
      yardLine: "35",
      sideRelation: "outside",
      frontBackReference: "back-hash",
      frontBackRelation: "behind",
    });
    expect(roundTrip.value?.position.xSteps).toBeCloseTo(position.xSteps, 10);
    expect(roundTrip.value?.position.ySteps).toBeCloseTo(position.ySteps, 10);
  });

  test("normalizes zero offsets and the exact 50 to On with no side", () => {
    const result = validatePageDraft({
      ...VALID_DRAFT,
      side: "1",
      yardLine: "50",
      sideRelation: "outside",
      sideOffsetSteps: "0",
      frontBackRelation: "behind",
      frontBackOffsetSteps: "0",
    });

    expect(result.value?.coordinate.side).toEqual({
      side: "center",
      yardLine: 50,
      relation: "on",
      offsetSteps: 0,
    });
    expect(result.value?.coordinate.frontBack.relation).toBe("on");
  });

  test("returns actionable position, count, measure, relation, and bounds errors", () => {
    expect(
      validatePageDraft({
        ...VALID_DRAFT,
        setNumber: "-1",
        setSuffix: "aa",
        countsFromPrevious: "2.5",
        measureStart: "130",
        measureEnd: "129",
      }).errors,
    ).toMatchObject({
      setNumber: expect.stringContaining("position number"),
      setSuffix: expect.stringContaining("capital letter"),
      countsFromPrevious: expect.stringContaining("whole-number"),
      measureEnd: expect.stringContaining("after"),
    });
    expect(
      validatePageDraft({
        ...VALID_DRAFT,
        side: "center",
        yardLine: "45",
      }).errors.side,
    ).toContain("50-yard line");
  });
});
