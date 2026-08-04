import type { Drill } from "@eight2five/mobile/drill";
import type { FieldPresetId } from "@eight2five/drill-schema";

/** A loaded drill owns its field; the preference is only the no-drill default. */
export function resolveEffectiveFieldPreset(
  activeDrill: Pick<Drill, "fieldPreset"> | undefined,
  defaultFieldPreset: FieldPresetId,
): FieldPresetId {
  return activeDrill?.fieldPreset ?? defaultFieldPreset;
}
