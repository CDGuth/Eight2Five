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

const DEFAULT_BLUETOOTH_USAGE_DESCRIPTION =
  "This app uses Bluetooth to find, connect, and communicate with KBeacon devices for field localization.";

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

function removePermission(permissions, permissionName) {
  return permissions.filter(
    (entry) => entry.$?.["android:name"] !== permissionName,
  );
}

/**
 * Config plugin to add the Bluetooth permissions required by KBeaconPro.
 * Host apps remain responsible for any unrelated location or background-scan
 * permissions they need outside this foreground BLE wrapper.
 */
const withKBeaconPro = (config, props = {}) => {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    let androidPermissions = manifest.permission || [];
    const androidFeatures = manifest["uses-feature"] || [];

    androidPermissions = removePermission(
      androidPermissions,
      "android.permission.ACCESS_COARSE_LOCATION",
    );
    androidPermissions = removePermission(
      androidPermissions,
      "android.permission.BLUETOOTH_ADVERTISE",
    );

    ANDROID_PERMISSIONS.forEach((permission) => {
      upsertPermission(androidPermissions, permission);
    });
    upsertBleFeature(androidFeatures);

    manifest.permission = androidPermissions;
    manifest["uses-feature"] = androidFeatures;
    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      props.bluetoothAlwaysUsageDescription ||
      DEFAULT_BLUETOOTH_USAGE_DESCRIPTION;

    config.modResults.NSBluetoothPeripheralUsageDescription =
      props.bluetoothPeripheralUsageDescription ||
      DEFAULT_BLUETOOTH_USAGE_DESCRIPTION;

    delete config.modResults.NSLocationWhenInUseUsageDescription;

    return config;
  });

  return config;
};

module.exports = createRunOncePlugin(withKBeaconPro, pkg.name, pkg.version);
