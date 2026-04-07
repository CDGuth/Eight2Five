const {
  withAndroidManifest,
  withInfoPlist,
  createRunOncePlugin,
} = require("@expo/config-plugins");
const pkg = require("./package.json");

const BLE_PERMISSIONS = [
  "android.permission.BLUETOOTH",
  "android.permission.BLUETOOTH_ADMIN",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
];

const withPansBleApi = (config, props = {}) => {
  config = withAndroidManifest(config, (androidConfig) => {
    const androidPermissions =
      androidConfig.modResults.manifest.permission || [];

    BLE_PERMISSIONS.forEach((permission) => {
      if (!androidPermissions.find((p) => p.$["android:name"] === permission)) {
        androidPermissions.push({
          $: { "android:name": permission },
        });
      }
    });

    androidConfig.modResults.manifest.permission = androidPermissions;
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

module.exports = createRunOncePlugin(withPansBleApi, pkg.name, pkg.version);
