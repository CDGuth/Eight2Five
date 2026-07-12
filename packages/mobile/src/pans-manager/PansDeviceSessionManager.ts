import {
  connect,
  disconnect,
  patchOperationMode,
  readDeviceInfo,
  readLabel,
  readLocationDataMode,
  readNetworkId,
  readOperationMode,
  readTagUpdateRate,
  writeLabel,
  writeLocationDataMode,
  writeNetworkId,
  writePersistedPosition,
} from "expo-pans-ble-api";
import type {
  PansDeviceInfo,
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
  writePersistedPosition(
    deviceId: string,
    position: Omit<PansPosition, "zMeters" | "quality"> & {
      zMeters?: number;
      quality?: number;
    },
  ): Promise<boolean>;
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

export interface PansSessionOptions {
  timeoutMs?: number;
}

/** Owns every manager-domain connection and serializes mutating transactions globally. */
export class PansDeviceSessionManager {
  private readonly connections = new Map<string, ConnectionEntry>();
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly gateway: PansNativeGateway = defaultPansNativeGateway,
    private readonly defaultTimeoutMs = 10_000,
  ) {}

  async withConnectedDevice<T>(
    transportDeviceId: string,
    operation: (session: ConnectedPansSession) => Promise<T>,
    options: PansSessionOptions = {},
  ): Promise<T> {
    return await this.serializeMutation(async () => {
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
  }

  async openLiveSession(
    transportDeviceId: string,
    options: PansSessionOptions = {},
  ): Promise<PansLiveSession> {
    await this.acquire(transportDeviceId, options.timeoutMs);
    let closed = false;
    return {
      ...this.connectedSession(transportDeviceId),
      close: async () => {
        if (closed) return;
        closed = true;
        await this.release(transportDeviceId);
      },
    };
  }

  async closeDevice(deviceId: string): Promise<void> {
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
    const deviceIds = Array.from(this.connections.keys());
    const results = await Promise.allSettled(
      deviceIds.map(async (id) => await this.closeDevice(id)),
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
      writePersistedPosition: async (position) =>
        await this.gateway.writePersistedPosition(transportDeviceId, position),
    };
  }
}
