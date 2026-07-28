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
/** Discovery telemetry is published to UI subscribers at no more than 5 Hz by default. */
export const DEFAULT_PANS_DISCOVERY_PUBLICATION_INTERVAL_MS = 200;
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
  /** Minimum interval between RSSI/last-seen-only UI publications. Defaults to 200 ms (5 Hz). */
  telemetryPublicationIntervalMs?: number;
  diagnosticsPollIntervalMs?: number;
  noResultWatchdogMs?: number;
  now?: () => number;
  setTimeout?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimeout?: (timer: ReturnType<typeof setTimeout>) => void;
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
  private telemetryTimer?: ReturnType<typeof setTimeout>;
  private stalenessTimer?: ReturnType<typeof setTimeout>;
  private diagnostics: PansBleScanDiagnostics;
  private discoveryState: PansDiscoveryState = "idle";
  private desired = false;
  private reconcileRequested = false;
  private reconcilePromise?: Promise<void>;
  private readonly staleAfterMs: number;
  private readonly telemetryPublicationIntervalMs: number;
  private readonly diagnosticsPollIntervalMs: number;
  private readonly noResultWatchdogMs: number;
  private readonly now: () => number;
  private readonly scheduleTimeout: NonNullable<
    PansDiscoveryServiceOptions["setTimeout"]
  >;
  private readonly cancelTimeout: NonNullable<
    PansDiscoveryServiceOptions["clearTimeout"]
  >;
  private lastPublicationAt?: number;
  private telemetryPublicationPending = false;
  private readonly publishedStale = new Map<string, boolean>();
  private pendingAsyncError?: ManagerError;

  constructor(
    private readonly gateway: PansDiscoveryGateway = defaultPansDiscoveryGateway,
    options: PansDiscoveryServiceOptions = {},
  ) {
    this.staleAfterMs = options.staleAfterMs ?? 10_000;
    this.telemetryPublicationIntervalMs =
      options.telemetryPublicationIntervalMs ??
      DEFAULT_PANS_DISCOVERY_PUBLICATION_INTERVAL_MS;
    this.diagnosticsPollIntervalMs = options.diagnosticsPollIntervalMs ?? 1_000;
    this.noResultWatchdogMs = options.noResultWatchdogMs ?? 5_000;
    this.now = options.now ?? Date.now;
    this.scheduleTimeout = options.setTimeout ?? setTimeout;
    this.cancelTimeout = options.clearTimeout ?? clearTimeout;
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
    this.cancelDiscoveryTimers();
  }

  clear(): void {
    this.gateway.clearDevices();
    this.cancelDiscoveryTimers();
    this.devices.clear();
    this.emitImmediately();
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
    return cloneDiagnostics(this.diagnostics);
  }

  getSnapshots(atMs = this.now()): DiscoveredDeviceSnapshot[] {
    return Array.from(this.devices.values())
      .map((snapshot) => {
        const copy = cloneSnapshot(snapshot);
        return {
          ...copy,
          stale: isStale(snapshot, atMs, this.staleAfterMs),
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
    let publishImmediately = false;
    let telemetryChanged = false;
    const receivedAt = this.now();
    for (const [index, device] of devices.entries()) {
      const identity =
        typeof device?.deviceId === "string" ? device.deviceId.trim() : "";
      const key = identity || malformedDeviceKey(device, index);
      const previous = this.devices.get(key);
      const classified = classifyDevice(device);
      const rawDevice = cloneDevice(device);
      const next: DiscoveredDeviceSnapshot = {
        transportDeviceId: identity,
        ...(device.macAddress || device.mac
          ? { macAddress: device.macAddress ?? device.mac }
          : {}),
        ...(device.name ? { name: device.name } : {}),
        rssi: device.rssi,
        ...(device.presence
          ? { presence: clonePresence(device.presence) }
          : {}),
        rawDevice,
        ...classified,
        firstSeenAt: previous?.firstSeenAt ?? receivedAt,
        lastSeenAt: Number.isFinite(device.lastSeenMs)
          ? device.lastSeenMs
          : receivedAt,
        stale: false,
      };
      // Always retain the exact latest diagnostic record, even when only an
      // unrendered raw field changed.
      this.devices.set(key, next);
      if (!previous) publishImmediately = true;
      else if (
        !sameSnapshotSemantics(previous, next) ||
        isStale(previous, receivedAt, this.staleAfterMs) !==
          isStale(next, receivedAt, this.staleAfterMs)
      )
        publishImmediately = true;
      else if (
        previous.rssi !== next.rssi ||
        previous.lastSeenAt !== next.lastSeenAt
      )
        telemetryChanged = true;
    }
    if (publishImmediately) this.emitImmediately();
    else if (telemetryChanged) this.scheduleTelemetryPublication();
    this.scheduleStalenessPublication();
    this.refreshDiagnostics();
  }

  private emitImmediately(): void {
    this.cancelTelemetryTimer();
    this.publishSnapshots();
  }

  private publishSnapshots(): void {
    const publishedAt = this.now();
    const snapshots = this.getSnapshots(publishedAt);
    this.lastPublicationAt = publishedAt;
    this.telemetryPublicationPending = false;
    this.publishedStale.clear();
    for (const [key, snapshot] of this.devices) {
      this.publishedStale.set(
        key,
        isStale(snapshot, publishedAt, this.staleAfterMs),
      );
    }
    this.listeners.forEach((listener) => listener(snapshots));
  }

  private scheduleTelemetryPublication(): void {
    this.telemetryPublicationPending = true;
    if (this.telemetryTimer) return;
    const elapsed =
      this.lastPublicationAt !== undefined
        ? this.now() - this.lastPublicationAt
        : this.telemetryPublicationIntervalMs;
    const delay = Math.max(0, this.telemetryPublicationIntervalMs - elapsed);
    this.telemetryTimer = this.scheduleTimeout(() => {
      this.telemetryTimer = undefined;
      this.publishSnapshots();
    }, delay);
  }

  private scheduleStalenessPublication(): void {
    this.cancelStalenessTimer();
    const now = this.now();
    let nextDeadline = Number.POSITIVE_INFINITY;
    for (const snapshot of this.devices.values()) {
      if (!isStale(snapshot, now, this.staleAfterMs)) {
        nextDeadline = Math.min(
          nextDeadline,
          snapshot.lastSeenAt + this.staleAfterMs,
        );
      }
    }
    if (!Number.isFinite(nextDeadline)) return;
    this.stalenessTimer = this.scheduleTimeout(
      () => {
        this.stalenessTimer = undefined;
        const transitioned = Array.from(this.devices.entries()).some(
          ([key, snapshot]) =>
            isStale(snapshot, this.now(), this.staleAfterMs) &&
            this.publishedStale.get(key) === false,
        );
        if (transitioned) this.emitImmediately();
        this.scheduleStalenessPublication();
      },
      Math.max(0, nextDeadline - now),
    );
  }

  private handleNativeError(error: PansApiError): void {
    const normalized = normalizeManagerError(error, { operation: "discovery" });
    this.pendingAsyncError = normalized;
    this.desired = false;
    this.stopDiagnosticsPolling();
    this.cancelDiscoveryTimers();
    this.cleanupScanSubscriptions();
    this.setState("error");
    this.emitImmediately();
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
    if (!sameDiagnostics(next, this.diagnostics)) {
      this.diagnostics = next;
      const snapshot = this.getDiagnostics();
      this.diagnosticsListeners.forEach((listener) => listener(snapshot));
    }
    if (nativeEndedScan) {
      if (native.state === "failed") this.emitImmediately();
      this.cancelDiscoveryTimers();
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
      this.publishOverdueStaleness();
      this.startDiagnosticsPolling();
      this.refreshDiagnostics();
    } catch (error) {
      this.gateway.stopScanning();
      this.stopDiagnosticsPolling();
      this.cancelDiscoveryTimers();
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
    this.cancelDiscoveryTimers();
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

  private publishOverdueStaleness(): void {
    const transitioned =
      this.telemetryPublicationPending ||
      Array.from(this.devices.entries()).some(
        ([key, snapshot]) =>
          isStale(snapshot, this.now(), this.staleAfterMs) !==
          this.publishedStale.get(key),
      );
    if (transitioned) this.emitImmediately();
    this.scheduleStalenessPublication();
  }

  private cancelDiscoveryTimers(): void {
    this.cancelTelemetryTimer();
    this.cancelStalenessTimer();
  }

  private cancelTelemetryTimer(): void {
    if (this.telemetryTimer) this.cancelTimeout(this.telemetryTimer);
    this.telemetryTimer = undefined;
  }

  private cancelStalenessTimer(): void {
    if (this.stalenessTimer) this.cancelTimeout(this.stalenessTimer);
    this.stalenessTimer = undefined;
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

function isStale(
  snapshot: DiscoveredDeviceSnapshot,
  atMs: number,
  staleAfterMs: number,
): boolean {
  return atMs - snapshot.lastSeenAt >= staleAfterMs;
}

function sameSnapshotSemantics(
  left: DiscoveredDeviceSnapshot,
  right: DiscoveredDeviceSnapshot,
): boolean {
  return (
    left.transportDeviceId === right.transportDeviceId &&
    left.macAddress === right.macAddress &&
    left.name === right.name &&
    left.compatibility === right.compatibility &&
    left.reason === right.reason &&
    samePresence(left.presence, right.presence)
  );
}

function samePresence(
  left: DiscoveredDeviceSnapshot["presence"],
  right: DiscoveredDeviceSnapshot["presence"],
): boolean {
  if (!left || !right) return left === right;
  return (
    left.rawOperationModeByte === right.rawOperationModeByte &&
    left.rawUwbModeBits === right.rawUwbModeBits &&
    left.role === right.role &&
    left.errorIndicated === right.errorIndicated &&
    left.initiator === right.initiator &&
    left.bridge === right.bridge &&
    Object.hasOwn(left, "uwbMode") === Object.hasOwn(right, "uwbMode") &&
    left.uwbMode === right.uwbMode &&
    left.changeCounter === right.changeCounter &&
    Object.hasOwn(left, "raw") === Object.hasOwn(right, "raw") &&
    sameNumberArray(left.raw, right.raw)
  );
}

function sameNumberArray(left?: number[], right?: number[]): boolean {
  if (!left || !right) return left === right;
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function clonePresence(
  presence: NonNullable<DiscoveredDeviceSnapshot["presence"]>,
): NonNullable<DiscoveredDeviceSnapshot["presence"]> {
  return {
    ...presence,
    ...(presence.raw ? { raw: [...presence.raw] } : {}),
  };
}

function cloneDevice(device: PansBleDevice): PansBleDevice {
  return {
    ...device,
    ...(device.presence ? { presence: clonePresence(device.presence) } : {}),
  };
}

function cloneSnapshot(
  snapshot: DiscoveredDeviceSnapshot,
): DiscoveredDeviceSnapshot {
  return {
    ...snapshot,
    ...(snapshot.presence
      ? { presence: clonePresence(snapshot.presence) }
      : {}),
    ...(snapshot.rawDevice
      ? { rawDevice: cloneDevice(snapshot.rawDevice) }
      : {}),
  };
}

function cloneDiagnostics(
  diagnostics: PansBleScanDiagnostics,
): PansBleScanDiagnostics {
  return {
    ...diagnostics,
    ...(diagnostics.lastError
      ? { lastError: { ...diagnostics.lastError } }
      : {}),
  };
}

function sameDiagnostics(
  left: PansBleScanDiagnostics,
  right: PansBleScanDiagnostics,
): boolean {
  return (
    left.state === right.state &&
    left.buildId === right.buildId &&
    left.scanSessionId === right.scanSessionId &&
    left.rawResultCount === right.rawResultCount &&
    left.pansResultCount === right.pansResultCount &&
    left.parsedServiceDataHitCount === right.parsedServiceDataHitCount &&
    left.rawAdvertisementHitCount === right.rawAdvertisementHitCount &&
    left.rejectedResultCount === right.rejectedResultCount &&
    left.startedAtMs === right.startedAtMs &&
    left.lastResultAtMs === right.lastResultAtMs &&
    left.lastPansResultAtMs === right.lastPansResultAtMs &&
    left.warning === right.warning &&
    left.lastError?.code === right.lastError?.code &&
    left.lastError?.message === right.lastError?.message &&
    left.lastError?.nativeCode === right.lastError?.nativeCode &&
    left.lastError?.operation === right.lastError?.operation
  );
}

function malformedDeviceKey(device: PansBleDevice, index: number): string {
  const hint = device?.macAddress ?? device?.mac ?? device?.name ?? "unknown";
  return `malformed:${hint}:${index}`;
}
