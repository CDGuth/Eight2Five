import {
  addDeviceDiscoveredListener,
  clearDevices,
  getPermissionStatus,
  requestPermissions,
  startScanning,
  stopScanning,
} from "expo-pans-ble-api";
import type { PansBleDevice, PansBlePermissionStatus } from "expo-pans-ble-api";
import { ManagerError, normalizeManagerError } from "./errors";
import type { DiscoveredDeviceSnapshot } from "./types";

export interface RemovableSubscription {
  remove(): void;
}

export interface PansDiscoveryGateway {
  getPermissionStatus(): PansBlePermissionStatus;
  requestPermissions(): Promise<PansBlePermissionStatus>;
  startScanning(): Promise<void>;
  stopScanning(): void;
  clearDevices(): void;
  addDeviceDiscoveredListener(
    listener: (event: { devices: PansBleDevice[] }) => void,
  ): RemovableSubscription;
}

export const defaultPansDiscoveryGateway: PansDiscoveryGateway = {
  getPermissionStatus,
  requestPermissions,
  startScanning,
  stopScanning,
  clearDevices,
  addDeviceDiscoveredListener,
};

export interface PansDiscoveryServiceOptions {
  staleAfterMs?: number;
  now?: () => number;
}

export class PansDiscoveryService {
  private readonly devices = new Map<string, DiscoveredDeviceSnapshot>();
  private readonly listeners = new Set<
    (snapshots: DiscoveredDeviceSnapshot[]) => void
  >();
  private subscription?: RemovableSubscription;
  private scanning = false;
  private readonly staleAfterMs: number;
  private readonly now: () => number;

  constructor(
    private readonly gateway: PansDiscoveryGateway = defaultPansDiscoveryGateway,
    options: PansDiscoveryServiceOptions = {},
  ) {
    this.staleAfterMs = options.staleAfterMs ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  get isScanning(): boolean {
    return this.scanning;
  }

  getPermissionStatus(): PansBlePermissionStatus {
    return this.gateway.getPermissionStatus();
  }

  async requestPermissions(): Promise<PansBlePermissionStatus> {
    return await this.gateway.requestPermissions();
  }

  async start(): Promise<void> {
    if (this.scanning) return;
    if (!permissionsGranted(this.gateway.getPermissionStatus())) {
      throw new ManagerError(
        "PERMISSION_DENIED",
        "Grant Bluetooth permissions before starting discovery.",
      );
    }
    this.subscription = this.gateway.addDeviceDiscoveredListener((event) => {
      this.receiveDevices(event.devices);
    });
    try {
      await this.gateway.startScanning();
      this.scanning = true;
    } catch (error) {
      this.subscription.remove();
      this.subscription = undefined;
      throw normalizeManagerError(error);
    }
  }

  stop(): void {
    if (this.scanning) this.gateway.stopScanning();
    this.scanning = false;
    this.subscription?.remove();
    this.subscription = undefined;
  }

  clear(): void {
    this.gateway.clearDevices();
    this.devices.clear();
    this.emit();
  }

  subscribe(
    listener: (snapshots: DiscoveredDeviceSnapshot[]) => void,
  ): RemovableSubscription {
    this.listeners.add(listener);
    listener(this.getSnapshots());
    return { remove: () => this.listeners.delete(listener) };
  }

  getSnapshots(atMs = this.now()): DiscoveredDeviceSnapshot[] {
    return Array.from(this.devices.values())
      .map((snapshot) => {
        const copy = clone(snapshot);
        return {
          ...copy,
          stale: atMs - snapshot.lastSeenAt > this.staleAfterMs,
        };
      })
      .sort(
        (left, right) =>
          right.lastSeenAt - left.lastSeenAt ||
          left.transportDeviceId.localeCompare(right.transportDeviceId),
      );
  }

  /** Public for deterministic adapters/tests; it never starts scanning or configures a device. */
  receiveDevices(devices: PansBleDevice[]): void {
    let changed = false;
    const receivedAt = this.now();
    for (const device of devices) {
      const identity =
        typeof device?.deviceId === "string" ? device.deviceId.trim() : "";
      const key = identity || `malformed:${JSON.stringify(device)}`;
      const previous = this.devices.get(key);
      const classified = classifyDevice(device);
      const next: DiscoveredDeviceSnapshot = {
        transportDeviceId: identity,
        ...(device.macAddress || device.mac
          ? { macAddress: device.macAddress ?? device.mac }
          : {}),
        ...(device.name ? { name: device.name } : {}),
        rssi: device.rssi,
        ...(device.presence ? { presence: clone(device.presence) } : {}),
        rawDevice: clone(device),
        ...classified,
        firstSeenAt: previous?.firstSeenAt ?? receivedAt,
        lastSeenAt: Number.isFinite(device.lastSeenMs)
          ? device.lastSeenMs
          : receivedAt,
        stale: false,
      };
      if (
        !previous ||
        snapshotFingerprint(previous) !== snapshotFingerprint(next)
      ) {
        this.devices.set(key, next);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private emit(): void {
    const snapshots = this.getSnapshots();
    this.listeners.forEach((listener) => listener(snapshots));
  }
}

export function classifyDevice(
  device: PansBleDevice,
): Pick<DiscoveredDeviceSnapshot, "compatibility" | "reason"> {
  if (
    !device ||
    typeof device.deviceId !== "string" ||
    !device.deviceId.trim() ||
    !Number.isFinite(device.rssi) ||
    !Number.isFinite(device.lastSeenMs)
  ) {
    return {
      compatibility: "malformed",
      reason: "Discovery data is malformed.",
    };
  }
  if (!device.presence) {
    return {
      compatibility: "unknown",
      reason: "PANS presence data is unavailable.",
    };
  }
  if (device.presence.uwbMode === undefined) {
    return {
      compatibility: "incompatible",
      reason: "The advertised UWB mode is unsupported.",
    };
  }
  return { compatibility: "compatible" };
}

function permissionsGranted(status: PansBlePermissionStatus): boolean {
  return (
    status.bluetooth === "granted" &&
    (!status.location || status.location === "granted")
  );
}

function snapshotFingerprint(snapshot: DiscoveredDeviceSnapshot): string {
  const { stale: _stale, ...stable } = snapshot;
  return JSON.stringify(stable);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
