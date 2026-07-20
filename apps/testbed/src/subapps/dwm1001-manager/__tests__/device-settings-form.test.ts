import type {
  ManagedDevice,
  PansInspectionResult,
} from "@eight2five/mobile/pans-manager";

import {
  buildDeviceConfigurationDiff,
  deviceSettingsFormFrom,
  mergeInspectionIntoDeviceSettingsForm,
  shouldAutoInspectDevice,
} from "../device-settings-form";

describe("device settings form", () => {
  test("keeps app, hardware, and advertised names distinct", () => {
    const form = deviceSettingsFormFrom(
      anchorDevice(),
      "DWM1001 advertisement",
    );
    expect(form).toMatchObject({
      nickname: "App nickname",
      hardwareLabel: "PANS label",
      advertisedName: "DWM1001 advertisement",
    });
  });

  test("builds an explicit dirty-field diff without PAN, rates, or defaults", () => {
    const baseline = deviceSettingsFormFrom(anchorDevice());
    const diff = buildDeviceConfigurationDiff(baseline, {
      ...baseline,
      nickname: " New app nickname ",
      hardwareLabel: "",
      selectedFirmware: 2,
      ledEnabled: false,
      positionX: "4",
    });

    expect(diff).toEqual({
      localChanges: { nickname: "New app nickname" },
      hardwareChanges: {
        label: "",
        selectedFirmware: 2,
        ledEnabled: false,
        position: { xMeters: 4, yMeters: 2, zMeters: 3, quality: 90 },
      },
    });
    expect(diff.hardwareChanges).not.toHaveProperty("panId");
    expect(diff.hardwareChanges).not.toHaveProperty("movingUpdateRateMs");
  });

  test("does not initialize unavailable fields or include role-specific defaults", () => {
    const device: ManagedDevice = {
      id: "unknown",
      transportDeviceId: "transport-unknown",
      createdAt: 1,
      updatedAt: 1,
    };
    const baseline = deviceSettingsFormFrom(device);
    expect(baseline.role).toBeUndefined();
    expect(baseline.selectedFirmware).toBeUndefined();
    expect(baseline.locationDataMode).toBeUndefined();
    expect(buildDeviceConfigurationDiff(baseline, baseline)).toEqual({
      localChanges: {},
      hardwareChanges: {},
    });
  });

  test("includes dirty tag role fields while keeping update rates read-only", () => {
    const baseline = deviceSettingsFormFrom(tagDevice());
    const diff = buildDeviceConfigurationDiff(baseline, {
      ...baseline,
      locationEngineEnabled: false,
      lowPowerModeEnabled: true,
      stationaryDetectionEnabled: false,
      locationDataMode: 1,
      movingUpdateRateMs: 999,
      stationaryUpdateRateMs: 9999,
    });
    expect(diff.hardwareChanges).toEqual({
      locationEngineEnabled: false,
      lowPowerModeEnabled: true,
      stationaryDetectionEnabled: false,
      locationDataMode: 1,
    });
  });

  test("a role change does not invent settings for the new role", () => {
    const baseline = deviceSettingsFormFrom(tagDevice());
    const diff = buildDeviceConfigurationDiff(baseline, {
      ...baseline,
      role: "anchor",
    });
    expect(diff.hardwareChanges).toEqual({ role: "anchor" });
  });

  test("retains cached optional values when an actual inspection cannot read them", () => {
    const cached = deviceSettingsFormFrom(tagDevice());
    const merged = mergeInspectionIntoDeviceSettingsForm(
      cached,
      inspection("tag"),
    );
    expect(merged).toMatchObject({
      source: "actual",
      hardwareLabel: "Cached tag label",
      locationDataMode: 2,
      movingUpdateRateMs: 200,
      unavailableHardwareFields: [
        "label",
        "panId",
        "locationDataMode",
        "updateRate",
      ],
    });
  });

  test("auto-inspects only an available, newly opened device", () => {
    expect(shouldAutoInspectDevice(true, true, false)).toBe(true);
    expect(shouldAutoInspectDevice(true, false, false)).toBe(false);
    expect(shouldAutoInspectDevice(true, true, true)).toBe(false);
    expect(shouldAutoInspectDevice(false, true, false)).toBe(false);
  });
});

function anchorDevice(): ManagedDevice {
  return {
    id: "anchor",
    networkId: "profile",
    transportDeviceId: "transport-anchor",
    nickname: "App nickname",
    label: "PANS label",
    notes: "User notes",
    lastKnownConfig: {
      role: "anchor",
      label: "PANS label",
      panId: 7,
      uwbMode: "active",
      selectedFirmware: 1,
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
      position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 90 },
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

function tagDevice(): ManagedDevice {
  return {
    id: "tag",
    transportDeviceId: "transport-tag",
    label: "Cached tag label",
    lastKnownConfig: {
      role: "tag",
      label: "Cached tag label",
      panId: 8,
      uwbMode: "active",
      selectedFirmware: 1,
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      locationEngineEnabled: true,
      lowPowerModeEnabled: false,
      stationaryDetectionEnabled: true,
      locationDataMode: 2,
      movingUpdateRateMs: 200,
      stationaryUpdateRateMs: 1000,
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

function inspection(role: "anchor" | "tag"): PansInspectionResult {
  return {
    deviceId: "tag",
    transportDeviceId: "transport-tag",
    inspectedAt: 10,
    operationMode: {
      role,
      uwbMode: "passive",
      selectedFirmware: 2,
      accelerometerEnabled: true,
      ledEnabled: false,
      firmwareUpdateEnabled: true,
      initiatorEnabled: false,
      lowPowerModeEnabled: false,
      locationEngineEnabled: true,
      raw: [0, 0],
    },
    warnings: [],
  };
}
