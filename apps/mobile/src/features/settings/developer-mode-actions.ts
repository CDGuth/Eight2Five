import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsUpdate,
} from "@eight2five/mobile/settings";

export interface DeveloperModeWriter {
  update(partial: AppSettingsUpdate): Promise<AppSettings>;
}

export async function enableDeveloperMode(
  writer: DeveloperModeWriter,
): Promise<AppSettings> {
  return await writer.update({ developerModeEnabled: true });
}

export async function disableDeveloperMode(
  writer: DeveloperModeWriter,
): Promise<AppSettings> {
  return await writer.update({
    developerModeEnabled: false,
    mockLivePositionEnabled: false,
    mockLivePositionXSteps: DEFAULT_APP_SETTINGS.mockLivePositionXSteps,
    mockLivePositionYSteps: DEFAULT_APP_SETTINGS.mockLivePositionYSteps,
  });
}

export function canUseDeveloperControls(settings: AppSettings): boolean {
  return settings.developerModeEnabled;
}
