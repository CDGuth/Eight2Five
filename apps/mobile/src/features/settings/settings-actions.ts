import type {
  AppSettings,
  AppSettingsUpdate,
} from "@eight2five/mobile/settings";

export interface SettingsWriter {
  update(partial: AppSettingsUpdate): Promise<AppSettings>;
  resetPreferences(): Promise<AppSettings>;
}

export const RESET_SETTINGS_MESSAGE =
  "This restores display, drill-feature, terminology, and developer preferences to their defaults.\n\n" +
  "It does not delete drills, forget the remembered tag, delete cached anchor positions, or modify PANS hardware.";

/** Persistence completes before the native-tab layout is reconfigured. */
export async function updateDrillFeatures(
  writer: SettingsWriter,
  reconfigureTabs: (enabled: boolean) => void,
  enabled: boolean,
): Promise<AppSettings> {
  const settings = await writer.update({ drillFeaturesEnabled: enabled });
  reconfigureTabs(settings.drillFeaturesEnabled);
  return settings;
}

/** Reset affects preferences only, then reconciles Drill tab membership once. */
export async function resetAppSettings(
  writer: SettingsWriter,
  reconfigureTabs: (enabled: boolean) => void,
): Promise<AppSettings> {
  const settings = await writer.resetPreferences();
  reconfigureTabs(settings.drillFeaturesEnabled);
  return settings;
}
