import {
  addDeviceDiscoveredListener,
  addErrorListener,
  clearDevices,
  getPermissionStatus,
  getScanDiagnostics,
  requestPermissions,
  startScanning,
  stopScanning,
} from "expo-pans-ble-api";
import type {
  PansApiError,
  PansBleDevice,
  PansBlePermissionStatus,
  PansBleScanDiagnostics,
} from "expo-pans-ble-api";
import { ManagerError, normalizeManagerError } from "./errors";
import type { DiscoveredDeviceSnapshot } from "./types";

export type PansDiscoveryDiagnostics = PansBleScanDiagnostics;

export interface RemovableSubscription {
  remove(): void;
}

export interface PansDiscoveryGateway {
  getPermissionStatus(): PansBlePermissionStatus;
  requestPermissions(): Promise<PansBlePermissionStatus>;
  startScanning(): Promise<void>;
  stopScanning(): void;
  clearDevices(): void;
  getScanDiagnostics(): PansBleScanDiagnostics;
  addDeviceDiscoveredListener(
    listener: (event: { devices: PansBleDevice[] }) => void,
  ): RemovableSubscription;
  addErrorListener(
    listener: (event: PansApiError) => void,
  ): RemovableSubscription;
}

export const defaultPansDiscoveryGateway: PansDiscoveryGateway = {
  getPermissionStatus,
  requestPermissions,
  startScanning,
  stopScanning,
  clearDevices,
  getScanDiagnostics,
  addDeviceDiscoveredListener,
  addErrorListener,
};

export interface PansDiscoveryServiceOptions {
  staleAfterMs?: number;
  diagnosticsPollIntervalMs?: number;
  noResultWatchdogMs?: number;
  scanDurationMs?: number;
  restartCooldownMs?: number;
  now?: () => number;
}

export class PansDiscoveryService {
  private readonly devices = new Map<string, DiscoveredDeviceSnapshot>();
  private readonly listeners = new Set<
    (snapshots: DiscoveredDeviceSnapshot[]) => void
  >();
  private readonly errorListeners = new Set<(error: ManagerError) => void>();
  private readonly diagnosticsListeners = new Set<
    (diagnostics: PansBleScanDiagnostics) => void
  >();
  private subscription?: RemovableSubscription;
  private errorSubscription?: RemovableSubscription;
  private diagnosticsTimer?: ReturnType<typeof setInterval>;
  private scanStopTimer?: ReturnType<typeof setTimeout>;
  private diagnostics: PansBleScanDiagnostics;
  private scanning = false;
  private readonly staleAfterMs: number;
  private readonly diagnosticsPollIntervalMs: number;
  private readonly noResultWatchdogMs: number;
  private readonly scanDurationMs: number;
  private readonly restartCooldownMs: number;
  private readonly now: () => number;
  private pendingAsyncError?: ManagerError;
  private lastStoppedAt?: number;

  constructor(
    private readonly gateway: PansDiscoveryGateway = defaultPansDiscoveryGateway,
    options: PansDiscoveryServiceOptions = {},
  ) {
    this.staleAfterMs = options.staleAfterMs ?? 10_000;
    this.diagnosticsPollIntervalMs = options.diagnosticsPollIntervalMs ?? 1_000;
    this.noResultWatchdogMs = options.noResultWatchdogMs ?? 5_000;
    this.scanDurationMs = options.scanDurationMs ?? 25_000;
    this.restartCooldownMs = options.restartCooldownMs ?? 3_000;
    this.now = options.now ?? Date.now;
    this.diagnostics = this.gateway.getScanDiagnostics();
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
    if (
      this.lastStoppedAt !== undefined &&
      this.now() - this.lastStoppedAt < this.restartCooldownMs
    ) {
      throw new ManagerError(
        "SCAN_THROTTLED",
        "Wait a few seconds before starting another Bluetooth scan.",
      );
    }
    if (!permissionsGranted(this.gateway.getPermissionStatus())) {
      throw new ManagerError(
        "PERMISSION_DENIED",
        "Grant Bluetooth permissions before starting discovery.",
      );
    }
    this.subscription = this.gateway.addDeviceDiscoveredListener((event) => {
      this.receiveDevices(event.devices);
    });
    this.errorSubscription = this.gateway.addErrorListener((error) => {
      this.handleNativeError(error);
    });
    this.pendingAsyncError = undefined;
    try {
      await this.gateway.startScanning();
      if (this.pendingAsyncError) throw this.pendingAsyncError;
      this.scanning = true;
      this.refreshDiagnostics();
      this.startDiagnosticsPolling();
      this.scanStopTimer = setTimeout(() => this.stop(), this.scanDurationMs);
    } catch (error) {
      this.cleanupScanSubscriptions();
      throw normalizeManagerError(error);
    }
  }

  stop(): void {
    const wasScanning = this.scanning;
    if (this.scanning) this.gateway.stopScanning();
    this.scanning = false;
    this.clearScanStopTimer();
    this.stopDiagnosticsPolling();
    this.cleanupScanSubscriptions();
    this.refreshDiagnostics();
    if (wasScanning) this.lastStoppedAt = this.now();
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

  subscribeErrors(
    listener: (error: ManagerError) => void,
  ): RemovableSubscription {
    this.errorListeners.add(listener);
    return { remove: () => this.errorListeners.delete(listener) };
  }

  subscribeDiagnostics(
    listener: (diagnostics: PansBleScanDiagnostics) => void,
  ): RemovableSubscription {
    this.diagnosticsListeners.add(listener);
    listener(this.getDiagnostics());
    return { remove: () => this.diagnosticsListeners.delete(listener) };
  }

  getDiagnostics(): PansBleScanDiagnostics {
    return clone(this.diagnostics);
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
    this.refreshDiagnostics();
  }

  private emit(): void {
    const snapshots = this.getSnapshots();
    this.listeners.forEach((listener) => listener(snapshots));
  }

  private handleNativeError(error: PansApiError): void {
    const normalized = normalizeManagerError(error, { operation: "discovery" });
    this.pendingAsyncError = normalized;
    const wasScanning = this.scanning;
    this.scanning = false;
    this.clearScanStopTimer();
    this.stopDiagnosticsPolling();
    this.cleanupScanSubscriptions();
    this.refreshDiagnostics();
    this.errorListeners.forEach((listener) => listener(normalized));
    if (wasScanning) this.lastStoppedAt = this.now();
  }

  private startDiagnosticsPolling(): void {
    this.stopDiagnosticsPolling();
    this.diagnosticsTimer = setInterval(() => {
      this.refreshDiagnostics();
    }, this.diagnosticsPollIntervalMs);
  }

  private stopDiagnosticsPolling(): void {
    if (this.diagnosticsTimer) clearInterval(this.diagnosticsTimer);
    this.diagnosticsTimer = undefined;
  }

  private clearScanStopTimer(): void {
    if (this.scanStopTimer) clearTimeout(this.scanStopTimer);
    this.scanStopTimer = undefined;
  }

  private refreshDiagnostics(): void {
    const native = this.gateway.getScanDiagnostics();
    const nativeEndedScan =
      this.scanning &&
      (native.state === "stopped" || native.state === "failed");
    if (nativeEndedScan) {
      this.scanning = false;
      this.clearScanStopTimer();
    }
    const elapsed = native.startedAtMs
      ? Math.max(0, this.now() - native.startedAtMs)
      : 0;
    const warning =
      this.scanning && elapsed >= this.noResultWatchdogMs
        ? native.rawResultCount === 0
          ? "The scan started, but Android has not delivered any BLE results. Check precise location, Location services, and Bluetooth state."
          : native.pansResultCount === 0
            ? "Android is delivering BLE results, but none match a DWM1001 PANS advertisement. Press SW2 and verify the PANS service-data record."
            : undefined
        : undefined;
    const next = { ...native, ...(warning ? { warning } : {}) };
    if (JSON.stringify(next) !== JSON.stringify(this.diagnostics)) {
      this.diagnostics = next;
      const snapshot = this.getDiagnostics();
      this.diagnosticsListeners.forEach((listener) => listener(snapshot));
    }
    if (nativeEndedScan) {
      this.stopDiagnosticsPolling();
      this.cleanupScanSubscriptions();
      this.lastStoppedAt = this.now();
    }
  }

  private cleanupScanSubscriptions(): void {
    this.subscription?.remove();
    this.subscription = undefined;
    this.errorSubscription?.remove();
    this.errorSubscription = undefined;
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
    (!status.location || status.location === "granted") &&
    (!status.bluetoothState || status.bluetoothState === "enabled") &&
    (!status.locationServices || status.locationServices === "enabled")
  );
}

function snapshotFingerprint(snapshot: DiscoveredDeviceSnapshot): string {
  const { stale: _stale, ...stable } = snapshot;
  return JSON.stringify(stable);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
