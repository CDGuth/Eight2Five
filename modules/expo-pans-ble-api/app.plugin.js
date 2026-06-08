const {
  withAndroidManifest,
  withInfoPlist,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const pkg = require("./package.json");

const ANDROID_PERMISSIONS = [
  { name: "android.permission.BLUETOOTH_SCAN" },
  { name: "android.permission.BLUETOOTH_CONNECT" },
  { name: "android.permission.BLUETOOTH", maxSdkVersion: "30" },
  { name: "android.permission.BLUETOOTH_ADMIN", maxSdkVersion: "30" },
  { name: "android.permission.ACCESS_FINE_LOCATION" },
];

const withPansBleApi = (config, props = {}) => {
  config = withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    manifest.permission = manifest.permission || [];

    ANDROID_PERMISSIONS.forEach((permission) => {
      upsertPermission(manifest.permission, permission);
    });

    manifest["uses-feature"] = manifest["uses-feature"] || [];
    upsertBleFeature(manifest["uses-feature"]);

    return androidConfig;
  });

  config = withInfoPlist(config, (iosConfig) => {
    iosConfig.modResults.NSBluetoothAlwaysUsageDescription =
      props.bluetoothAlwaysUsageDescription ||
      "This app uses Bluetooth to communicate with nearby DWM1001 devices for localization.";

    iosConfig.modResults.NSBluetoothPeripheralUsageDescription =
      props.bluetoothPeripheralUsageDescription ||
      "This app uses Bluetooth to communicate with nearby DWM1001 devices for localization.";

    iosConfig.modResults.NSLocationWhenInUseUsageDescription =
      props.locationWhenInUseUsageDescription ||
      "This app uses location access for Bluetooth scanning required by localization.";

    return iosConfig;
  });

  return config;
};

function upsertPermission(permissions, permission) {
  const existing = permissions.find(
    (entry) => entry.$?.["android:name"] === permission.name,
  );
  const attributes = {
    "android:name": permission.name,
    ...(permission.maxSdkVersion
      ? { "android:maxSdkVersion": permission.maxSdkVersion }
      : {}),
  };

  if (existing) {
    existing.$ = { ...existing.$, ...attributes };
    return;
  }

  permissions.push({ $: attributes });
}

function upsertBleFeature(features) {
  const existing = features.find(
    (entry) => entry.$?.["android:name"] === "android.hardware.bluetooth_le",
  );
  const attributes = {
    "android:name": "android.hardware.bluetooth_le",
    "android:required": "false",
  };

  if (existing) {
    existing.$ = { ...existing.$, ...attributes };
    return;
  }

  features.push({ $: attributes });
}

module.exports = createRunOncePlugin(withPansBleApi, pkg.name, pkg.version);
