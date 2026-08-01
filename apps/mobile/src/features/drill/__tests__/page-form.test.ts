import type { DrillRepository } from "@eight2five/mobile/drill";
import {
  formatMarchingFrontBack,
  formatMarchingSide,
  marchingCoordinateToFieldPoint,
} from "@eight2five/mobile/field";

import {
  createDefaultPageDraft,
  pageToDraft,
  validatePageDraft,
  type MarchingCoordinateDraft,
} from "../page-form";
import { savePageDraft } from "../page-management";

const VALID_DRAFT: MarchingCoordinateDraft = {
  label: "31A",
  countsFromPrevious: "16",
  side: "2",
  yardLine: "40",
  sideRelation: "inside",
  sideOffsetSteps: "2.25",
  frontBackReference: "front-hash",
  frontBackRelation: "in-front-of",
  frontBackOffsetSteps: "4.5",
};

describe("structured marching coordinate form", () => {
  test("defaults the first entry to zero counts without copying a coordinate", () => {
    expect(
      createDefaultPageDraft({ ordinal: 0, suggestedLabel: "1" }),
    ).toMatchObject({
      label: "1",
      countsFromPrevious: "0",
      side: "center",
      yardLine: "50",
      sideRelation: "on",
      frontBackReference: "front-sideline",
      frontBackRelation: "on",
    });
    expect(
      createDefaultPageDraft({ ordinal: 2, suggestedLabel: "New" })
        .countsFromPrevious,
    ).toBe("8");
  });

  test("converts structured fractional controls to one canonical FieldPoint", () => {
    const result = validatePageDraft(VALID_DRAFT);
    expect(result.errors).toEqual({});
    expect(result.value).toBeDefined();
    expect(formatMarchingSide(result.value!.coordinate.side)).toBe(
      "Side 2: 2.25 Steps inside 40 yd ln",
    );
    expect(formatMarchingFrontBack(result.value!.coordinate.frontBack)).toBe(
      "4.5 Steps in front of HS FH",
    );
    expect(result.value!.countsFromPrevious).toBe(16);
  });

  test("initializes controls through inverse conversion and round trips", () => {
    const position = marchingCoordinateToFieldPoint({
      side: { side: 1, yardLine: 35, relation: "outside", offsetSteps: 1.25 },
      frontBack: {
        reference: "back-hash",
        relation: "behind",
        offsetSteps: 3.75,
      },
    });
    const draft = pageToDraft({
      label: "Finale",
      countsFromPrevious: 12,
      position,
    });
    const roundTrip = validatePageDraft(draft);

    expect(draft).toMatchObject({
      label: "Finale",
      countsFromPrevious: "12",
      side: "1",
      yardLine: "35",
      sideRelation: "outside",
      frontBackReference: "back-hash",
      frontBackRelation: "behind",
    });
    expect(roundTrip.value?.position.xMeters).toBeCloseTo(position.xMeters, 10);
    expect(roundTrip.value?.position.yMeters).toBeCloseTo(position.yMeters, 10);
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

  test("returns actionable metadata, numeric, relation, and bounds errors", () => {
    expect(
      validatePageDraft({
        ...VALID_DRAFT,
        label: " ",
        countsFromPrevious: "-1",
      }).errors,
    ).toMatchObject({
      label: expect.stringContaining("label"),
      countsFromPrevious: expect.stringContaining("non-negative"),
    });
    expect(
      validatePageDraft({
        ...VALID_DRAFT,
        side: "center",
        yardLine: "45",
      }).errors.side,
    ).toContain("50-yard line");
    expect(
      validatePageDraft({
        ...VALID_DRAFT,
        side: "1",
        yardLine: "0",
        sideRelation: "outside",
        sideOffsetSteps: "0.25",
      }).errors.coordinate,
    ).toContain("field bounds");
  });

  test("persists canonical create and edit payloads", async () => {
    const createdPage = {
      id: "page-new",
      drillId: "drill",
      ordinal: 0,
      label: "31A",
      countsFromPrevious: 16,
      position: validatePageDraft(VALID_DRAFT).value!.position,
    };
    const repository = {
      createPage: jest.fn(async () => createdPage),
      updatePage: jest.fn(async () => createdPage),
    } as unknown as DrillRepository;

    await savePageDraft({
      repository,
      drillId: "drill",
      pageId: "new",
      pages: [],
      placement: "append",
      draft: VALID_DRAFT,
    });
    expect(repository.createPage).toHaveBeenCalledWith({
      drillId: "drill",
      label: "31A",
      countsFromPrevious: 16,
      position: createdPage.position,
    });

    await savePageDraft({
      repository,
      drillId: "drill",
      pageId: "page-new",
      pages: [createdPage],
      placement: "append",
      draft: VALID_DRAFT,
    });
    expect(repository.updatePage).toHaveBeenCalledWith("page-new", {
      label: "31A",
      countsFromPrevious: 16,
      position: createdPage.position,
    });
  });
});
