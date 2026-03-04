import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  owner: "cdguth",
  name: "Eight2Five Mobile",
  slug: "eight2five-mobile",
  platforms: ["ios", "android"],
  version: "0.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    bundleIdentifier: "com.anonymous.eight2fivemobile",
    supportsTablet: false,
  },
  android: {
    package: "com.anonymous.eight2fivemobile",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
  },
  plugins: [
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
  ],
  extra: {
    isNativeBeaconingEnabled: process.env.USE_NATIVE_BEACONING === "true",
    eas: {
      projectId: "eba37a43-6b79-47e1-b347-ba1bf0f40c80",
    },
  },
};

export default config;
