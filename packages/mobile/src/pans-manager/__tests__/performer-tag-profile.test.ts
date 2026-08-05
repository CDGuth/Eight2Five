import {
  diffPerformerTagProfile,
  PERFORMER_TAG_PROFILE,
} from "../performer-tag-profile";
import type { PansInspectionResult } from "../types";

describe("performer tag profile", () => {
  test("produces no writes for an already-correct tag", () => {
    expect(diffPerformerTagProfile(inspection())).toEqual({});
  });

  test("returns a sparse patch and preserves unrelated mode fields", () => {
    const current = inspection({
      operationMode: {
        ...inspection().operationMode,
        ledEnabled: false,
        selectedFirmware: 2,
        raw: [17, 3],
      },
    });
    expect(diffPerformerTagProfile(current)).toEqual({ ledEnabled: true });
    expect(diffPerformerTagProfile(current)).not.toHaveProperty(
      "selectedFirmware",
    );
    expect(PERFORMER_TAG_PROFILE.lowPowerModeEnabled).toBe(false);
  });

  test("maps stationary detection and location mode explicitly", () => {
    expect(
      diffPerformerTagProfile(
        inspection({
          locationDataMode: 0,
          operationMode: {
            ...inspection().operationMode,
            accelerometerEnabled: true,
          },
        }),
      ),
    ).toEqual({ stationaryDetectionEnabled: false, locationDataMode: 2 });
  });
});

function inspection(
  changes: Partial<PansInspectionResult> = {},
): PansInspectionResult {
  return {
    deviceId: "tag-1",
    transportDeviceId: "transport-1",
    inspectedAt: 1,
    operationMode: {
      role: "tag",
      uwbMode: "active",
      selectedFirmware: 1,
      accelerometerEnabled: false,
      ledEnabled: true,
      firmwareUpdateEnabled: true,
      initiatorEnabled: false,
      lowPowerModeEnabled: false,
      locationEngineEnabled: true,
      raw: [0, 0],
    },
    locationDataMode: 2,
    warnings: [],
    ...changes,
  };
}
