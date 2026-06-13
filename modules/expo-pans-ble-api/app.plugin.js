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
  { name: "android.permission.ACCESS_FINE_LOCATION", maxSdkVersion: "30" },
];

const withPansBleApi = (config, props = {}) => {
  config = withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const androidPermissions = manifest["uses-permission"] || [];
    const androidFeatures = manifest["uses-feature"] || [];

    ANDROID_PERMISSIONS.forEach((permission) => {
      upsertPermission(androidPermissions, permission);
    });

    upsertBleFeature(androidFeatures);

    manifest["uses-permission"] = androidPermissions;
    manifest["uses-feature"] = androidFeatures;

    return androidConfig;
  });

  config = withInfoPlist(config, (iosConfig) => {
    iosConfig.modResults.NSBluetoothAlwaysUsageDescription =
      props.bluetoothAlwaysUsageDescription ||
      "This app uses Bluetooth to communicate with nearby DWM1001 devices for localization.";

    iosConfig.modResults.NSBluetoothPeripheralUsageDescription =
      props.bluetoothPeripheralUsageDescription ||
      "This app uses Bluetooth to communicate with nearby DWM1001 devices for localization.";

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
module.exports.withPansBleApi = withPansBleApi;
module.exports._internal = {
  ANDROID_PERMISSIONS,
  upsertBleFeature,
  upsertPermission,
};
