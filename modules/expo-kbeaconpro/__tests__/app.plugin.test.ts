jest.mock("@expo/config-plugins", () => ({
  withAndroidManifest: jest.fn((config, action) => action(config)),
  withInfoPlist: jest.fn((config, action) => action(config)),
  createRunOncePlugin: jest.fn((plugin) => plugin),
}));

type AndroidManifest = {
  manifest: {
    permission?: { $: Record<string, string> }[];
    "uses-permission"?: { $: Record<string, string> }[];
    "uses-feature"?: { $: Record<string, string> }[];
  };
};

type Config = {
  modResults: AndroidManifest | Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withKBeaconPro } = require("../app.plugin") as {
  withKBeaconPro: (config: Config) => Config;
};

function androidConfig(manifest: AndroidManifest["manifest"] = {}): Config {
  return {
    modResults: { manifest },
  };
}

function permissionNames(manifest: AndroidManifest["manifest"]): string[] {
  return (manifest["uses-permission"] ?? []).map(
    (entry) => entry.$["android:name"],
  );
}

describe("expo-kbeaconpro config plugin", () => {
  it("writes required Android runtime permissions under uses-permission", () => {
    const config = androidConfig();

    withKBeaconPro(config);

    const manifest = (config.modResults as AndroidManifest).manifest;
    expect(permissionNames(manifest)).toEqual(
      expect.arrayContaining([
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.ACCESS_FINE_LOCATION",
      ]),
    );
    expect(manifest.permission).toBeUndefined();
    expect(
      manifest["uses-permission"]?.find(
        (entry) => entry.$["android:name"] === "android.permission.BLUETOOTH",
      )?.$["android:maxSdkVersion"],
    ).toBe("30");
  });

  it("is idempotent for permissions and BLE feature", () => {
    const config = androidConfig();

    withKBeaconPro(config);
    withKBeaconPro(config);

    const manifest = (config.modResults as AndroidManifest).manifest;
    const names = permissionNames(manifest);
    expect(
      names.filter((name) => name === "android.permission.BLUETOOTH_SCAN"),
    ).toHaveLength(1);
    expect(
      (manifest["uses-feature"] ?? []).filter(
        (entry) => entry.$["android:name"] === "android.hardware.bluetooth_le",
      ),
    ).toHaveLength(1);
  });

  it("preserves unrelated Android manifest entries", () => {
    const unrelatedPermission = {
      $: { "android:name": "com.example.UNRELATED_PERMISSION" },
    };
    const advertisePermission = {
      $: { "android:name": "android.permission.BLUETOOTH_ADVERTISE" },
    };
    const coarsePermission = {
      $: { "android:name": "android.permission.ACCESS_COARSE_LOCATION" },
    };
    const unrelatedFeature = {
      $: {
        "android:name": "android.hardware.camera",
        "android:required": "true",
      },
    };
    const config = androidConfig({
      "uses-permission": [
        unrelatedPermission,
        advertisePermission,
        coarsePermission,
      ],
      "uses-feature": [unrelatedFeature],
    });

    withKBeaconPro(config);

    const manifest = (config.modResults as AndroidManifest).manifest;
    expect(manifest["uses-permission"]).toEqual(
      expect.arrayContaining([
        unrelatedPermission,
        advertisePermission,
        coarsePermission,
      ]),
    );
    expect(manifest["uses-feature"]).toEqual(
      expect.arrayContaining([unrelatedFeature]),
    );
  });

  it("preserves iOS location usage descriptions owned by host apps", () => {
    const config: Config = {
      modResults: {
        manifest: {},
        NSLocationWhenInUseUsageDescription: "Used by another app feature.",
      },
    };

    withKBeaconPro(config);

    expect(config.modResults).toMatchObject({
      NSLocationWhenInUseUsageDescription: "Used by another app feature.",
      NSBluetoothAlwaysUsageDescription: expect.any(String),
      NSBluetoothPeripheralUsageDescription: expect.any(String),
    });
  });
});
