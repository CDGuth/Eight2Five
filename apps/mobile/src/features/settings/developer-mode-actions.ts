import type { AppSettings } from "@eight2five/mobile/settings";

export interface DeveloperModeWriter {
  update(partial: { developerModeEnabled: boolean }): Promise<AppSettings>;
}

export const DEVELOPER_MODE_WARNING =
  "Developer controls can modify PANS anchor positions. Incorrect anchor positions can make reported locations inaccurate. These controls are intended for advanced configuration.";

export async function enableDeveloperMode(
  writer: DeveloperModeWriter,
): Promise<AppSettings> {
  return await writer.update({ developerModeEnabled: true });
}

export async function disableDeveloperMode(
  writer: DeveloperModeWriter,
): Promise<AppSettings> {
  return await writer.update({ developerModeEnabled: false });
}

export function canUseDeveloperControls(settings: AppSettings): boolean {
  return settings.developerModeEnabled;
}
