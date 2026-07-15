jest.mock("@expo/config-plugins", () => ({
  withAndroidManifest: jest.fn((config, action) => action(config)),
  withInfoPlist: jest.fn((config, action) => action(config)),
  createRunOncePlugin: jest.fn((plugin) => plugin),
}));

type AndroidManifest = {
  manifest: {
    application?: {
      $?: Record<string, string>;
      "meta-data"?: { $: Record<string, string> }[];
    }[];
    permission?: { $: Record<string, string> }[];
    "uses-permission"?: { $: Record<string, string> }[];
    "uses-feature"?: { $: Record<string, string> }[];
  };
};

type Config = {
  modResults: AndroidManifest | Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withPansBleApi } = require("../app.plugin") as {
  withPansBleApi: (config: Config, props?: { buildId?: string }) => Config;
};

function androidConfig(manifest: AndroidManifest["manifest"] = {}): Config {
  return {
    modResults: {
      manifest: {
        application: [{ $: { "android:name": ".MainApplication" } }],
        ...manifest,
      },
    },
  };
}

function permissionNames(manifest: AndroidManifest["manifest"]): string[] {
  return (manifest["uses-permission"] ?? []).map(
    (entry) => entry.$["android:name"],
  );
}

function permission(
  manifest: AndroidManifest["manifest"],
  name: string,
): { $: Record<string, string> } | undefined {
  return manifest["uses-permission"]?.find(
    (entry) => entry.$["android:name"] === name,
  );
}

describe("expo-pans-ble-api config plugin", () => {
  it("writes Android runtime permissions under uses-permission", () => {
    const config = androidConfig();

    withPansBleApi(config);

    const manifest = (config.modResults as AndroidManifest).manifest;
    expect(permissionNames(manifest)).toEqual(
      expect.arrayContaining([
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ]),
    );
    expect(manifest.permission).toBeUndefined();
  });

  it("is idempotent for permissions and BLE feature", () => {
    const config = androidConfig();

    withPansBleApi(config);
    withPansBleApi(config);

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

  it("preserves unrelated Android permissions and adds optional BLE hardware feature", () => {
    const unrelatedPermission = {
      $: { "android:name": "com.example.UNRELATED_PERMISSION" },
    };
    const unrelatedFeature = {
      $: {
        "android:name": "android.hardware.camera",
        "android:required": "true",
      },
    };
    const config = androidConfig({
      "uses-permission": [unrelatedPermission],
      "uses-feature": [unrelatedFeature],
    });

    withPansBleApi(config);

    const manifest = (config.modResults as AndroidManifest).manifest;
    expect(manifest["uses-permission"]).toEqual(
      expect.arrayContaining([unrelatedPermission]),
    );
    expect(manifest["uses-feature"]).toEqual(
      expect.arrayContaining([
        unrelatedFeature,
        {
          $: {
            "android:name": "android.hardware.bluetooth_le",
            "android:required": "false",
          },
        },
      ]),
    );
  });

  it("caps legacy Bluetooth but keeps location permissions available on Android 12+", () => {
    const config = androidConfig();

    withPansBleApi(config);

    const manifest = (config.modResults as AndroidManifest).manifest;
    expect(
      permission(manifest, "android.permission.BLUETOOTH")?.$[
        "android:maxSdkVersion"
      ],
    ).toBe("30");
    expect(
      permission(manifest, "android.permission.BLUETOOTH_ADMIN")?.$[
        "android:maxSdkVersion"
      ],
    ).toBe("30");
    expect(
      permission(manifest, "android.permission.ACCESS_FINE_LOCATION")?.$[
        "android:maxSdkVersion"
      ],
    ).toBeUndefined();
    expect(
      permission(manifest, "android.permission.ACCESS_COARSE_LOCATION")?.$[
        "android:maxSdkVersion"
      ],
    ).toBeUndefined();
    expect(
      permission(manifest, "android.permission.BLUETOOTH_SCAN")?.$[
        "android:usesPermissionFlags"
      ],
    ).toBeUndefined();
  });

  it("removes stale location caps and never-for-location flags", () => {
    const config = androidConfig({
      "uses-permission": [
        {
          $: {
            "android:name": "android.permission.ACCESS_FINE_LOCATION",
            "android:maxSdkVersion": "30",
          },
        },
        {
          $: {
            "android:name": "android.permission.BLUETOOTH_SCAN",
            "android:usesPermissionFlags": "neverForLocation",
          },
        },
      ],
    });

    withPansBleApi(config);

    const manifest = (config.modResults as AndroidManifest).manifest;
    expect(
      permission(manifest, "android.permission.ACCESS_FINE_LOCATION")?.$[
        "android:maxSdkVersion"
      ],
    ).toBeUndefined();
    expect(
      permission(manifest, "android.permission.BLUETOOTH_SCAN")?.$[
        "android:usesPermissionFlags"
      ],
    ).toBeUndefined();
  });

  it("writes and updates the native build identifier", () => {
    const config = androidConfig();

    withPansBleApi(config, { buildId: "abc123" });
    withPansBleApi(config, { buildId: "def456" });

    const manifest = (config.modResults as AndroidManifest).manifest;
    const metadata = manifest.application?.[0]["meta-data"] ?? [];
    expect(
      metadata.filter(
        (entry) =>
          entry.$["android:name"] === "expo.modules.pansbleapi.BUILD_ID",
      ),
    ).toEqual([
      {
        $: {
          "android:name": "expo.modules.pansbleapi.BUILD_ID",
          "android:value": "def456",
        },
      },
    ]);
  });

  it("inserts iOS Bluetooth descriptions without deleting unrelated plist entries", () => {
    const config: Config = {
      modResults: {
        manifest: {},
        NSCameraUsageDescription: "Used by another app feature.",
      },
    };

    withPansBleApi(config);

    expect(config.modResults).toMatchObject({
      NSCameraUsageDescription: "Used by another app feature.",
      NSBluetoothAlwaysUsageDescription: expect.any(String),
      NSBluetoothPeripheralUsageDescription: expect.any(String),
    });
    expect(config.modResults).not.toHaveProperty(
      "NSLocationWhenInUseUsageDescription",
    );
  });

  it("preserves an existing host-owned iOS location usage description", () => {
    const config: Config = {
      modResults: {
        manifest: {},
        NSLocationWhenInUseUsageDescription: "Host app owns location access.",
      },
    };

    withPansBleApi(config);

    expect(config.modResults).toMatchObject({
      NSLocationWhenInUseUsageDescription: "Host app owns location access.",
      NSBluetoothAlwaysUsageDescription: expect.any(String),
      NSBluetoothPeripheralUsageDescription: expect.any(String),
    });
  });
});
