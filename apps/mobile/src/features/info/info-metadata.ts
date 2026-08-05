export const EIGHT2FIVE_APP_NAME = "Eight2Five";
export const EIGHT2FIVE_APP_VERSION = "0.1.0";
export const EIGHT2FIVE_GITHUB_URL = "https://github.com/CDGuth/Eight2Five";
export const EIGHT2FIVE_LICENSE_URL = `${EIGHT2FIVE_GITHUB_URL}/blob/main/LICENSE`;
export const INFO_UNAVAILABLE = "Unavailable";

export interface InfoExpoConfig {
  name?: string;
  version?: string;
  ios?: {
    buildNumber?: string | number;
  };
  android?: {
    versionCode?: number | string;
  };
  extra?: {
    EIGHT2FIVE_GIT_SHA?: unknown;
  };
}

export interface MobileInfoMetadata {
  appName: string;
  version: string;
  nativeBuildLabel: string;
  nativeBuildValue: string;
  gitSha: string;
}

export function getMobileInfoMetadata(
  config: InfoExpoConfig | null | undefined,
  platform: string,
  nativeBuildVersion?: string | null,
): MobileInfoMetadata {
  const nativeBuildLabel = getNativeBuildLabel(platform);
  const nativeBuildValue =
    nativeBuildVersion?.trim() || getNativeBuildValue(config, platform);

  return {
    appName: EIGHT2FIVE_APP_NAME,
    version: config?.version?.trim() || EIGHT2FIVE_APP_VERSION,
    nativeBuildLabel,
    nativeBuildValue,
    gitSha: getShortGitSha(config?.extra?.EIGHT2FIVE_GIT_SHA),
  };
}

export function getNativeBuildLabel(platform: string): string {
  if (platform === "ios") return "iOS build number";
  if (platform === "android") return "Android version code";
  return "Native build";
}

export function getShortGitSha(value: unknown): string {
  if (typeof value !== "string") return INFO_UNAVAILABLE;

  const normalized = value.trim();
  if (!/^[0-9a-f]{7,40}$/i.test(normalized)) return INFO_UNAVAILABLE;
  return normalized.slice(0, 7);
}

function getNativeBuildValue(
  config: InfoExpoConfig | null | undefined,
  platform: string,
): string {
  const value =
    platform === "ios"
      ? config?.ios?.buildNumber
      : platform === "android"
        ? config?.android?.versionCode
        : undefined;

  return value == null ? INFO_UNAVAILABLE : String(value);
}
