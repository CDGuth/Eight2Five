import type { HardwareDeviceChanges, PansInspectionResult } from "./types";

/** Production-owned anchor fields. PAN, position, and initiator remain explicit. */
export const PRODUCTION_ANCHOR_PROFILE = Object.freeze({
  role: "anchor" as const,
  uwbMode: "active" as const,
  ledEnabled: true,
  firmwareUpdateEnabled: true,
});

/** Returns only production anchor fields whose readable values differ. */
export function diffProductionAnchorProfile(
  inspection: PansInspectionResult,
): HardwareDeviceChanges {
  const mode = inspection.operationMode;
  const current: Record<keyof typeof PRODUCTION_ANCHOR_PROFILE, unknown> = {
    role: mode.role,
    uwbMode: mode.uwbMode,
    ledEnabled: mode.ledEnabled,
    firmwareUpdateEnabled: mode.firmwareUpdateEnabled,
  };
  return Object.fromEntries(
    Object.entries(PRODUCTION_ANCHOR_PROFILE).filter(
      ([field, requested]) =>
        !Object.is(current[field as keyof typeof current], requested),
    ),
  ) as HardwareDeviceChanges;
}
