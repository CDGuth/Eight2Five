import type { HardwareDeviceChanges, PansInspectionResult } from "./types";

/** Production fields owned by Eight2Five. Unlisted PANS fields are preserved. */
export const PERFORMER_TAG_PROFILE = Object.freeze({
  role: "tag" as const,
  uwbMode: "active" as const,
  ledEnabled: true,
  firmwareUpdateEnabled: true,
  locationEngineEnabled: true,
  // PANS exposes low-power; responsive mode is its inverse.
  lowPowerModeEnabled: false,
  stationaryDetectionEnabled: false,
  locationDataMode: 2 as const,
});

/** Returns only profile-owned fields whose readable values differ. */
export function diffPerformerTagProfile(
  inspection: PansInspectionResult,
): HardwareDeviceChanges {
  const mode = inspection.operationMode;
  const current: Record<keyof typeof PERFORMER_TAG_PROFILE, unknown> = {
    role: mode.role,
    uwbMode: mode.uwbMode,
    ledEnabled: mode.ledEnabled,
    firmwareUpdateEnabled: mode.firmwareUpdateEnabled,
    locationEngineEnabled: mode.locationEngineEnabled,
    lowPowerModeEnabled: mode.lowPowerModeEnabled,
    stationaryDetectionEnabled: mode.accelerometerEnabled,
    locationDataMode: inspection.locationDataMode,
  };
  return Object.fromEntries(
    Object.entries(PERFORMER_TAG_PROFILE).filter(
      ([field, requested]) =>
        !Object.is(current[field as keyof typeof current], requested),
    ),
  ) as HardwareDeviceChanges;
}
