import {
  deviceFromDiscovery,
  normalizeManagerError,
  normalizePansManagerSettings,
  normalizeTransportDeviceId,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  type ManagerError,
  type PansConnectionStateEvent,
  type PansManagerSettings,
  type PansDiagnosticsResult,
  type PansPosition,
  type PansPositionStreamCounters,
  type PansPositionStreamSample,
} from "@eight2five/mobile/pans-manager";
import type {
  FieldLivePositionState,
  FieldPoint,
} from "@eight2five/mobile/field";
import { formatMarchingCoordinate } from "@eight2five/mobile/field";
import type { SharedValue } from "react-native-reanimated";

import {
  createDefaultMobilePansRuntime,
  type CreateMobilePansRuntime,
  type MobilePansRuntime,
} from "./mobile-pans-runtime";

export type TagConnectionState =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface MobilePansSnapshot {
  readonly initialization: "loading" | "ready" | "error";
  readonly connectionState: TagConnectionState;
  readonly rememberedTag?: ManagedDevice;
  readonly discoveries: readonly DiscoveredDeviceSnapshot[];
  readonly livePosition: FieldLivePositionState;
  readonly rawPosition?: Readonly<
    Pick<PansPosition, "xMeters" | "yMeters" | "zMeters">
  >;
  readonly lastUpdateAt?: number;
  readonly effectiveUpdateRateHz: number;
  readonly counters?: Readonly<PansPositionStreamCounters>;
  readonly hardwareDiagnostics?: PansDiagnosticsResult;
  readonly knownAnchors: readonly ManagedDevice[];
  readonly diagnosticMessages: readonly string[];
  readonly error?: ManagerError | Error;
}

export interface MobilePansStoreOptions {
  readonly createRuntime?: CreateMobilePansRuntime;
  readonly now?: () => number;
  readonly schedule?: typeof setTimeout;
  readonly cancel?: typeof clearTimeout;
  readonly reconnectDelaysMs?: readonly number[];
  readonly staleAfterMs?: number;
  readonly discoveryTimeoutMs?: number;
}

const EMPTY_DISCOVERIES: readonly DiscoveredDeviceSnapshot[] = Object.freeze(
  [],
);
const EMPTY_MESSAGES: readonly string[] = Object.freeze([]);
const DEFAULT_RECONNECT_DELAYS = Object.freeze([500, 1_500, 3_000]);
const HUD_PUBLICATION_INTERVAL_MS = 100;

const INITIAL_SNAPSHOT: MobilePansSnapshot = Object.freeze({
  initialization: "loading",
  connectionState: "idle",
  discoveries: EMPTY_DISCOVERIES,
  livePosition: Object.freeze({ connectionState: "idle", isStale: false }),
  effectiveUpdateRateHz: 0,
  diagnosticMessages: EMPTY_MESSAGES,
  knownAnchors: Object.freeze([]),
});

/**
 * Owns the one production PANS runtime, connection attempt, notification
 * stream, reconnect loop, and low-rate React snapshot.
 */
export class MobilePansStore {
  private snapshot: MobilePansSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly createRuntime: CreateMobilePansRuntime;
  private readonly now: () => number;
  private readonly schedule: typeof setTimeout;
  private readonly cancel: typeof clearTimeout;
  private readonly reconnectDelaysMs: readonly number[];
  private readonly staleAfterMs: number;
  private readonly discoveryTimeoutMs: number;
  private runtime?: MobilePansRuntime;
  private positionValue?: SharedValue<FieldPoint | null>;
  private lifecycleGeneration = 0;
  private connectionGeneration = 0;
  private foreground = true;
  private wantsConnection = false;
  private connectPromise?: Promise<void>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectDelayResolve?: () => void;
  private cancelPendingDiscovery?: () => void;
  private staleTimer?: ReturnType<typeof setTimeout>;
  private discoverySubscription?: { remove(): void };
  private discoveryErrorSubscription?: { remove(): void };
  private connectionSubscription?: { remove(): void };
  private settings?: PansManagerSettings;
  private rememberedTag?: ManagedDevice;
  private discoveries: readonly DiscoveredDeviceSnapshot[] = EMPTY_DISCOVERIES;
  private lastHudPublicationAt = 0;
  private lastHudKey?: string;
  private sampleTimes: number[] = [];

  constructor(options: MobilePansStoreOptions = {}) {
    this.createRuntime =
      options.createRuntime ?? createDefaultMobilePansRuntime;
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? setTimeout;
    this.cancel = options.cancel ?? clearTimeout;
    this.reconnectDelaysMs =
      options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS;
    this.staleAfterMs = options.staleAfterMs ?? 2_500;
    this.discoveryTimeoutMs = options.discoveryTimeoutMs ?? 10_000;
  }

  readonly getSnapshot = (): MobilePansSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  attachPositionValue(value: SharedValue<FieldPoint | null>): void {
    this.positionValue = value;
    value.value = this.snapshot.livePosition.isStale
      ? null
      : (this.snapshot.livePosition.position ?? null);
  }

  async initialize(): Promise<void> {
    const generation = ++this.lifecycleGeneration;
    this.publish(INITIAL_SNAPSHOT);
    try {
      const runtime = await this.createRuntime();
      if (generation !== this.lifecycleGeneration) {
        await runtime.close();
        return;
      }
      this.runtime = runtime;
      this.settings = normalizePansManagerSettings(
        await runtime.repository.getSettings(),
      );
      this.rememberedTag = this.settings.rememberedTagDeviceId
        ? await runtime.repository.getDevice(
            this.settings.rememberedTagDeviceId,
          )
        : undefined;
      const devices = await runtime.repository.listDevices();
      const knownAnchors = devices.filter(
        (device) =>
          device.role === "anchor" || device.lastKnownConfig?.role === "anchor",
      );
      if (!this.rememberedTag && this.settings.rememberedTagDeviceId) {
        await this.saveRememberedTag(undefined);
      }
      this.installRuntimeListeners(runtime, generation);
      this.wantsConnection = Boolean(this.rememberedTag);
      this.publishState(this.rememberedTag ? "disconnected" : "idle", {
        initialization: "ready",
        knownAnchors,
      });
      if (this.wantsConnection && this.foreground) {
        void this.startReconnectLoop();
      }
    } catch (cause) {
      if (generation !== this.lifecycleGeneration) return;
      this.publish({
        ...INITIAL_SNAPSHOT,
        initialization: "error",
        connectionState: "error",
        livePosition: { connectionState: "error", isStale: false },
        error: normalizeManagerError(cause, { operation: "initialize" }),
      });
    }
  }

  async startDiscovery(): Promise<void> {
    const runtime = this.requireRuntime();
    this.publishState("scanning", { error: undefined });
    try {
      const permission = runtime.discovery.getPermissionStatus();
      if (permission.bluetooth !== "granted") {
        await runtime.discovery.requestPermissions();
      }
      await runtime.discovery.start();
    } catch (cause) {
      const error = normalizeManagerError(cause, { operation: "discover tag" });
      this.publishState("error", { error });
      throw error;
    }
  }

  async stopDiscovery(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime) return;
    await runtime.discovery.stop();
    if (this.snapshot.connectionState === "scanning") {
      this.publishState(this.rememberedTag ? "disconnected" : "idle");
    }
  }

  async selectTag(transportDeviceId: string): Promise<void> {
    const runtime = this.requireRuntime();
    const discovery = this.discoveries.find(
      (item) => item.transportDeviceId === transportDeviceId,
    );
    if (!discovery) throw new Error("The selected tag is no longer available.");
    const devices = await runtime.repository.listDevices();
    const normalizedTransport = normalizeTransportDeviceId(transportDeviceId);
    const existing = devices.find(
      (device) =>
        normalizeTransportDeviceId(device.transportDeviceId) ===
          normalizedTransport ||
        (discovery.macAddress && device.macAddress === discovery.macAddress),
    );
    const tag = deviceFromDiscovery(discovery, existing, {
      id: existing?.id ?? createLocalId("tag"),
      now: this.now(),
    });
    const saved = await runtime.repository.saveDevice({ ...tag, role: "tag" });
    this.rememberedTag = saved;
    await this.saveRememberedTag(saved.id);
    this.wantsConnection = true;
    this.publishState("disconnected", {
      rememberedTag: saved,
      error: undefined,
    });
  }

  async connect(): Promise<void> {
    if (this.snapshot.connectionState === "connected") return;
    this.wantsConnection = true;
    this.cancelReconnect();
    await this.connectOnce(false);
  }

  async reconnect(): Promise<void> {
    this.wantsConnection = true;
    this.cancelReconnect();
    await this.connectOnce(true);
  }

  async disconnect(): Promise<void> {
    this.wantsConnection = false;
    ++this.connectionGeneration;
    this.cancelReconnect();
    this.cancelPendingDiscovery?.();
    this.cancelPendingDiscovery = undefined;
    this.cancelStaleTimer();
    this.clearLiveMarker();
    const runtime = this.runtime;
    if (runtime) {
      await Promise.allSettled([
        runtime.stream.stop(),
        runtime.discovery.stop(),
      ]);
    }
    this.publishState("disconnected", {
      livePosition: staleLivePosition(
        this.snapshot.livePosition,
        "disconnected",
      ),
      error: undefined,
    });
  }

  async forgetTag(): Promise<void> {
    await this.disconnect();
    this.rememberedTag = undefined;
    await this.saveRememberedTag(undefined);
    this.sampleTimes = [];
    this.publish({
      ...this.snapshot,
      connectionState: "idle",
      rememberedTag: undefined,
      livePosition: { connectionState: "idle", isStale: false },
      rawPosition: undefined,
      lastUpdateAt: undefined,
      effectiveUpdateRateHz: 0,
      error: undefined,
    });
  }

  async refreshDiagnostics(): Promise<PansDiagnosticsResult> {
    const runtime = this.requireRuntime();
    const tag = this.rememberedTag;
    if (!tag || this.snapshot.connectionState !== "connected") {
      throw new Error(
        "Connect the remembered PANS tag before refreshing diagnostics.",
      );
    }
    ++this.connectionGeneration;
    this.cancelStaleTimer();
    this.clearLiveMarker();
    this.publishState("reconnecting", {
      livePosition: staleLivePosition(
        this.snapshot.livePosition,
        "reconnecting",
      ),
      error: undefined,
    });
    try {
      await runtime.stream.stop();
      const hardwareDiagnostics = await runtime.diagnostics.inspect(
        tag.id,
        tag.transportDeviceId,
      );
      this.publish({ ...this.snapshot, hardwareDiagnostics });
      if (this.wantsConnection && this.foreground) await this.connectOnce(true);
      return hardwareDiagnostics;
    } catch (cause) {
      const error = normalizeManagerError(cause, {
        deviceId: tag.id,
        operation: "refresh diagnostics",
      });
      this.publishState("error", { error });
      if (this.wantsConnection && this.foreground)
        void this.startReconnectLoop();
      throw error;
    }
  }

  setForeground(foreground: boolean): void {
    if (this.foreground === foreground) return;
    this.foreground = foreground;
    if (!foreground) {
      this.cancelReconnect();
      this.cancelStaleTimer();
      this.clearLiveMarker();
      const runtime = this.runtime;
      if (runtime) {
        void Promise.allSettled([
          runtime.stream.stop(),
          runtime.discovery.stop(),
        ]);
      }
      if (this.wantsConnection) {
        this.publishState("reconnecting", {
          livePosition: staleLivePosition(
            this.snapshot.livePosition,
            "reconnecting",
          ),
        });
      }
      return;
    }
    if (this.wantsConnection && this.rememberedTag) {
      void this.startReconnectLoop();
    }
  }

  async dispose(): Promise<void> {
    ++this.lifecycleGeneration;
    ++this.connectionGeneration;
    this.wantsConnection = false;
    this.cancelReconnect();
    this.cancelPendingDiscovery?.();
    this.cancelPendingDiscovery = undefined;
    this.cancelStaleTimer();
    this.removeRuntimeListeners();
    const runtime = this.runtime;
    this.runtime = undefined;
    if (runtime) {
      await runtime.stream.stop().catch(() => undefined);
      await runtime.close();
    }
  }

  getRuntime(): MobilePansRuntime {
    return this.requireRuntime();
  }

  private async connectOnce(reconnecting: boolean): Promise<void> {
    if (this.connectPromise) return await this.connectPromise;
    const generation = ++this.connectionGeneration;
    const operation = this.performConnect(generation, reconnecting);
    const tracked = operation.finally(() => {
      if (this.connectPromise === tracked) this.connectPromise = undefined;
    });
    this.connectPromise = tracked;
    return await this.connectPromise;
  }

  private async performConnect(
    generation: number,
    reconnecting: boolean,
  ): Promise<void> {
    const runtime = this.requireRuntime();
    const tag = this.rememberedTag;
    if (!tag) throw new Error("Select a PANS tag before connecting.");
    if (!this.foreground) return;
    const state = reconnecting ? "reconnecting" : "connecting";
    this.publishState(state, { error: undefined });
    try {
      const available = await this.ensureDiscovered(tag, generation);
      if (!this.isConnectionCurrent(generation)) return;
      this.publishState(state);
      await runtime.stream.start({
        deviceId: tag.id,
        transportDeviceId: available.transportDeviceId,
        onSample: (sample) => this.receiveSample(sample, generation),
        onDiagnostic: (message) => this.receiveDiagnostic(message, generation),
        onCounters: (counters) => {
          if (this.isConnectionCurrent(generation))
            this.publish({ ...this.snapshot, counters });
        },
      });
      if (!this.isConnectionCurrent(generation)) {
        await runtime.stream.stop();
        return;
      }
      await runtime.discovery.stop().catch(() => undefined);
      this.publishState("connected", {
        livePosition: {
          ...this.snapshot.livePosition,
          connectionState: "connected",
        },
        error: undefined,
      });
    } catch (cause) {
      if (!this.isConnectionCurrent(generation)) return;
      const error = normalizeManagerError(cause, {
        deviceId: tag.id,
        operation: reconnecting ? "reconnect tag" : "connect tag",
      });
      this.clearLiveMarker();
      this.publishState("error", {
        livePosition: staleLivePosition(
          this.snapshot.livePosition,
          "error",
          error.message,
        ),
        error,
      });
      throw error;
    }
  }

  private async ensureDiscovered(
    tag: ManagedDevice,
    generation: number,
  ): Promise<DiscoveredDeviceSnapshot> {
    const existing = findDiscovery(this.discoveries, tag.transportDeviceId);
    if (existing && !existing.stale) return existing;
    const runtime = this.requireRuntime();
    this.publishState("scanning");
    const permission = runtime.discovery.getPermissionStatus();
    if (permission.bluetooth !== "granted") {
      await runtime.discovery.requestPermissions();
    }
    await runtime.discovery.start();
    return await new Promise<DiscoveredDeviceSnapshot>((resolve, reject) => {
      let settled = false;
      let subscription: { remove(): void } | undefined;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        this.cancel(timer);
        subscription?.remove();
        if (this.cancelPendingDiscovery === cancelWait) {
          this.cancelPendingDiscovery = undefined;
        }
        action();
      };
      const cancelWait = () =>
        finish(() =>
          reject(new Error("The connection attempt was cancelled.")),
        );
      const timer = this.schedule(() => {
        finish(() =>
          reject(new Error("The remembered PANS tag was not found nearby.")),
        );
      }, this.discoveryTimeoutMs);
      this.cancelPendingDiscovery = cancelWait;
      subscription = runtime.discovery.subscribe((items) => {
        if (!this.isConnectionCurrent(generation)) {
          cancelWait();
          return;
        }
        const match = findDiscovery(items, tag.transportDeviceId);
        if (!match || match.stale) return;
        finish(() => resolve(match));
      });
      if (settled) subscription.remove();
    });
  }

  private async startReconnectLoop(): Promise<void> {
    if (!this.wantsConnection || !this.foreground || !this.rememberedTag)
      return;
    this.cancelReconnect();
    for (
      let attempt = 0;
      attempt <= this.reconnectDelaysMs.length;
      attempt += 1
    ) {
      if (!this.wantsConnection || !this.foreground) return;
      if (attempt > 0) {
        await new Promise<void>((resolve) => {
          this.reconnectDelayResolve = resolve;
          this.reconnectTimer = this.schedule(
            () => {
              this.reconnectTimer = undefined;
              this.reconnectDelayResolve = undefined;
              resolve();
            },
            this.reconnectDelaysMs[attempt - 1],
          );
        });
      }
      try {
        await this.connectOnce(true);
        return;
      } catch {
        // A bounded final error is already published by connectOnce.
      }
    }
  }

  private receiveSample(
    sample: PansPositionStreamSample,
    generation: number,
  ): void {
    if (!this.isConnectionCurrent(generation) || !sample.position) return;
    // MVP networks use the documented identity-aligned PANS/field frame:
    // +X Side 1→Side 2, +Y front→back, meters. Calibration is out of scope.
    const fieldPoint = pansPositionToFieldPoint(sample.position);
    if (this.positionValue) this.positionValue.value = fieldPoint;
    const now = sample.receivedAt;
    this.sampleTimes = this.sampleTimes.filter((time) => now - time <= 1_000);
    this.sampleTimes.push(now);
    this.scheduleStale(generation);
    const hudKey = formatMarchingCoordinate(fieldPoint);
    if (
      hudKey !== this.lastHudKey ||
      now - this.lastHudPublicationAt >= HUD_PUBLICATION_INTERVAL_MS
    ) {
      this.lastHudKey = hudKey;
      this.lastHudPublicationAt = now;
      this.publish({
        ...this.snapshot,
        connectionState: "connected",
        livePosition: {
          connectionState: "connected",
          position: fieldPoint,
          receivedAt: now,
          isStale: false,
        },
        rawPosition: {
          xMeters: sample.position.xMeters,
          yMeters: sample.position.yMeters,
          zMeters: sample.position.zMeters,
        },
        lastUpdateAt: now,
        effectiveUpdateRateHz: this.sampleTimes.length,
        error: undefined,
      });
    }
  }

  private receiveDiagnostic(message: string, generation: number): void {
    if (!this.isConnectionCurrent(generation)) return;
    const diagnosticMessages = [
      ...this.snapshot.diagnosticMessages,
      message,
    ].slice(-8);
    this.publish({ ...this.snapshot, diagnosticMessages });
  }

  private scheduleStale(generation: number): void {
    this.cancelStaleTimer();
    this.staleTimer = this.schedule(() => {
      this.staleTimer = undefined;
      if (!this.isConnectionCurrent(generation)) return;
      this.clearLiveMarker();
      this.publish({
        ...this.snapshot,
        livePosition: staleLivePosition(
          this.snapshot.livePosition,
          this.snapshot.connectionState === "connected"
            ? "connected"
            : "reconnecting",
        ),
      });
    }, this.staleAfterMs);
  }

  private installRuntimeListeners(
    runtime: MobilePansRuntime,
    generation: number,
  ): void {
    this.discoverySubscription = runtime.discovery.subscribe((discoveries) => {
      if (!this.isLifecycleCurrent(generation)) return;
      this.discoveries = discoveries;
      this.publish({ ...this.snapshot, discoveries });
    });
    this.discoveryErrorSubscription = runtime.discovery.subscribeErrors(
      (error) => {
        if (this.isLifecycleCurrent(generation))
          this.publish({ ...this.snapshot, error });
      },
    );
    this.connectionSubscription = runtime.sessions.addConnectionStateListener(
      (event) => this.receiveConnectionEvent(event, generation),
    );
  }

  private receiveConnectionEvent(
    event: PansConnectionStateEvent,
    generation: number,
  ): void {
    if (
      !this.isLifecycleCurrent(generation) ||
      !this.rememberedTag ||
      normalizeTransportDeviceId(event.deviceId) !==
        normalizeTransportDeviceId(this.rememberedTag.transportDeviceId) ||
      event.state !== "disconnected" ||
      this.snapshot.connectionState !== "connected"
    ) {
      return;
    }
    this.clearLiveMarker();
    this.publishState(this.wantsConnection ? "reconnecting" : "disconnected", {
      livePosition: staleLivePosition(
        this.snapshot.livePosition,
        this.wantsConnection ? "reconnecting" : "disconnected",
        event.reason,
      ),
    });
    if (this.wantsConnection && this.foreground) void this.startReconnectLoop();
  }

  private async saveRememberedTag(deviceId: string | undefined): Promise<void> {
    const runtime = this.requireRuntime();
    this.settings = normalizePansManagerSettings({
      ...this.settings,
      rememberedTagDeviceId: deviceId,
    });
    if (!deviceId) delete this.settings.rememberedTagDeviceId;
    await runtime.repository.saveSettings(this.settings);
  }

  private publishState(
    connectionState: TagConnectionState,
    changes: Partial<MobilePansSnapshot> = {},
  ): void {
    const fieldState = fieldConnectionState(connectionState);
    this.publish({
      ...this.snapshot,
      ...changes,
      connectionState,
      rememberedTag: changes.rememberedTag ?? this.rememberedTag,
      discoveries: this.discoveries,
      livePosition:
        changes.livePosition ??
        ({
          ...this.snapshot.livePosition,
          connectionState: fieldState,
        } as const),
    });
  }

  private publish(snapshot: MobilePansSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of this.listeners) listener();
  }

  private isLifecycleCurrent(generation: number): boolean {
    return generation === this.lifecycleGeneration;
  }

  private isConnectionCurrent(generation: number): boolean {
    return generation === this.connectionGeneration && this.wantsConnection;
  }

  private requireRuntime(): MobilePansRuntime {
    if (!this.runtime || this.snapshot.initialization !== "ready") {
      throw new Error("PANS services are not ready.");
    }
    return this.runtime;
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) this.cancel(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const resolve = this.reconnectDelayResolve;
    this.reconnectDelayResolve = undefined;
    resolve?.();
  }

  private cancelStaleTimer(): void {
    if (this.staleTimer) this.cancel(this.staleTimer);
    this.staleTimer = undefined;
  }

  private clearLiveMarker(): void {
    if (this.positionValue) this.positionValue.value = null;
  }

  private removeRuntimeListeners(): void {
    this.discoverySubscription?.remove();
    this.discoveryErrorSubscription?.remove();
    this.connectionSubscription?.remove();
    this.discoverySubscription = undefined;
    this.discoveryErrorSubscription = undefined;
    this.connectionSubscription = undefined;
  }
}

export function pansPositionToFieldPoint(position: PansPosition): FieldPoint {
  return { xMeters: position.xMeters, yMeters: position.yMeters };
}

function findDiscovery(
  discoveries: readonly DiscoveredDeviceSnapshot[],
  transportDeviceId: string,
): DiscoveredDeviceSnapshot | undefined {
  const normalized = normalizeTransportDeviceId(transportDeviceId);
  return discoveries.find(
    (item) => normalizeTransportDeviceId(item.transportDeviceId) === normalized,
  );
}

function fieldConnectionState(
  state: TagConnectionState,
): FieldLivePositionState["connectionState"] {
  if (state === "scanning") return "connecting";
  return state;
}

function staleLivePosition(
  live: FieldLivePositionState,
  connectionState: FieldLivePositionState["connectionState"],
  errorMessage?: string,
): FieldLivePositionState {
  return {
    ...live,
    connectionState,
    isStale: Boolean(live.position),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

function createLocalId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
