export const INFO_SPLASH_ASSET_PATHS = {
  light: {
    ios: "./assets/splash-icons/mobile-ios-splash-icon-light.png",
    android: "./assets/splash-icons/mobile-ios-splash-icon-light.png",
  },
  dark: {
    ios: "./assets/splash-icons/mobile-ios-splash-icon-dark.png",
    android: "./assets/splash-icons/mobile-ios-splash-icon-dark.png",
  },
} as const;

export type InfoThemeName = keyof typeof INFO_SPLASH_ASSET_PATHS;
export type InfoSplashPlatform = "ios" | "android";

export function getInfoSplashAssetPath(
  themeName: InfoThemeName,
  platform: InfoSplashPlatform,
): string {
  return INFO_SPLASH_ASSET_PATHS[themeName][platform];
}
