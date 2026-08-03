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

const appVariant = process.env.APP_VARIANT;
const isDevelopment = appVariant === "development";
const isPreview = appVariant === "preview";

const appName = isDevelopment
  ? "Eight2Five (Development)"
  : isPreview
    ? "Eight2Five (Preview)"
    : "Eight2Five";

const appIdentifier = isDevelopment
  ? "com.eight2five.app.development"
  : isPreview
    ? "com.eight2five.app.preview"
    : "com.eight2five.app";

const config: ExpoConfig = {
  owner: "cdguth",
  name: appName,
  slug: "eight2five",
  scheme: "eight2five",
  platforms: ["ios", "android"],
  version: "0.0.0",
  // Field is the only route that opts into landscape; Drill and Settings
  // apply portrait locks through their nested native stacks.
  orientation: "default",
  icon: "./assets/app-icons/mobile-android-legacy-icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: appIdentifier,
    supportsTablet: false,
    icon: {
      light: "./assets/app-icons/mobile-ios-icon.png",
      dark: "./assets/app-icons/mobile-ios-icon-dark.png",
      tinted: "./assets/app-icons/mobile-ios-icon-tinted.png",
    },
  },
  android: {
    package: appIdentifier,
    versionCode: androidVersionCode,
    icon: "./assets/app-icons/mobile-android-legacy-icon.png",
    adaptiveIcon: {
      foregroundImage:
        "./assets/app-icons/mobile-android-adaptive-foreground.png",
      backgroundImage:
        "./assets/app-icons/mobile-android-adaptive-background.png",
      monochromeImage:
        "./assets/app-icons/mobile-android-adaptive-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        buildReactNativeFromSource: false,
        ios: {
          ccacheEnabled: true,
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icons/mobile-ios-splash-icon-light.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          image: "./assets/splash-icons/mobile-ios-splash-icon-dark.png",
          backgroundColor: "#000000",
        },
        android: {
          image: "./assets/splash-icons/mobile-android-splash-icon-light.png",
          dark: {
            image:
              "./assets/splash-icons/mobile-android-splash-icon-dark.png",
            backgroundColor: "#000000",
          },
        },
      },
    ],
    [
      "../../modules/expo-pans-ble-api/app.plugin.js",
      {
        bluetoothAlwaysUsageDescription:
          "This app uses Bluetooth to find, connect and communicate with DWM1001 PANS BLE devices.",
        bluetoothPeripheralUsageDescription:
          "This app uses Bluetooth to find, connect and communicate with DWM1001 PANS BLE devices.",
        locationWhenInUseUsageDescription:
          "This app uses your location to scan for nearby DWM1001 PANS BLE devices.",
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
      projectId: "a26bddc3-6439-460b-b15b-51143e499c8a",
    },
  },
};

export default config;
