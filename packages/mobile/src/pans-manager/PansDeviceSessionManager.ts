import {
  addConnectionStateChangedListener,
  addLocationDataListener,
  connect,
  decodeLocationData,
  getCapabilities,
  disconnect,
  patchOperationMode,
  readAnchorList,
  readAnchorMacStats,
  readClusterInfo,
  readDeviceInfo,
  readLabel,
  readLocationData,
  readLocationDataMode,
  readNetworkId,
  readOperationMode,
  requestExplicitDisconnect,
  requestMtu,
  readStatistics,
  readTagUpdateRate,
  subscribeLocationData,
  unsubscribeLocationData,
  writeLabel,
  writeLocationDataMode,
  writeNetworkId,
  writePersistedPosition,
} from "expo-pans-ble-api";
import type {
  ConnectionStateChangeEvent,
  PansAnchorList,
  PansCharacteristicNotificationEvent,
  PansClusterInfo,
  PansDeviceInfo,
  PansLocationData,
  PansLocationDataMode,
  PansOperationMode,
  PansOperationModePatch,
  PansPosition,
  PansTagUpdateRate,
} from "expo-pans-ble-api";
import { ManagerError, normalizeManagerError } from "./errors";

export interface PansNativeGateway {
  connect(deviceId: string, timeoutMs?: number): Promise<boolean>;
  disconnect(deviceId: string): Promise<boolean>;
  requestExplicitDisconnect(deviceId: string): Promise<boolean>;
  readLabel(deviceId: string): Promise<string>;
  writeLabel(deviceId: string, label: string): Promise<boolean>;
  readNetworkId(deviceId: string): Promise<number>;
  writeNetworkId(deviceId: string, panId: number): Promise<boolean>;
  readOperationMode(deviceId: string): Promise<PansOperationMode>;
  patchOperationMode(
    deviceId: string,
    patch: PansOperationModePatch,
  ): Promise<PansOperationMode>;
  readLocationDataMode(deviceId: string): Promise<PansLocationDataMode>;
  writeLocationDataMode(
    deviceId: string,
    mode: PansLocationDataMode,
  ): Promise<boolean>;
  readTagUpdateRate(deviceId: string): Promise<PansTagUpdateRate>;
  readDeviceInfo(deviceId: string): Promise<PansDeviceInfo>;
  readAnchorList(deviceId: string): Promise<PansAnchorList>;
  readClusterInfo(deviceId: string): Promise<PansClusterInfo>;
  readStatistics(deviceId: string): Promise<number[]>;
  readAnchorMacStats(deviceId: string): Promise<number[]>;
  readLocationData(deviceId: string): Promise<PansLocationData>;
  subscribeLocationData(deviceId: string): Promise<boolean>;
  unsubscribeLocationData(deviceId: string): Promise<boolean>;
  addLocationDataListener(
    listener: (event: PansLocationNotification) => void,
  ): PansLocationSubscription;
  addConnectionStateChangedListener?(
    listener: (event: PansConnectionStateEvent) => void,
  ): PansLocationSubscription;
  decodeLocationData(payload: number[]): PansLocationData;
  requestMtu?(deviceId: string, mtu: number): Promise<number | undefined>;
  writePersistedPosition(
    deviceId: string,
    position: Omit<PansPosition, "zMeters" | "quality"> & {
      zMeters?: number;
      quality?: number;
    },
  ): Promise<boolean>;
}

/** Manager-safe notification shape; characteristic UUIDs remain in the gateway. */
export interface PansLocationNotification {
  transportDeviceId: string;
  payload: number[];
  sequence?: number;
  monotonicTimestampMs?: number;
  payloadLength?: number;
}

export interface PansLocationSubscription {
  remove(): void;
}

/** Manager-safe connection event used by app-level session owners. */
export type PansConnectionStateEvent = ConnectionStateChangeEvent;

export const defaultPansNativeGateway: PansNativeGateway = {
  connect,
  disconnect,
  requestExplicitDisconnect,
  readLabel,
  writeLabel,
  readNetworkId,
  writeNetworkId,
  readOperationMode,
  patchOperationMode,
  readLocationDataMode,
  writeLocationDataMode,
  readTagUpdateRate,
  readDeviceInfo,
  readAnchorList,
  readClusterInfo,
  readStatistics,
  readAnchorMacStats,
  readLocationData,
  subscribeLocationData,
  unsubscribeLocationData,
  addLocationDataListener: (listener) =>
    addLocationDataListener((event: PansCharacteristicNotificationEvent) =>
      listener({
        transportDeviceId: event.deviceId,
        payload: event.payload,
        sequence: event.sequence,
        monotonicTimestampMs: event.monotonicTimestampMs,
        payloadLength: event.payloadLength,
      }),
    ),
  addConnectionStateChangedListener,
  decodeLocationData,
  requestMtu: async (deviceId, mtu) =>
    getCapabilities().supportsMtuRequest
      ? await requestMtu(deviceId, mtu)
      : undefined,
  writePersistedPosition,
};

export interface ConnectedPansSession {
  readonly transportDeviceId: string;
  readLabel(): Promise<string>;
  writeLabel(label: string): Promise<boolean>;
  readNetworkId(): Promise<number>;
  writeNetworkId(panId: number): Promise<boolean>;
  readOperationMode(): Promise<PansOperationMode>;
  patchOperationMode(patch: PansOperationModePatch): Promise<PansOperationMode>;
  readLocationDataMode(): Promise<PansLocationDataMode>;
  writeLocationDataMode(mode: PansLocationDataMode): Promise<boolean>;
  readTagUpdateRate(): Promise<PansTagUpdateRate>;
  readDeviceInfo(): Promise<PansDeviceInfo>;
  readAnchorList(): Promise<PansAnchorList>;
  readClusterInfo(): Promise<PansClusterInfo>;
  readStatistics(): Promise<number[]>;
  readAnchorMacStats(): Promise<number[]>;
  readLocationData(): Promise<PansLocationData>;
  subscribeLocationData(): Promise<boolean>;
  unsubscribeLocationData(): Promise<boolean>;
  addLocationDataListener(
    listener: (event: PansLocationNotification) => void,
  ): PansLocationSubscription;
  decodeLocationData(payload: number[]): PansLocationData;
  requestMtu?(mtu: number): Promise<number | undefined>;
  writePersistedPosition(
    position: Omit<PansPosition, "zMeters" | "quality"> & {
      zMeters?: number;
      quality?: number;
    },
  ): Promise<boolean>;
}

export interface PansLiveSession extends ConnectedPansSession {
  close(): Promise<void>;
}

interface ConnectionEntry {
  connection: Promise<void>;
  leases: number;
}

interface LiveLease {
  deviceId: string;
  token: symbol;
}

export interface PansSessionOptions {
  timeoutMs?: number;
}

/** Owns every manager-domain connection and serializes mutating transactions globally. */
export class PansDeviceSessionManager {
  private readonly connections = new Map<string, ConnectionEntry>();
  private mutationTail: Promise<void> = Promise.resolve();
  private pendingMutations = 0;
  private liveLease?: LiveLease;

  constructor(
    private readonly gateway: PansNativeGateway = defaultPansNativeGateway,
    private readonly defaultTimeoutMs = 10_000,
  ) {}

  async withConnectedDevice<T>(
    transportDeviceId: string,
    operation: (session: ConnectedPansSession) => Promise<T>,
    options: PansSessionOptions = {},
  ): Promise<T> {
    this.assertNoLiveLease();
    this.pendingMutations += 1;
    try {
      return await this.serializeMutation(async () => {
        this.assertNoLiveLease();
        await this.acquire(transportDeviceId, options.timeoutMs);
        let operationError: ManagerError | undefined;
        try {
          return await operation(this.connectedSession(transportDeviceId));
        } catch (error) {
          operationError = normalizeManagerError(error);
          throw operationError;
        } finally {
          try {
            await this.release(transportDeviceId);
          } catch (cleanupError) {
            if (!operationError) throw cleanupError;
          }
        }
      });
    } finally {
      this.pendingMutations -= 1;
    }
  }

  async openLiveSession(
    transportDeviceId: string,
    options: PansSessionOptions = {},
  ): Promise<PansLiveSession> {
    if (this.liveLease || this.pendingMutations > 0) throw sessionBusyError();
    const lease: LiveLease = {
      deviceId: transportDeviceId,
      token: Symbol("pans-live-session"),
    };
    // Reserve the one global live slot before connecting so concurrent opens
    // cannot both pass the check above.
    this.liveLease = lease;
    try {
      await this.acquire(transportDeviceId, options.timeoutMs);
    } catch (error) {
      if (this.liveLease?.token === lease.token) this.liveLease = undefined;
      throw error;
    }
    let closed = false;
    return {
      ...this.connectedSession(transportDeviceId),
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await this.release(transportDeviceId);
        } finally {
          if (this.liveLease?.token === lease.token) this.liveLease = undefined;
        }
      },
    };
  }

  async closeDevice(deviceId: string): Promise<void> {
    if (this.liveLease?.deviceId === deviceId || this.pendingMutations > 0)
      throw sessionBusyError();
    await this.forceCloseDevice(deviceId);
  }

  private async forceCloseDevice(deviceId: string): Promise<void> {
    const entry = this.connections.get(deviceId);
    if (!entry) return;
    entry.leases = 0;
    try {
      await entry.connection;
      await this.disconnectCleanly(deviceId);
    } catch (error) {
      throw normalizeManagerError(error);
    } finally {
      if (this.connections.get(deviceId) === entry)
        this.connections.delete(deviceId);
    }
  }

  async closeAll(): Promise<void> {
    this.liveLease = undefined;
    const deviceIds = Array.from(this.connections.keys());
    const results = await Promise.allSettled(
      deviceIds.map(async (id) => await this.forceCloseDevice(id)),
    );
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) throw normalizeManagerError(failure.reason);
  }

  addConnectionStateListener(
    listener: (event: PansConnectionStateEvent) => void,
  ): PansLocationSubscription {
    return (
      this.gateway.addConnectionStateChangedListener?.(listener) ?? {
        remove() {},
      }
    );
  }

  private async acquire(deviceId: string, timeoutMs?: number): Promise<void> {
    if (!deviceId.trim()) {
      throw new ManagerError("INVALID_CONFIGURATION", "Device ID is required.");
    }
    let entry = this.connections.get(deviceId);
    if (!entry) {
      const connection = Promise.resolve()
        .then(
          async () =>
            await this.gateway.connect(
              deviceId,
              timeoutMs ?? this.defaultTimeoutMs,
            ),
        )
        .then((connected) => {
          if (!connected) {
            throw new ManagerError(
              "DEVICE_OFFLINE",
              "Failed to connect to the device.",
            );
          }
        });
      entry = { connection, leases: 0 };
      this.connections.set(deviceId, entry);
    }
    entry.leases += 1;
    try {
      await entry.connection;
    } catch (error) {
      entry.leases -= 1;
      if (this.connections.get(deviceId) === entry)
        this.connections.delete(deviceId);
      throw normalizeManagerError(error);
    }
  }

  private async release(deviceId: string): Promise<void> {
    const entry = this.connections.get(deviceId);
    if (!entry) return;
    entry.leases = Math.max(0, entry.leases - 1);
    if (entry.leases > 0) return;
    try {
      await entry.connection;
      await this.disconnectCleanly(deviceId);
    } catch (error) {
      throw normalizeManagerError(error);
    } finally {
      if (this.connections.get(deviceId) === entry)
        this.connections.delete(deviceId);
    }
  }

  private async serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationTail;
    let releaseQueue!: () => void;
    this.mutationTail = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      releaseQueue();
    }
  }

  private async disconnectCleanly(deviceId: string): Promise<void> {
    try {
      await this.gateway.requestExplicitDisconnect(deviceId);
    } catch {
      // The PANS write is an Android compatibility hint. Always close GATT even
      // when older firmware does not expose or accept the characteristic.
    }
    await this.gateway.disconnect(deviceId);
  }

  private assertNoLiveLease(): void {
    if (this.liveLease) throw sessionBusyError();
  }

  private connectedSession(transportDeviceId: string): ConnectedPansSession {
    return {
      transportDeviceId,
      readLabel: async () => await this.gateway.readLabel(transportDeviceId),
      writeLabel: async (label) =>
        await this.gateway.writeLabel(transportDeviceId, label),
      readNetworkId: async () =>
        await this.gateway.readNetworkId(transportDeviceId),
      writeNetworkId: async (panId) =>
        await this.gateway.writeNetworkId(transportDeviceId, panId),
      readOperationMode: async () =>
        await this.gateway.readOperationMode(transportDeviceId),
      patchOperationMode: async (patch) =>
        await this.gateway.patchOperationMode(transportDeviceId, patch),
      readLocationDataMode: async () =>
        await this.gateway.readLocationDataMode(transportDeviceId),
      writeLocationDataMode: async (mode) =>
        await this.gateway.writeLocationDataMode(transportDeviceId, mode),
      readTagUpdateRate: async () =>
        await this.gateway.readTagUpdateRate(transportDeviceId),
      readDeviceInfo: async () =>
        await this.gateway.readDeviceInfo(transportDeviceId),
      readAnchorList: async () =>
        await this.gateway.readAnchorList(transportDeviceId),
      readClusterInfo: async () =>
        await this.gateway.readClusterInfo(transportDeviceId),
      readStatistics: async () =>
        await this.gateway.readStatistics(transportDeviceId),
      readAnchorMacStats: async () =>
        await this.gateway.readAnchorMacStats(transportDeviceId),
      readLocationData: async () =>
        await this.gateway.readLocationData(transportDeviceId),
      subscribeLocationData: async () =>
        await this.gateway.subscribeLocationData(transportDeviceId),
      unsubscribeLocationData: async () =>
        await this.gateway.unsubscribeLocationData(transportDeviceId),
      addLocationDataListener: (listener) =>
        this.gateway.addLocationDataListener(listener),
      decodeLocationData: (payload) => this.gateway.decodeLocationData(payload),
      ...(this.gateway.requestMtu
        ? {
            requestMtu: async (mtu: number) =>
              await this.gateway.requestMtu?.(transportDeviceId, mtu),
          }
        : {}),
      writePersistedPosition: async (position) =>
        await this.gateway.writePersistedPosition(transportDeviceId, position),
    };
  }
}

function sessionBusyError(): ManagerError {
  return new ManagerError(
    "GATT_FAILURE",
    "A live position session or device configuration is already active.",
    {
      isRetryable: true,
      recovery: "Stop the live position session, then retry.",
    },
  );
}
