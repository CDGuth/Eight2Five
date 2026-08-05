import {
  INFO_SPLASH_ASSET_PATHS,
  getInfoSplashAssetPath,
} from "../info-theme-assets";

describe("mobile info splash assets", () => {
  test("selects the canonical light and dark asset for each native platform", () => {
    expect(getInfoSplashAssetPath("light", "ios")).toBe(
      "./assets/splash-icons/mobile-ios-splash-icon-light.png",
    );
    expect(getInfoSplashAssetPath("dark", "ios")).toBe(
      "./assets/splash-icons/mobile-ios-splash-icon-dark.png",
    );
    expect(getInfoSplashAssetPath("light", "android")).toBe(
      "./assets/splash-icons/mobile-ios-splash-icon-light.png",
    );
    expect(getInfoSplashAssetPath("dark", "android")).toBe(
      "./assets/splash-icons/mobile-ios-splash-icon-dark.png",
    );
  });

  test("keeps light and dark assets distinct on both platforms", () => {
    expect(INFO_SPLASH_ASSET_PATHS.light.ios).not.toBe(
      INFO_SPLASH_ASSET_PATHS.dark.ios,
    );
    expect(INFO_SPLASH_ASSET_PATHS.light.android).not.toBe(
      INFO_SPLASH_ASSET_PATHS.dark.android,
    );
  });
});
