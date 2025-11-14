const {
  withAndroidManifest,
  withInfoPlist,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const pkg = require("./package.json");
const BLUETOOTH_PERMISSIONS = [
  "android.permission.BLUETOOTH",
  "android.permission.BLUETOOTH_ADMIN",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
];

/**
 * Config plugin to add required Bluetooth and location permissions
 * for KBeaconPro usage on Android and iOS.
 */
const withKBeaconPro = (config, props = {}) => {
  // Android permissions
  config = withAndroidManifest(config, (config) => {
    const androidPermissions = config.modResults.manifest.permission || [];

    BLUETOOTH_PERMISSIONS.forEach((permission) => {
      if (!androidPermissions.find((p) => p.$["android:name"] === permission)) {
        androidPermissions.push({
          $: { "android:name": permission },
        });
      }
    });

    config.modResults.manifest.permission = androidPermissions;
    return config;
  });

  // iOS permissions
  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      props.bluetoothAlwaysUsageDescription ||
      "This app uses Bluetooth to find, connect and communicate with Bluetooth devices in order to calculate your location.";

    config.modResults.NSBluetoothPeripheralUsageDescription =
      props.bluetoothPeripheralUsageDescription ||
      "This app uses Bluetooth to find, connect and communicate with Bluetooth devices in order to calculate your location.";

    config.modResults.NSLocationWhenInUseUsageDescription =
      props.locationWhenInUseUsageDescription ||
      "This app uses Bluetooth to find, connect and communicate with Bluetooth devices in order to calculate your location.";

    return config;
  });

  return config;
};
module.exports = createRunOncePlugin(withKBeaconPro, pkg.name, pkg.version);
