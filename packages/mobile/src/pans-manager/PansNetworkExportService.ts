import { ManagerError } from "./errors";
import type { PansManagerRepository } from "./PansManagerRepository";
import {
  reconcileDeviceCachedProfileMatch,
  resolveCachedProfileMatch,
} from "./profile-matching";
import {
  normalizeManagedNetworkSettings,
  PANS_NETWORK_EXPORT_VERSION,
  type DeviceConfigurationSnapshot,
  type ManagedDevice,
  type ManagedNetwork,
  type PansNetworkExport,
} from "./types";
import {
  assertNetworkProfilePanId,
  assertUniqueName,
  normalizeDeviceConfig,
} from "./validation";

export class PansNetworkExportService {
  constructor(
    private readonly repository: PansManagerRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async exportNetwork(networkId: string): Promise<PansNetworkExport> {
    const network = await this.repository.getNetwork(networkId);
    if (!network) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "The requested network does not exist.",
      );
    }
    const [networks, storedDevices] = await Promise.all([
      this.repository.listNetworks(),
      this.repository.listDevices(),
    ]);
    const devices = storedDevices
      .filter(
        (device) =>
          resolveCachedProfileMatch(networks, device.lastKnownConfig?.panId)
            .networkId === networkId,
      )
      .map(exportableDevice);
    const configurations = (
      await Promise.all(
        devices.map(
          async (device) =>
            await this.repository.getLatestDeviceSnapshot(device.id),
        ),
      )
    ).filter(
      (snapshot): snapshot is DeviceConfigurationSnapshot =>
        snapshot !== undefined,
    );
    return {
      schema: "eight2five.pans-network",
      version: PANS_NETWORK_EXPORT_VERSION,
      exportedAt: this.now(),
      network: {
        ...clone(network),
        settings: normalizeManagedNetworkSettings(network.settings),
      },
      devices: clone(devices),
      configurations: clone(configurations),
    };
  }

  async exportNetworkJson(networkId: string): Promise<string> {
    return JSON.stringify(await this.exportNetwork(networkId), null, 2);
  }

  async exportNetworkCsv(networkId: string): Promise<string> {
    const data = await this.exportNetwork(networkId);
    const rows: unknown[][] = [
      [
        "network_id",
        "network_name",
        "pan_id",
        "device_id",
        "transport_device_id",
        "node_id",
        "hardware_label",
        "role",
        "x_m",
        "y_m",
        "z_m",
        "initiator",
      ],
      ...data.devices.map((device) => {
        const config = device.lastKnownConfig;
        const position =
          config?.role === "anchor" ? config.position : undefined;
        return [
          data.network.id,
          data.network.name,
          data.network.panId,
          device.id,
          device.transportDeviceId,
          device.nodeIdHex ?? "",
          device.lastKnownConfig?.label ?? device.label ?? "",
          device.role ?? config?.role ?? "",
          position?.xMeters ?? "",
          position?.yMeters ?? "",
          position?.zMeters ?? "",
          config?.role === "anchor" ? config.initiatorEnabled : "",
        ];
      }),
    ];
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  validateImport(input: string | unknown): PansNetworkExport {
    let value: unknown = input;
    if (typeof input === "string") {
      try {
        value = JSON.parse(input) as unknown;
      } catch (error) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "Network import is not valid JSON.",
          { cause: error },
        );
      }
    }
    if (!isRecord(value) || value.schema !== "eight2five.pans-network") {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Network import has an unknown schema.",
      );
    }
    if (value.version !== 1 && value.version !== PANS_NETWORK_EXPORT_VERSION) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Network import version is unsupported.",
      );
    }
    rejectSecrets(value);
    if (!isFiniteNumber(value.exportedAt)) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Network import timestamp is invalid.",
      );
    }
    validateNetwork(value.network);
    if (!Array.isArray(value.devices) || !Array.isArray(value.configurations)) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Network import device data is invalid.",
      );
    }
    const identities = new Set<string>();
    value.devices.forEach((device) => {
      validateDevice(device);
      const typed = device as unknown as ManagedDevice;
      if (identities.has(typed.id)) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "Network import contains duplicate device IDs.",
        );
      }
      identities.add(typed.id);
    });
    value.configurations.forEach((snapshot) => {
      if (
        !isRecord(snapshot) ||
        typeof snapshot.deviceId !== "string" ||
        !identities.has(snapshot.deviceId) ||
        !isFiniteNumber(snapshot.capturedAt)
      ) {
        throw new ManagerError(
          "INVALID_CONFIGURATION",
          "Network import contains an invalid snapshot.",
        );
      }
      normalizeDeviceConfig(snapshot.config as never);
    });
    const validated = clone(value as unknown as PansNetworkExport);
    validated.version = PANS_NETWORK_EXPORT_VERSION;
    validated.network.settings = normalizeManagedNetworkSettings(
      validated.network.settings,
    );
    validated.devices = validated.devices.map(exportableDevice);
    return validated;
  }

  async importNetwork(input: string | unknown): Promise<PansNetworkExport> {
    const data = this.validateImport(input);
    const existing = await this.repository.listNetworks();
    assertUniqueName(
      data.network.name,
      existing.map((network) => network.name),
      existing.find((network) => network.id === data.network.id)?.name,
    );
    await this.repository.saveNetwork(data.network);
    const importedNetworks = await this.repository.listNetworks();
    for (const device of data.devices) {
      const importedDevice = withLatestImportedHardwareCache(
        device,
        data.configurations,
      );
      await this.repository.saveDevice(
        reconcileDeviceCachedProfileMatch(
          importedDevice,
          importedNetworks,
          data.exportedAt,
        ),
      );
    }
    for (const snapshot of data.configurations) {
      await this.repository.saveDeviceSnapshot(snapshot);
    }
    return data;
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function validateNetwork(value: unknown): asserts value is ManagedNetwork {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt) ||
    !isRecord(value.settings)
  ) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Network import metadata is invalid.",
    );
  }
  assertNetworkProfilePanId(value.panId as number);
  validateNetworkSettings(value.settings);
}

function validateDevice(value: unknown): asserts value is ManagedDevice {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.transportDeviceId !== "string" ||
    !value.transportDeviceId.trim() ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "Network import contains an invalid device.",
    );
  }
}

function rejectSecrets(value: unknown, path = "export"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSecrets(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (
      /^(password|passphrase|secret|accessToken|refreshToken|apiKey|privateKey)$/i.test(
        key,
      )
    ) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        `Network import must not contain secrets (${path}.${key}).`,
      );
    }
    rejectSecrets(item, `${path}.${key}`);
  }
}

function validateNetworkSettings(value: unknown): void {
  if (!isRecord(value)) invalidSettings();
  const bounds = value.coordinateBounds;
  const tag = value.defaultTagMode;
  if (
    !isRecord(bounds) ||
    !isRecord(tag) ||
    ![
      bounds.minXMeters,
      bounds.maxXMeters,
      bounds.minYMeters,
      bounds.maxYMeters,
      bounds.minZMeters,
      bounds.maxZMeters,
      value.defaultAnchorHeightMeters,
      value.staleDeviceTimeoutMs,
      value.positionLogRetentionDays,
      value.positionLogMaxSamples,
      tag.movingUpdateRateMs,
      tag.stationaryUpdateRateMs,
    ].every(isFiniteNumber) ||
    typeof value.autoConnect !== "boolean" ||
    typeof tag.locationEngineEnabled !== "boolean" ||
    typeof tag.lowPowerModeEnabled !== "boolean" ||
    typeof tag.stationaryDetectionEnabled !== "boolean" ||
    ![0, 1, 2].includes(tag.locationDataMode as number)
  ) {
    invalidSettings();
  }
}

function invalidSettings(): never {
  throw new ManagerError(
    "INVALID_CONFIGURATION",
    "Network import settings are invalid.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function exportableDevice(device: ManagedDevice): ManagedDevice {
  const exported = { ...clone(device) };
  delete exported.networkId;
  delete exported.nickname;
  delete exported.notes;
  return exported;
}

function withLatestImportedHardwareCache(
  device: ManagedDevice,
  snapshots: DeviceConfigurationSnapshot[],
): ManagedDevice {
  if (device.lastKnownConfig) return device;
  const latest = snapshots
    .filter((snapshot) => snapshot.deviceId === device.id)
    .sort((left, right) => right.capturedAt - left.capturedAt)[0];
  if (!latest) return device;
  return {
    ...device,
    role: latest.config.role,
    ...(latest.config.label !== undefined
      ? { label: latest.config.label }
      : {}),
    lastKnownConfig: clone(latest.config),
  };
}
