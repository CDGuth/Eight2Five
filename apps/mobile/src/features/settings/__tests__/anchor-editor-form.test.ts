import { Alert } from "react-native";

import {
  createAnchorEditorDrafts,
  convertMarchingHeightUnit,
  formatAnchorCanonicalPreview,
  standardDraftFromPosition,
  validateMarchingAnchorDraft,
  validateStandardAnchorDraft,
} from "../anchor-editor-form";
import { confirmAnchorPositionWrite } from "../anchor-write-confirmation";

describe("anchor editor form", () => {
  test("reuses the marching drill-grid coordinate domain", () => {
    const draft = createAnchorEditorDrafts();
    const result = validateMarchingAnchorDraft({
      ...draft.marching,
      height: "6",
      heightUnit: "feet",
    });

    expect(result.errors).toEqual({});
    expect(result.position).toMatchObject({
      xMeters: 0,
      yMeters: 0,
      zMeters: expect.closeTo(1.8288, 8),
    });
    expect(formatAnchorCanonicalPreview(result.position)?.marching).toContain(
      "On 50 yd ln",
    );
  });

  test("standard mode validates signed offsets and preserves canonical position", () => {
    const result = validateStandardAnchorDraft({
      reference: "center-field",
      unit: "feet",
      sideToSideOffset: "3",
      frontToBackOffset: "-6",
      height: "8",
    });
    expect(result.errors).toEqual({});
    const converted = standardDraftFromPosition(
      result.position!,
      "center-field",
      "feet",
    );
    expect(converted).toEqual({
      reference: "center-field",
      unit: "feet",
      sideToSideOffset: "3",
      frontToBackOffset: "-6",
      height: "8",
    });
  });

  test("changing marching height units preserves canonical height", () => {
    const draft = { ...createAnchorEditorDrafts().marching, height: "2" };
    const feet = convertMarchingHeightUnit(draft, "feet");
    expect(feet.height).toBe("6.56168");
    expect(validateMarchingAnchorDraft(feet).position?.zMeters).toBeCloseTo(2);
  });

  test("rejects incomplete and unreasonable submissions", () => {
    const marching = createAnchorEditorDrafts().marching;
    expect(
      validateMarchingAnchorDraft({ ...marching, height: "" }).errors,
    ).toHaveProperty("height");
    expect(
      validateStandardAnchorDraft({
        reference: "side-1-front-corner",
        unit: "meters",
        sideToSideOffset: "-1",
        frontToBackOffset: "0",
        height: "1",
      }).errors,
    ).toHaveProperty("position");
  });

  test("requires explicit confirmation before invoking one hardware action", () => {
    const alert = jest
      .spyOn(Alert, "alert")
      .mockImplementation(() => undefined);
    const write = jest.fn();

    confirmAnchorPositionWrite({ xMeters: 1, yMeters: 2, zMeters: 3 }, write);

    expect(write).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2];
    expect(buttons?.map((button) => button.text)).toEqual([
      "Cancel",
      "Write Position",
    ]);
    buttons?.[1].onPress?.();
    expect(write).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
