import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansNetworkExportService } from "../PansNetworkExportService";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  PANS_NETWORK_EXPORT_VERSION,
} from "../types";

describe("PansNetworkExportService", () => {
  test("round-trips the v2 hardware-derived, secret-free network schema", async () => {
    const source = new InMemoryPansManagerRepository();
    const timestamp = 1_767_225_600_000;
    await source.saveNetwork({
      id: "network",
      name: "Field",
      panId: 0x1234,
      settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await source.saveDevice({
      id: "device",
      networkId: "network",
      transportDeviceId: "ios-transport-id",
      nickname: "Local nickname",
      notes: "Local notes",
      lastKnownConfig: anchorConfig(0x1234, "Hardware label"),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await source.saveDeviceSnapshot({
      deviceId: "device",
      capturedAt: timestamp,
      config: anchorConfig(0x1234, "Hardware label"),
    });
    const bulkLatest = jest.spyOn(source, "getLatestDeviceSnapshots");
    const singleLatest = jest.spyOn(source, "getLatestDeviceSnapshot");
    const exporter = new PansNetworkExportService(source, () => timestamp);
    const json = await exporter.exportNetworkJson("network");
    const parsed = JSON.parse(json);
    expect(json).toContain('"schema": "eight2five.pans-network"');
    expect(parsed.version).toBe(PANS_NETWORK_EXPORT_VERSION);
    expect(parsed.devices[0]).not.toHaveProperty("networkId");
    expect(parsed.devices[0]).not.toHaveProperty("nickname");
    expect(parsed.devices[0]).not.toHaveProperty("notes");
    expect(parsed.configurations).toHaveLength(1);
    expect(bulkLatest).toHaveBeenCalledTimes(1);
    expect(bulkLatest).toHaveBeenCalledWith(["device"]);
    expect(singleLatest).not.toHaveBeenCalled();
    expect(json.toLowerCase()).not.toContain("password");
    const csv = await exporter.exportNetworkCsv("network");
    expect(csv).toContain("network_id,network_name,pan_id,device_id");
    expect(csv).toContain("network,Field,4660,device,ios-transport-id");
    expect(csv).toContain("Hardware label");

    const destination = new InMemoryPansManagerRepository();
    await new PansNetworkExportService(destination).importNetwork(json);
    expect(await destination.listNetworkDevices("network")).toEqual([
      expect.objectContaining({
        id: "device",
        networkId: "network",
        transportDeviceId: "ios-transport-id",
      }),
    ]);
  });

  test("accepts v1 while removing legacy local device fields", () => {
    const service = new PansNetworkExportService(
      new InMemoryPansManagerRepository(),
    );
    const legacy = exportFixture(1);

    const validated = service.validateImport({
      ...legacy,
      devices: legacy.devices.map((device) => ({
        ...device,
        networkId: "network",
        nickname: "Legacy nickname",
        notes: "Legacy notes",
      })),
    });

    expect(validated.version).toBe(PANS_NETWORK_EXPORT_VERSION);
    expect(validated.devices[0]).not.toHaveProperty("networkId");
    expect(validated.devices[0]).not.toHaveProperty("nickname");
    expect(validated.devices[0]).not.toHaveProperty("notes");
  });

  test("imports v1 snapshot hardware state before deriving profile membership", async () => {
    const destination = new InMemoryPansManagerRepository();
    const service = new PansNetworkExportService(destination);
    const legacy = exportFixture(1);
    const { lastKnownConfig, ...legacyDevice } = legacy.devices[0];

    await service.importNetwork({
      ...legacy,
      devices: [
        {
          ...legacyDevice,
          networkId: "legacy-local-selection",
          nickname: "Legacy nickname",
          notes: "Legacy notes",
        },
      ],
      configurations: [
        {
          deviceId: legacyDevice.id,
          capturedAt: legacy.exportedAt,
          config: lastKnownConfig,
        },
      ],
    });

    expect(await destination.listNetworkDevices("network")).toEqual([
      expect.objectContaining({
        id: "device",
        networkId: "network",
        lastKnownConfig: expect.objectContaining({ panId: 0x1234 }),
      }),
    ]);
  });

  test("exports only devices with a unique hardware PAN match", async () => {
    const repository = new InMemoryPansManagerRepository();
    for (const network of [
      exportFixture(2).network,
      { ...exportFixture(2).network, id: "duplicate", name: "Duplicate" },
      {
        ...exportFixture(2).network,
        id: "other",
        name: "Other",
        panId: 0x5678,
      },
    ])
      await repository.saveNetwork(network);
    await repository.saveDevice({
      ...exportFixture(2).devices[0],
      id: "conflict",
      networkId: "network",
      lastKnownConfig: anchorConfig(0x1234),
    });
    await repository.saveDevice({
      ...exportFixture(2).devices[0],
      id: "moved",
      networkId: "network",
      lastKnownConfig: anchorConfig(0x5678),
    });
    await repository.saveDevice({
      ...exportFixture(2).devices[0],
      id: "unverified",
      networkId: "network",
      lastKnownConfig: anchorConfig(undefined),
    });

    await expect(
      new PansNetworkExportService(repository).exportNetwork("network"),
    ).resolves.toMatchObject({ devices: [] });
  });

  test("rejects secrets and unsupported versions", () => {
    const service = new PansNetworkExportService(
      new InMemoryPansManagerRepository(),
    );
    expect(() =>
      service.validateImport({
        schema: "eight2five.pans-network",
        version: 3,
      }),
    ).toThrow("version");
    expect(() =>
      service.validateImport({
        schema: "eight2five.pans-network",
        version: 1,
        exportedAt: "now",
        apiKey: "do-not-import",
        network: {},
        devices: [],
        configurations: [],
      }),
    ).toThrow("secrets");
    expect(() =>
      service.validateImport({
        ...exportFixture(2),
        network: { ...exportFixture(2).network, panId: 0 },
      }),
    ).toThrow("PAN 0 is the PANS default used for unassigned devices");
  });
});

function exportFixture(version: number) {
  const timestamp = 1_767_225_600_000;
  return {
    schema: "eight2five.pans-network" as const,
    version,
    exportedAt: timestamp,
    network: {
      id: "network",
      name: "Field",
      panId: 0x1234,
      settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    devices: [
      {
        id: "device",
        transportDeviceId: "transport",
        lastKnownConfig: anchorConfig(0x1234),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    configurations: [],
  };
}

function anchorConfig(panId: number | undefined, label?: string) {
  return {
    role: "anchor" as const,
    ...(panId !== undefined ? { panId } : {}),
    ...(label ? { label } : {}),
    uwbMode: "active" as const,
    ledEnabled: true,
    firmwareUpdateEnabled: false,
    initiatorEnabled: false,
  };
}
