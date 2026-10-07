import {
  diffProductionAnchorProfile,
  PRODUCTION_ANCHOR_PROFILE,
} from "../anchor-profile";
import type { PansInspectionResult } from "../types";

describe("production anchor profile", () => {
  test("produces no writes for an already-correct anchor", () => {
    expect(diffProductionAnchorProfile(inspection())).toEqual({});
  });

  test("repairs production-owned anchor fields without touching initiator", () => {
    const current = inspection({
      operationMode: {
        ...inspection().operationMode,
        uwbMode: "passive",
        ledEnabled: false,
        firmwareUpdateEnabled: false,
        initiatorEnabled: true,
      },
    });

    expect(diffProductionAnchorProfile(current)).toEqual({
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: true,
    });
    expect(diffProductionAnchorProfile(current)).not.toHaveProperty(
      "initiatorEnabled",
    );
    expect(PRODUCTION_ANCHOR_PROFILE.role).toBe("anchor");
  });

  test("includes role conversion when the device is currently a tag", () => {
    const current = inspection({
      operationMode: {
        ...inspection().operationMode,
        role: "tag",
      },
    });

    expect(diffProductionAnchorProfile(current)).toEqual({ role: "anchor" });
  });
});

function inspection(
  changes: Partial<PansInspectionResult> = {},
): PansInspectionResult {
  return {
    deviceId: "anchor-1",
    transportDeviceId: "transport-1",
    inspectedAt: 1,
    operationMode: {
      role: "anchor",
      uwbMode: "active",
      selectedFirmware: 1,
      accelerometerEnabled: false,
      ledEnabled: true,
      firmwareUpdateEnabled: true,
      initiatorEnabled: false,
      lowPowerModeEnabled: false,
      locationEngineEnabled: false,
      raw: [0, 0],
    },
    warnings: [],
    ...changes,
  };
}
