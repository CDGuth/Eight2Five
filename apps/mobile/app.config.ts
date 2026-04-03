import type { ExpoConfig } from "expo/config";

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const config: ExpoConfig = {
  owner: "cdguth",
  name: "Eight2Five Mobile",
  slug: "eight2five-mobile",
  platforms: ["ios", "android"],
  version: "0.0.0",
  orientation: "portrait",
  icon: "./assets/app-icons/mobile-android-legacy-icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    bundleIdentifier: "com.anonymous.eight2fivemobile",
    supportsTablet: false,
    icon: {
      light: "./assets/app-icons/mobile-ios-icon.png",
      dark: "./assets/app-icons/mobile-ios-icon-dark.png",
      tinted: "./assets/app-icons/mobile-ios-icon-tinted.png",
    },
  },
  android: {
    package: "com.anonymous.eight2fivemobile",
    icon: "./assets/app-icons/mobile-android-legacy-icon.png",
    adaptiveIcon: {
      foregroundImage:
        "./assets/app-icons/mobile-android-adaptive-foreground.png",
      backgroundImage:
        "./assets/app-icons/mobile-android-adaptive-background.png",
    },
  },
  plugins: [
    "expo-router",
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
