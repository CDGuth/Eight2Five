import {
  normalizeManagerError,
  normalizePansManagerSettings,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  ManagerError,
  type PansManagerSettings,
  type PansDiagnosticsResult,
} from "@eight2five/mobile/pans-manager";
import type { AnchorFieldPosition, FieldPoint } from "@eight2five/mobile/field";
import type { SharedValue } from "react-native-reanimated";

import {
  createDefaultMobilePansRuntime,
  type CreateMobilePansRuntime,
  type MobilePansRuntime,
} from "./mobile-pans-runtime";
import {
  DEFAULT_RECONNECT_DELAYS,
  EMPTY_DISCOVERIES,
  fieldConnectionState,
  INITIAL_MOBILE_PANS_SNAPSHOT,
  isSelectableTagDiscovery,
  type MobilePansSnapshot,
  type MobilePansStoreOptions,
  type TagConnectionState,
} from "./mobile-pans-model";
import { MobilePansPositionPublisher } from "./mobile-pans-position-publisher";
import { MobilePansConnectionController } from "./mobile-pans-connection-controller";
import { areDevicesNetworkAssociated } from "./pans-anchor-cache";
import {
  persistSelectedTagAndNearbyAnchors,
  sortedCachedAnchors,
} from "./mobile-pans-device-cache";

export {
  pansPositionToFieldPoint,
  type MobilePansSnapshot,
  type MobilePansStoreOptions,
  type TagConnectionState,
} from "./mobile-pans-model";

/**
 * Composes the one production PANS runtime, connection controller, position
 * publisher, persistent device cache, and low-rate React snapshot.
 */
export class MobilePansStore {
  private snapshot: MobilePansSnapshot = INITIAL_MOBILE_PANS_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly createRuntime: CreateMobilePansRuntime;
  private readonly now: () => number;
  private readonly schedule: typeof setTimeout;
  private readonly cancel: typeof clearTimeout;
  private readonly reconnectDelaysMs: readonly number[];
  private readonly staleAfterMs: number;
  private readonly discoveryTimeoutMs: number;
  private runtime?: MobilePansRuntime;
  private readonly positionPublisher: MobilePansPositionPublisher;
  private readonly connectionController: MobilePansConnectionController;
  private lifecycleGeneration = 0;
  private discoverySubscription?: { remove(): void };
  private discoveryErrorSubscription?: { remove(): void };
  private discoveryStateSubscription?: { remove(): void };
  private connectionSubscription?: { remove(): void };
  private settings?: PansManagerSettings;
  private rememberedTag?: ManagedDevice;
  private discoveries: readonly DiscoveredDeviceSnapshot[] = EMPTY_DISCOVERIES;
  private anchorWritePromise?: Promise<void>;
  private manualDiscoveryRequested = false;

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
    this.positionPublisher = new MobilePansPositionPublisher({
      staleAfterMs: this.staleAfterMs,
      schedule: this.schedule,
      cancel: this.cancel,
      isConnectionCurrent: (generation) =>
        this.connectionController.isConnectionCurrent(generation),
      getSnapshot: this.getSnapshot,
      publish: (snapshot) => this.publish(snapshot),
    });
    this.connectionController = new MobilePansConnectionController({
      reconnectDelaysMs: this.reconnectDelaysMs,
      discoveryTimeoutMs: this.discoveryTimeoutMs,
      schedule: this.schedule,
      cancel: this.cancel,
      positionPublisher: this.positionPublisher,
      getRuntime: () => this.runtime,
      getRememberedTag: () => this.rememberedTag,
      getDiscoveries: () => this.discoveries,
      getSnapshot: this.getSnapshot,
      publish: (snapshot) => this.publish(snapshot),
      publishState: (state, changes) => this.publishState(state, changes),
    });
  }

  readonly getSnapshot = (): MobilePansSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  attachPositionValue(value: SharedValue<FieldPoint | null>): void {
    this.positionPublisher.attachPositionValue(value);
  }

  async initialize(): Promise<void> {
    const generation = ++this.lifecycleGeneration;
    this.publish(INITIAL_MOBILE_PANS_SNAPSHOT);
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
      const knownAnchors = sortedCachedAnchors(devices);
      if (!this.rememberedTag && this.settings.rememberedTagDeviceId) {
        await this.saveRememberedTag(undefined);
      }
      this.installRuntimeListeners(runtime, generation);
      this.connectionController.setWantsConnection(Boolean(this.rememberedTag));
      this.publishState(this.rememberedTag ? "disconnected" : "idle", {
        initialization: "ready",
        knownAnchors,
      });
      void this.connectionController.startReconnectLoop();
    } catch (cause) {
      if (generation !== this.lifecycleGeneration) return;
      this.publish({
        ...INITIAL_MOBILE_PANS_SNAPSHOT,
        initialization: "error",
        connectionState: "error",
        livePosition: { connectionState: "error", isStale: false },
        error: normalizeManagerError(cause, { operation: "initialize" }),
      });
    }
  }

  async startDiscovery(): Promise<void> {
    const runtime = this.requireRuntime();
    if (this.snapshot.connectionState === "connected") {
      throw new Error(
        "Disconnect the current tag before discovering another tag.",
      );
    }
    this.manualDiscoveryRequested = true;
    this.publishState("scanning", { error: undefined });
    try {
      const permission = runtime.discovery.getPermissionStatus();
      if (permission.bluetooth !== "granted") {
        await runtime.discovery.requestPermissions();
      }
      await runtime.discovery.start();
    } catch (cause) {
      this.manualDiscoveryRequested = false;
      const error = normalizeManagerError(cause, { operation: "discover tag" });
      this.publishState("error", { error });
      throw error;
    }
  }

  async stopDiscovery(): Promise<void> {
    this.manualDiscoveryRequested = false;
    const runtime = this.runtime;
    if (!runtime) return;
    await runtime.discovery.stop();
    if (this.snapshot.connectionState === "scanning") {
      this.publishState(this.rememberedTag ? "disconnected" : "idle");
    }
  }

  stopManualDiscovery(): void {
    if (this.manualDiscoveryRequested) void this.stopDiscovery();
  }

  async selectTag(transportDeviceId: string): Promise<void> {
    const runtime = this.requireRuntime();
    const discovery = this.discoveries.find(
      (item) => item.transportDeviceId === transportDeviceId,
    );
    if (!discovery) throw new Error("The selected tag is no longer available.");
    if (!isSelectableTagDiscovery(discovery)) {
      throw new Error("Select a compatible, current PANS tag advertisement.");
    }
    const saved = await persistSelectedTagAndNearbyAnchors(
      runtime,
      discovery,
      this.discoveries,
      this.now(),
    );
    this.rememberedTag = saved;
    await this.saveRememberedTag(saved.id);
    this.connectionController.setWantsConnection(true);
    await this.refreshCachedAnchors();
    this.publishState("disconnected", {
      rememberedTag: saved,
      error: undefined,
    });
  }

  async connect(): Promise<void> {
    await this.connectionController.connect(false);
  }

  async reconnect(): Promise<void> {
    await this.connectionController.connect(true);
  }

  async disconnect(): Promise<void> {
    await this.connectionController.disconnect();
  }

  async forgetTag(): Promise<void> {
    await this.disconnect();
    this.rememberedTag = undefined;
    await this.saveRememberedTag(undefined);
    this.positionPublisher.resetStreamState();
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
    try {
      await this.connectionController.pauseForOperation();
      const hardwareDiagnostics = await runtime.diagnostics.inspect(
        tag.id,
        tag.transportDeviceId,
      );
      this.publish({ ...this.snapshot, hardwareDiagnostics });
      await this.connectionController.resumeAfterOperation();
      return hardwareDiagnostics;
    } catch (cause) {
      const error = normalizeManagerError(cause, {
        deviceId: tag.id,
        operation: "refresh diagnostics",
      });
      this.publishState("error", { error });
      void this.connectionController.startReconnectLoop();
      throw error;
    }
  }

  setForeground(foreground: boolean): void {
    this.connectionController.setForeground(foreground);
  }

  async dispose(): Promise<void> {
    ++this.lifecycleGeneration;
    this.connectionController.dispose();
    this.positionPublisher.dispose();
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

  async refreshCachedAnchors(): Promise<readonly ManagedDevice[]> {
    const runtime = this.requireRuntime();
    const devices = await runtime.repository.listDevices();
    const knownAnchors = sortedCachedAnchors(devices);
    this.publish({ ...this.snapshot, knownAnchors });
    return knownAnchors;
  }

  async writeAnchorPosition(
    anchorId: string,
    position: AnchorFieldPosition,
  ): Promise<void> {
    if (this.anchorWritePromise) {
      throw new ManagerError(
        "OPERATION_CANCELLED",
        "An anchor position write is already in progress.",
      );
    }
    const operation = this.performAnchorPositionWrite(anchorId, position);
    const tracked = operation.finally(() => {
      if (this.anchorWritePromise === tracked)
        this.anchorWritePromise = undefined;
    });
    this.anchorWritePromise = tracked;
    return await tracked;
  }

  private async performAnchorPositionWrite(
    anchorId: string,
    position: AnchorFieldPosition,
  ): Promise<void> {
    const runtime = this.requireRuntime();
    if (!this.rememberedTag || this.snapshot.connectionState !== "connected") {
      throw new Error(
        "Connect the remembered PANS tag before writing an anchor position.",
      );
    }
    const anchor = await runtime.repository.getDevice(anchorId);
    if (
      !anchor ||
      (anchor.role !== "anchor" && anchor.lastKnownConfig?.role !== "anchor")
    ) {
      throw new Error("The selected cached anchor does not exist.");
    }
    if (!areDevicesNetworkAssociated(this.rememberedTag, anchor)) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "The anchor is not verified on the remembered tag's PANS network.",
        { deviceId: anchor.id, operation: "write anchor position" },
      );
    }
    try {
      await this.connectionController.pauseForOperation();
      const result = await runtime.configuration.applyConfigurationDiff(
        anchor.id,
        {
          position: { ...position, quality: 100 },
        },
      );
      const write = result.writes.find((item) => item.field === "position");
      if (result.error || write?.status !== "written-unverified") {
        throw new ManagerError(
          result.error?.code ?? "WRITE_FAILED",
          result.error?.message ?? "The anchor rejected the position write.",
          { deviceId: anchor.id, operation: "write anchor position" },
        );
      }
      await this.refreshCachedAnchors();
    } catch (cause) {
      const error = normalizeManagerError(cause, {
        deviceId: anchor.id,
        operation: "write anchor position",
      });
      this.publishState("error", { error });
      throw error;
    } finally {
      try {
        await this.connectionController.resumeAfterOperation();
      } catch {
        // The reconnect action publishes its normalized failure.
      }
    }
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
        if (this.isLifecycleCurrent(generation)) {
          this.publish({ ...this.snapshot, error });
          if (this.snapshot.connectionState === "scanning") {
            this.publishState("error", { error });
          }
        }
      },
    );
    this.discoveryStateSubscription = runtime.discovery.subscribeState(
      (state) => {
        if (!this.isLifecycleCurrent(generation)) return;
        if (state === "error" && this.snapshot.connectionState === "scanning") {
          this.publishState("error");
        } else if (
          state === "idle" &&
          this.snapshot.connectionState === "scanning" &&
          !this.connectionController.isConnecting
        ) {
          this.publishState(this.rememberedTag ? "disconnected" : "idle");
        }
      },
    );
    this.connectionSubscription = runtime.sessions.addConnectionStateListener(
      (event) => {
        if (this.isLifecycleCurrent(generation)) {
          this.connectionController.receiveConnectionEvent(event);
        }
      },
    );
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

  private requireRuntime(): MobilePansRuntime {
    if (!this.runtime || this.snapshot.initialization !== "ready") {
      throw new Error("PANS services are not ready.");
    }
    return this.runtime;
  }

  private removeRuntimeListeners(): void {
    this.discoverySubscription?.remove();
    this.discoveryErrorSubscription?.remove();
    this.discoveryStateSubscription?.remove();
    this.connectionSubscription?.remove();
    this.discoverySubscription = undefined;
    this.discoveryErrorSubscription = undefined;
    this.discoveryStateSubscription = undefined;
    this.connectionSubscription = undefined;
  }
}
