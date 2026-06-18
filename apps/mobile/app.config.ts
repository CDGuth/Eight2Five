import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  owner: "cdguth",
  name: "Eight2Five",
  slug: "eight2five",
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
    bundleIdentifier: "com.eight2five.app",
    supportsTablet: false,
    icon: {
      light: "./assets/app-icons/mobile-ios-icon.png",
      dark: "./assets/app-icons/mobile-ios-icon-dark.png",
      tinted: "./assets/app-icons/mobile-ios-icon-tinted.png",
    },
  },
  android: {
    package: "com.eight2five.app",
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
      "../../modules/expo-kbeaconpro/app.plugin.js",
      {
        bluetoothAlwaysUsageDescription:
          "This app uses Bluetooth to find, connect and communicate with KBeaconPro devices.",
        bluetoothPeripheralUsageDescription:
          "This app uses Bluetooth to find, connect and communicate with KBeaconPro devices.",
        locationWhenInUseUsageDescription:
          "This app uses your location to scan for nearby KBeaconPro devices.",
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
      },
    ],
  ],
  experiments: {
    reactCompiler: true,
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "a26bddc3-6439-460b-b15b-51143e499c8a",
    },
  },
};

export default config;
