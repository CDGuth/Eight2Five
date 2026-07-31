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

export interface PansManagerRepository {
  initialize(): Promise<void>;

  listNetworks(): Promise<ManagedNetwork[]>;
  getNetwork(id: string): Promise<ManagedNetwork | undefined>;
  saveNetwork(network: ManagedNetwork): Promise<ManagedNetwork>;
  saveNetworks(networks: ManagedNetwork[]): Promise<ManagedNetwork[]>;
  deleteNetwork(id: string): Promise<void>;

  listDevices(): Promise<ManagedDevice[]>;
  getDevice(deviceId: string): Promise<ManagedDevice | undefined>;
  saveDevice(device: ManagedDevice): Promise<ManagedDevice>;
  deleteDevice(deviceId: string): Promise<void>;

  listNetworkDevices(networkId: string): Promise<ManagedDevice[]>;
  associateDevice(
    association: NetworkDeviceAssociation,
  ): Promise<ManagedDevice>;
  dissociateDevice(
    networkId: string,
    deviceId: string,
    dissociatedAt?: number,
  ): Promise<ManagedDevice>;

  getSettings(): Promise<PansManagerSettings | undefined>;
  saveSettings(settings: PansManagerSettings): Promise<PansManagerSettings>;

  saveDeviceSnapshot(
    snapshot: DeviceConfigurationSnapshot,
  ): Promise<DeviceConfigurationSnapshot>;
  getLatestDeviceSnapshots(
    deviceIds: string[],
  ): Promise<Record<string, DeviceConfigurationSnapshot | undefined>>;
  getLatestDeviceSnapshot(
    deviceId: string,
  ): Promise<DeviceConfigurationSnapshot | undefined>;
  listDeviceSnapshots(deviceId: string): Promise<DeviceConfigurationSnapshot[]>;

  saveBatchOperation(operation: PansBatchOperationRecord): Promise<void>;
  getBatchOperation(id: string): Promise<PansBatchOperationRecord | undefined>;
  listBatchOperations(): Promise<PansBatchOperationRecord[]>;
  saveBatchItem(item: PansBatchOperationItem): Promise<void>;
  listBatchItems(batchId: string): Promise<PansBatchOperationItem[]>;

  savePositionLogSession(session: PositionLogSession): Promise<void>;
  getPositionLogSession(id: string): Promise<PositionLogSession | undefined>;
  listPositionLogSessions(): Promise<PositionLogSession[]>;
  appendPositionLogSamples(samples: PositionLogSample[]): Promise<void>;
  listPositionLogSamples(sessionId: string): Promise<PositionLogSample[]>;
}
