import {
  addLocationDataListener,
  connect,
  decodeLocationData,
  disconnect,
  patchOperationMode,
  readAnchorList,
  readClusterInfo,
  readDeviceInfo,
  readLabel,
  readLocationData,
  readLocationDataMode,
  readNetworkId,
  readOperationMode,
  readTagUpdateRate,
  subscribeLocationData,
  unsubscribeLocationData,
  writeLabel,
  writeLocationDataMode,
  writeNetworkId,
  writePersistedPosition,
} from "expo-pans-ble-api";
import type {
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
  readLocationData(deviceId: string): Promise<PansLocationData>;
  subscribeLocationData(deviceId: string): Promise<boolean>;
  unsubscribeLocationData(deviceId: string): Promise<boolean>;
  addLocationDataListener(
    listener: (event: PansLocationNotification) => void,
  ): PansLocationSubscription;
  decodeLocationData(payload: number[]): PansLocationData;
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
}

export interface PansLocationSubscription {
  remove(): void;
}

export const defaultPansNativeGateway: PansNativeGateway = {
  connect,
  disconnect,
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
  readLocationData,
  subscribeLocationData,
  unsubscribeLocationData,
  addLocationDataListener: (listener) =>
    addLocationDataListener((event: PansCharacteristicNotificationEvent) =>
      listener({
        transportDeviceId: event.deviceId,
        payload: event.payload,
      }),
    ),
  decodeLocationData,
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
  readLocationData(): Promise<PansLocationData>;
  subscribeLocationData(): Promise<boolean>;
  unsubscribeLocationData(): Promise<boolean>;
  addLocationDataListener(
    listener: (event: PansLocationNotification) => void,
  ): PansLocationSubscription;
  decodeLocationData(payload: number[]): PansLocationData;
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
      await this.gateway.disconnect(deviceId);
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
      await this.gateway.disconnect(deviceId);
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
      readLocationData: async () =>
        await this.gateway.readLocationData(transportDeviceId),
      subscribeLocationData: async () =>
        await this.gateway.subscribeLocationData(transportDeviceId),
      unsubscribeLocationData: async () =>
        await this.gateway.unsubscribeLocationData(transportDeviceId),
      addLocationDataListener: (listener) =>
        this.gateway.addLocationDataListener(listener),
      decodeLocationData: (payload) => this.gateway.decodeLocationData(payload),
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
