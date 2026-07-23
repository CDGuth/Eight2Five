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
export type PansDiscoveryState =
  | "idle"
  | "starting"
  | "scanning"
  | "stopping"
  | "error";

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
  private readonly stateListeners = new Set<
    (state: PansDiscoveryState) => void
  >();
  private subscription?: RemovableSubscription;
  private errorSubscription?: RemovableSubscription;
  private diagnosticsTimer?: ReturnType<typeof setInterval>;
  private diagnostics: PansBleScanDiagnostics;
  private discoveryState: PansDiscoveryState = "idle";
  private desired = false;
  private reconcileRequested = false;
  private reconcilePromise?: Promise<void>;
  private readonly staleAfterMs: number;
  private readonly diagnosticsPollIntervalMs: number;
  private readonly noResultWatchdogMs: number;
  private readonly now: () => number;
  private pendingAsyncError?: ManagerError;

  constructor(
    private readonly gateway: PansDiscoveryGateway = defaultPansDiscoveryGateway,
    options: PansDiscoveryServiceOptions = {},
  ) {
    this.staleAfterMs = options.staleAfterMs ?? 10_000;
    this.diagnosticsPollIntervalMs = options.diagnosticsPollIntervalMs ?? 1_000;
    this.noResultWatchdogMs = options.noResultWatchdogMs ?? 5_000;
    this.now = options.now ?? Date.now;
    this.diagnostics = this.gateway.getScanDiagnostics();
  }

  get isScanning(): boolean {
    return this.discoveryState === "scanning";
  }

  get state(): PansDiscoveryState {
    return this.discoveryState;
  }

  get desiredScanning(): boolean {
    return this.desired;
  }

  getPermissionStatus(): PansBlePermissionStatus {
    return this.gateway.getPermissionStatus();
  }

  async requestPermissions(): Promise<PansBlePermissionStatus> {
    return await this.gateway.requestPermissions();
  }

  async start(): Promise<void> {
    this.desired = true;
    await this.reconcile();
  }

  async stop(): Promise<void> {
    this.desired = false;
    await this.reconcile();
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

  subscribeState(
    listener: (state: PansDiscoveryState) => void,
  ): RemovableSubscription {
    this.stateListeners.add(listener);
    listener(this.discoveryState);
    return { remove: () => this.stateListeners.delete(listener) };
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
    this.desired = false;
    this.stopDiagnosticsPolling();
    this.cleanupScanSubscriptions();
    this.setState("error");
    this.refreshDiagnostics();
    this.errorListeners.forEach((listener) => listener(normalized));
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

  private refreshDiagnostics(): void {
    const native = this.gateway.getScanDiagnostics();
    const nativeEndedScan =
      this.discoveryState === "scanning" &&
      (native.state === "stopped" || native.state === "failed");
    if (nativeEndedScan) {
      if (native.state === "failed") {
        this.desired = false;
        this.setState("error");
      } else {
        this.setState("idle");
      }
    }
    const elapsed = native.startedAtMs
      ? Math.max(0, this.now() - native.startedAtMs)
      : 0;
    const warning =
      this.discoveryState === "scanning" && elapsed >= this.noResultWatchdogMs
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
      if (this.desired) void this.reconcile();
    }
  }

  private reconcile(): Promise<void> {
    this.reconcileRequested = true;
    if (!this.reconcilePromise) {
      const operation = this.runReconciliation();
      let tracked!: Promise<void>;
      tracked = operation.finally(() => {
        if (this.reconcilePromise === tracked) {
          this.reconcilePromise = undefined;
        }
      });
      this.reconcilePromise = tracked;
    }
    return this.reconcilePromise;
  }

  private async runReconciliation(): Promise<void> {
    do {
      this.reconcileRequested = false;
      if (
        this.desired &&
        (this.discoveryState === "idle" || this.discoveryState === "error")
      ) {
        await this.startNativeScan();
      }
      if (!this.desired && this.discoveryState === "scanning") {
        this.stopNativeScan();
      }
      if (!this.desired && this.discoveryState === "error") {
        this.stopDiagnosticsPolling();
        this.cleanupScanSubscriptions();
        this.setState("idle");
        this.refreshDiagnostics();
      }
    } while (
      this.reconcileRequested ||
      (this.desired && this.discoveryState === "idle") ||
      (!this.desired && this.discoveryState === "scanning")
    );
  }

  private async startNativeScan(): Promise<void> {
    if (!permissionsGranted(this.gateway.getPermissionStatus())) {
      this.desired = false;
      this.setState("error");
      throw new ManagerError(
        "PERMISSION_DENIED",
        "Grant Bluetooth permissions before starting discovery.",
      );
    }
    this.setState("starting");
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
      this.setState("scanning");
      this.startDiagnosticsPolling();
      this.refreshDiagnostics();
    } catch (error) {
      this.gateway.stopScanning();
      this.stopDiagnosticsPolling();
      this.cleanupScanSubscriptions();
      this.desired = false;
      this.setState("error");
      throw normalizeManagerError(error);
    }
  }

  private stopNativeScan(): void {
    this.setState("stopping");
    this.gateway.stopScanning();
    this.stopDiagnosticsPolling();
    this.cleanupScanSubscriptions();
    this.setState("idle");
    this.refreshDiagnostics();
  }

  private setState(state: PansDiscoveryState): void {
    if (this.discoveryState === state) return;
    this.discoveryState = state;
    this.stateListeners.forEach((listener) => listener(state));
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
