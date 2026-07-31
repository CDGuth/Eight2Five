import { ManagerError } from "./errors";
import type { PansManagerRepository } from "./PansManagerRepository";
import type {
  DeviceConfigurationSnapshot,
  ManagedDevice,
  ManagedNetwork,
  NetworkDeviceAssociation,
  PansBatchOperationItem,
  PansBatchOperationRecord,
  PansManagerSettings,
  PositionLogSample,
  PositionLogSession,
} from "./types";
import {
  normalizeManagedNetworkSettings,
  normalizePansManagerSettings,
} from "./types";

export class InMemoryPansManagerRepository implements PansManagerRepository {
  private readonly networks = new Map<string, ManagedNetwork>();
  private readonly devices = new Map<string, ManagedDevice>();
  private readonly snapshots = new Map<string, DeviceConfigurationSnapshot[]>();
  private readonly batches = new Map<string, PansBatchOperationRecord>();
  private readonly batchItems = new Map<string, PansBatchOperationItem>();
  private readonly logSessions = new Map<string, PositionLogSession>();
  private readonly logSamples = new Map<string, PositionLogSample[]>();
  private settings?: PansManagerSettings;

  async initialize(): Promise<void> {}

  async listNetworks(): Promise<ManagedNetwork[]> {
    return sorted(this.networks.values(), (item) => item.name).map(clone);
  }

  async getNetwork(id: string): Promise<ManagedNetwork | undefined> {
    return maybeClone(this.networks.get(id));
  }

  async saveNetwork(network: ManagedNetwork): Promise<ManagedNetwork> {
    return (await this.saveNetworks([network]))[0];
  }

  async saveNetworks(networks: ManagedNetwork[]): Promise<ManagedNetwork[]> {
    const staged = new Map(this.networks);
    for (const network of networks) {
      staged.set(network.id, canonicalNetwork(network, staged.get(network.id)));
    }
    for (const { id } of networks)
      this.networks.set(id, clone(staged.get(id)!));
    return networks.map(({ id }) => clone(staged.get(id)!));
  }

  async deleteNetwork(id: string): Promise<void> {
    this.networks.delete(id);
    for (const [deviceId, device] of this.devices) {
      if (device.networkId === id) {
        const { networkId: _networkId, ...unassigned } = device;
        this.devices.set(deviceId, unassigned);
      }
    }
    this.deletePositionLogs((session) => session.networkId === id);
  }

  async listDevices(): Promise<ManagedDevice[]> {
    return sorted(this.devices.values(), (item) => item.id).map(clone);
  }

  async getDevice(deviceId: string): Promise<ManagedDevice | undefined> {
    return maybeClone(this.devices.get(deviceId));
  }

  async saveDevice(device: ManagedDevice): Promise<ManagedDevice> {
    const persisted = clone({
      ...device,
      createdAt: this.devices.get(device.id)?.createdAt ?? device.createdAt,
    });
    this.devices.set(device.id, clone(persisted));
    return clone(persisted);
  }

  async deleteDevice(deviceId: string): Promise<void> {
    this.devices.delete(deviceId);
    this.snapshots.delete(deviceId);
    this.deletePositionLogs((session) => session.deviceId === deviceId);
  }

  async listNetworkDevices(networkId: string): Promise<ManagedDevice[]> {
    return Array.from(this.devices.values())
      .filter((device) => device.networkId === networkId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(clone);
  }

  async associateDevice(
    association: NetworkDeviceAssociation,
  ): Promise<ManagedDevice> {
    const device = this.devices.get(association.deviceId);
    if (!device) {
      throw new ManagerError(
        "DEVICE_NOT_FOUND",
        "The managed device does not exist.",
        { deviceId: association.deviceId, operation: "associate device" },
      );
    }
    if (!this.networks.has(association.networkId)) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "The target network profile does not exist.",
        { deviceId: association.deviceId, operation: "associate device" },
      );
    }
    const persisted = {
      ...device,
      networkId: association.networkId,
      updatedAt: association.associatedAt,
    };
    this.devices.set(association.deviceId, clone(persisted));
    return clone(persisted);
  }

  async dissociateDevice(
    networkId: string,
    deviceId: string,
    dissociatedAt = Date.now(),
  ): Promise<ManagedDevice> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new ManagerError(
        "DEVICE_NOT_FOUND",
        "The managed device does not exist.",
        { deviceId, operation: "dissociate device" },
      );
    }
    if (!this.networks.has(networkId) || device.networkId !== networkId) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "The device is not associated with that network profile.",
        { deviceId, operation: "dissociate device" },
      );
    }
    const { networkId: _networkId, ...unassigned } = device;
    const persisted = { ...unassigned, updatedAt: dissociatedAt };
    this.devices.set(deviceId, clone(persisted));
    return clone(persisted);
  }

  async getSettings(): Promise<PansManagerSettings | undefined> {
    return maybeClone(this.settings);
  }

  async saveSettings(
    settings: PansManagerSettings,
  ): Promise<PansManagerSettings> {
    const persisted = clone(normalizePansManagerSettings(settings));
    this.settings = clone(persisted);
    return clone(persisted);
  }

  async saveDeviceSnapshot(
    snapshot: DeviceConfigurationSnapshot,
  ): Promise<DeviceConfigurationSnapshot> {
    const persisted = clone(snapshot);
    const existing = this.snapshots.get(snapshot.deviceId) ?? [];
    existing.push(clone(persisted));
    existing.sort((left, right) => left.capturedAt - right.capturedAt);
    this.snapshots.set(snapshot.deviceId, existing);
    return clone(persisted);
  }

  async getLatestDeviceSnapshots(
    deviceIds: string[],
  ): Promise<Record<string, DeviceConfigurationSnapshot | undefined>> {
    const result: Record<string, DeviceConfigurationSnapshot | undefined> =
      Object.create(null) as Record<
        string,
        DeviceConfigurationSnapshot | undefined
      >;
    for (const deviceId of deviceIds) {
      const entries = this.snapshots.get(deviceId);
      result[deviceId] = entries?.length
        ? clone(entries[entries.length - 1])
        : undefined;
    }
    return result;
  }

  async getLatestDeviceSnapshot(
    deviceId: string,
  ): Promise<DeviceConfigurationSnapshot | undefined> {
    return (await this.getLatestDeviceSnapshots([deviceId]))[deviceId];
  }

  async listDeviceSnapshots(
    deviceId: string,
  ): Promise<DeviceConfigurationSnapshot[]> {
    return (this.snapshots.get(deviceId) ?? []).map(clone);
  }

  async saveBatchOperation(operation: PansBatchOperationRecord): Promise<void> {
    this.batches.set(operation.id, clone(operation));
  }

  async getBatchOperation(
    id: string,
  ): Promise<PansBatchOperationRecord | undefined> {
    return maybeClone(this.batches.get(id));
  }

  async listBatchOperations(): Promise<PansBatchOperationRecord[]> {
    return Array.from(this.batches.values())
      .sort((left, right) => right.startedAt - left.startedAt)
      .map(clone);
  }

  async saveBatchItem(item: PansBatchOperationItem): Promise<void> {
    this.batchItems.set(batchItemKey(item.batchId, item.deviceId), clone(item));
  }

  async listBatchItems(batchId: string): Promise<PansBatchOperationItem[]> {
    return Array.from(this.batchItems.values())
      .filter((item) => item.batchId === batchId)
      .sort((left, right) => left.index - right.index)
      .map(clone);
  }

  async savePositionLogSession(session: PositionLogSession): Promise<void> {
    this.logSessions.set(session.id, clone(session));
  }

  async getPositionLogSession(
    id: string,
  ): Promise<PositionLogSession | undefined> {
    return maybeClone(this.logSessions.get(id));
  }

  async listPositionLogSessions(): Promise<PositionLogSession[]> {
    return Array.from(this.logSessions.values())
      .sort((left, right) => right.startedAt - left.startedAt)
      .map(clone);
  }

  async appendPositionLogSamples(samples: PositionLogSample[]): Promise<void> {
    for (const sample of samples) {
      const existing = this.logSamples.get(sample.sessionId) ?? [];
      const index = existing.findIndex(
        (item) => item.sequence === sample.sequence,
      );
      if (index >= 0) existing[index] = clone(sample);
      else existing.push(clone(sample));
      existing.sort((left, right) => left.sequence - right.sequence);
      this.logSamples.set(sample.sessionId, existing);
    }
  }

  async listPositionLogSamples(
    sessionId: string,
  ): Promise<PositionLogSample[]> {
    return (this.logSamples.get(sessionId) ?? []).map(clone);
  }

  private deletePositionLogs(
    shouldDelete: (session: PositionLogSession) => boolean,
  ): void {
    for (const [sessionId, session] of this.logSessions) {
      if (!shouldDelete(session)) continue;
      this.logSessions.delete(sessionId);
      this.logSamples.delete(sessionId);
    }
  }
}

function batchItemKey(batchId: string, deviceId: string): string {
  return `${batchId}\u0000${deviceId}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function maybeClone<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}

function sorted<T>(values: Iterable<T>, key: (value: T) => string): T[] {
  return Array.from(values).sort((left, right) =>
    key(left).localeCompare(key(right)),
  );
}

function canonicalNetwork(
  network: ManagedNetwork,
  existing: ManagedNetwork | undefined,
): ManagedNetwork {
  return clone({
    ...network,
    settings: normalizeManagedNetworkSettings(network.settings),
    createdAt: existing?.createdAt ?? network.createdAt,
  });
}
