import { InMemoryPansManagerRepository } from "../InMemoryPansManagerRepository";
import { PansConfigurationService } from "../PansConfigurationService";
import type { PansNativeGateway } from "../PansDeviceSessionManager";
import { PansDeviceSessionManager } from "../PansDeviceSessionManager";

jest.mock("expo-pans-ble-api", () => ({}));

const mode = {
  role: "anchor" as const,
  uwbMode: "active" as const,
  selectedFirmware: 1 as const,
  accelerometerEnabled: false,
  ledEnabled: true,
  firmwareUpdateEnabled: false,
  initiatorEnabled: false,
  lowPowerModeEnabled: false,
  locationEngineEnabled: false,
  raw: [0, 0] as [number, number],
};

describe("PansConfigurationService", () => {
  test("inspection tolerates unavailable optional characteristics", async () => {
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      readLabel: jest.fn(async () => {
        throw {
          code: "CHARACTERISTIC_NOT_FOUND",
          message: "label unavailable",
        };
      }),
      readNetworkId: jest.fn(async () => 7),
      readDeviceInfo: jest.fn(async () => {
        throw { code: "UNSUPPORTED", message: "device info unavailable" };
      }),
      writeLabel: jest.fn(),
      writeNetworkId: jest.fn(),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "device",
      transportDeviceId: "transport-device",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await expect(service.inspect("device")).resolves.toMatchObject({
      deviceId: "device",
      transportDeviceId: "transport-device",
      panId: 7,
      warnings: [
        "label is unavailable on this device.",
        "device information is unavailable on this device.",
      ],
    });
  });

  test("writes deterministically, reports readback mismatch, and persists partial state", async () => {
    const calls: string[] = [];
    const labels = ["old", "wrong", "wrong"];
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => {
        calls.push("readLabel");
        return labels.shift() ?? "wrong";
      }),
      writeLabel: jest.fn(async () => {
        calls.push("writeLabel");
        return true;
      }),
      readNetworkId: jest.fn(async () => {
        calls.push("readPan");
        return 7;
      }),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => {
        calls.push("readMode");
        return mode;
      }),
      patchOperationMode: jest.fn(async () => mode),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      readDeviceInfo: jest.fn(async () => {
        calls.push("readInfo");
        return { raw: [] };
      }),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "device",
      transportDeviceId: "transport-device",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );
    const result = await service.configureDevice("device", {
      role: "anchor",
      label: "new",
      panId: 7,
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
    });
    expect(result.outcome).toBe("partial");
    expect(result.writes[0]).toMatchObject({
      field: "label",
      status: "mismatch",
      actual: "wrong",
    });
    expect(calls.slice(0, 6)).toEqual([
      "readMode",
      "readLabel",
      "readPan",
      "readInfo",
      "writeLabel",
      "readLabel",
    ]);
    expect(await repository.getLatestDeviceSnapshot("device")).toBeDefined();
    expect(await repository.getDevice("device")).toMatchObject({
      label: "wrong",
      lastKnownConfig: { role: "anchor", label: "wrong", panId: 7 },
    });
  });

  test("rejects changed update rates before any writes", async () => {
    const tagMode = { ...mode, role: "tag" as const };
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "tag"),
      writeLabel: jest.fn(),
      readNetworkId: jest.fn(async () => 1),
      writeNetworkId: jest.fn(),
      readOperationMode: jest.fn(async () => tagMode),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(async () => 1 as const),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(async () => ({
        movingUpdateRateMs: 100,
        stationaryUpdateRateMs: 1000,
        raw: [],
      })),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "tag",
      transportDeviceId: "transport-tag",
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );
    await expect(
      service.configureTag("tag", {
        role: "tag",
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        locationEngineEnabled: false,
        lowPowerModeEnabled: false,
        stationaryDetectionEnabled: false,
        locationDataMode: 1,
        movingUpdateRateMs: 200,
      }),
    ).resolves.toMatchObject({
      outcome: "failure",
      error: { code: "UNSUPPORTED_FEATURE" },
    });
    expect(native.patchOperationMode).not.toHaveBeenCalled();
  });

  test("migrates only the PAN ID and requires exact readback", async () => {
    const panReads = [1, 2, 2];
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "anchor"),
      writeLabel: jest.fn(),
      readNetworkId: jest.fn(async () => panReads.shift() ?? 2),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      readDeviceInfo: jest.fn(async () => ({
        nodeIdHex: "0001",
        lowNodeId: 1,
        hardwareVersion: 1,
        firmware1Version: 1,
        firmware2Version: 1,
        firmware1Checksum: 1,
        firmware2Checksum: 1,
        operationFlags: 0,
        raw: [],
      })),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "anchor",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 1,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    await expect(service.assignPanId("anchor", 2)).resolves.toMatchObject({
      outcome: "verified",
      inspected: { panId: 2 },
      writes: [{ field: "panId", status: "verified", actual: 2 }],
    });
    expect(native.patchOperationMode).not.toHaveBeenCalled();
    expect(native.writePersistedPosition).not.toHaveBeenCalled();
    expect(await repository.getDevice("anchor")).toMatchObject({
      lastKnownConfig: {
        panId: 2,
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
    });
  });

  test("persists final PAN readback instead of the mismatched requested PAN", async () => {
    const panReads = [1, 3, 3];
    const native = {
      connect: jest.fn(async () => true),
      disconnect: jest.fn(async () => true),
      readLabel: jest.fn(async () => "hardware"),
      writeLabel: jest.fn(),
      readNetworkId: jest.fn(async () => panReads.shift() ?? 3),
      writeNetworkId: jest.fn(async () => true),
      readOperationMode: jest.fn(async () => mode),
      patchOperationMode: jest.fn(),
      readLocationDataMode: jest.fn(),
      writeLocationDataMode: jest.fn(),
      readTagUpdateRate: jest.fn(),
      readDeviceInfo: jest.fn(async () => ({ raw: [] })),
      writePersistedPosition: jest.fn(),
    } as unknown as PansNativeGateway;
    const repository = new InMemoryPansManagerRepository();
    await repository.saveDevice({
      id: "anchor",
      transportDeviceId: "transport-anchor",
      lastKnownConfig: {
        role: "anchor",
        panId: 1,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const service = new PansConfigurationService(
      new PansDeviceSessionManager(native),
      repository,
    );

    const result = await service.assignPanId("anchor", 2);
    expect(result).toMatchObject({
      outcome: "partial",
      error: { code: "VERIFY_MISMATCH" },
      inspected: { panId: 3 },
    });
    expect(await repository.getDevice("anchor")).toMatchObject({
      label: "hardware",
      lastKnownConfig: {
        panId: 3,
        label: "hardware",
        position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
      },
    });
  });
});
