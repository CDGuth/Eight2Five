import type { ExpoConfig } from "expo/config";

const buildId =
  process.env.E2F_BUILD_ID ??
  process.env.EAS_BUILD_GIT_COMMIT_HASH ??
  process.env.GITHUB_SHA ??
  "local";
const requestedVersionCode = Number(
  process.env.E2F_ANDROID_VERSION_CODE ?? process.env.GITHUB_RUN_NUMBER ?? 1,
);
const androidVersionCode =
  Number.isSafeInteger(requestedVersionCode) && requestedVersionCode > 0
    ? requestedVersionCode
    : 1;

const config: ExpoConfig = {
  owner: "cdguth",
  name: "Eight2Five Testbed",
  slug: "eight2five-testbed",
  scheme: "eight2five-testbed",
  platforms: ["ios", "android"],
  version: "0.0.0",
  orientation: "portrait",
  icon: "./assets/app-icons/testbed-android-legacy-icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.eight2five.app.testbed",
    supportsTablet: false,
    icon: {
      light: "./assets/app-icons/testbed-ios-icon.png",
      dark: "./assets/app-icons/testbed-ios-icon-dark.png",
      tinted: "./assets/app-icons/testbed-ios-icon-tinted.png",
    },
  },
  android: {
    package: "com.eight2five.app.testbed",
    versionCode: androidVersionCode,
    icon: "./assets/app-icons/testbed-android-legacy-icon.png",
    adaptiveIcon: {
      foregroundImage:
        "./assets/app-icons/testbed-android-adaptive-foreground.png",
      backgroundImage:
        "./assets/app-icons/testbed-android-adaptive-background.png",
      monochromeImage:
        "./assets/app-icons/testbed-android-adaptive-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icons/testbed-ios-splash-icon-light.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          image: "./assets/splash-icons/testbed-ios-splash-icon-dark.png",
          backgroundColor: "#000000",
        },
        android: {
          image:
            "./assets/splash-icons/testbed-android-splash-icon-light.png",
          dark: {
            image:
              "./assets/splash-icons/testbed-android-splash-icon-dark.png",
            backgroundColor: "#000000",
          },
        },
      },
    ],
    "expo-asset",
    "expo-sharing",
    [
      "../../modules/expo-pans-ble-api/app.plugin.js",
      {
        bluetoothAlwaysUsageDescription:
          "Our app uses Bluetooth to find, connect and communicate with DWM1001 PANS BLE devices.",
        bluetoothPeripheralUsageDescription:
          "Our app uses Bluetooth to find, connect and communicate with DWM1001 PANS BLE devices.",
        locationWhenInUseUsageDescription:
          "Our app uses your location to scan for nearby DWM1001 PANS BLE devices.",
        buildId,
      },
    ],
  ],
  experiments: {
    reactCompiler: true,
    typedRoutes: true,
  },
  extra: {
    buildId,
    eas: {
      projectId: "f70dc79f-a836-4355-bd39-828d2aeac71e",
    },
  },
};

export default config;
