import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  owner: "cdguth",
  name: "Eight2Five Testbed",
  slug: "eight2five-testbed",
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
      },
    ],
  ],
  experiments: {
    reactCompiler: true,
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "f70dc79f-a836-4355-bd39-828d2aeac71e",
    },
  },
};

export default config;
