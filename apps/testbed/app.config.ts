import type { ExpoConfig } from "expo/config";

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const config: ExpoConfig = {
  owner: "cdguth",
  name: "Eight2Five Testbed",
  slug: "eight2five-testbed",
  platforms: ["ios", "android"],
  version: "0.0.0",
  orientation: "portrait",
  icon: "./assets/app-icons/testbed-android-legacy-icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    bundleIdentifier: "com.anonymous.eight2fivetestbed",
    supportsTablet: false,
    icon: {
      light: "./assets/app-icons/testbed-ios-icon.png",
      dark: "./assets/app-icons/testbed-ios-icon-dark.png",
      tinted: "./assets/app-icons/testbed-ios-icon-tinted.png",
    },
  },
  android: {
    package: "com.anonymous.eight2fivetestbed",
    icon: "./assets/app-icons/testbed-android-legacy-icon.png",
    adaptiveIcon: {
      foregroundImage: "./assets/app-icons/testbed-android-adaptive-foreground.png",
      backgroundImage: "./assets/app-icons/testbed-android-adaptive-background.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-sharing",
    [
      "expo-build-properties",
      {
        useHermesV1: true,
      },
    ],
    [
      "../../modules/expo-kbeaconpro",
      {
        bluetoothAlwaysUsageDescription:
          "Our app uses Bluetooth to find, connect and communicate with KBeaconPro devices.",
        bluetoothPeripheralUsageDescription:
          "Our app uses Bluetooth to find, connect and communicate with KBeaconPro devices.",
        locationWhenInUseUsageDescription:
          "Our app uses your location to scan for nearby KBeaconPro devices.",
      },
    ],
    [
      "../../modules/expo-pans-ble-api",
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
    isNativeBeaconingEnabled:
      runtime.process?.env?.USE_NATIVE_BEACONING === "true",
    eas: {
      projectId: "eba37a43-6b79-47e1-b347-ba1bf0f40c80",
    },
  },
};

export default config;
