import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansNetworkExportService } from "../PansNetworkExportService";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "../types";

describe("PansNetworkExportService", () => {
  test("round-trips the versioned, secret-free network schema", async () => {
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
      transportDeviceId: "ios-transport-id",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await source.associateDevice({
      networkId: "network",
      deviceId: "device",
      associatedAt: timestamp,
    });
    const exporter = new PansNetworkExportService(source, () => timestamp);
    const json = await exporter.exportNetworkJson("network");
    expect(json).toContain('"schema": "eight2five.pans-network"');
    expect(json.toLowerCase()).not.toContain("password");

    const destination = new InMemoryPansManagerRepository();
    await new PansNetworkExportService(destination).importNetwork(json);
    expect(await destination.listNetworkDevices("network")).toEqual([
      expect.objectContaining({
        id: "device",
        transportDeviceId: "ios-transport-id",
      }),
    ]);
  });

  test("rejects secrets and unsupported versions", () => {
    const service = new PansNetworkExportService(
      new InMemoryPansManagerRepository(),
    );
    expect(() =>
      service.validateImport({
        schema: "eight2five.pans-network",
        version: 2,
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
  });
});
