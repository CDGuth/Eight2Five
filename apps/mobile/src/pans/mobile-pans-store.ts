import {
  DEFAULT_DISCOVERY_RSSI_CUTOFF,
  MAX_DISCOVERY_RSSI_CUTOFF,
  MIN_DISCOVERY_RSSI_CUTOFF,
  normalizeManagerError,
  normalizePansManagerSettings,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  type ManagedNetwork,
  ManagerError,
  type PansManagerSettings,
  type PansDiagnosticsResult,
} from "@eight2five/mobile/pans-manager";
import type {
  AnchorFieldPosition,
  FieldPoint,
  FusedPositionOutput,
} from "@eight2five/mobile/field";
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
import {
  persistSelectedTag,
  sortedCachedAnchors,
} from "./mobile-pans-device-cache";
import {
  MobilePansInventoryController,
  type MobilePansInventorySnapshot,
} from "./mobile-pans-inventory-controller";

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
  private readonly inventoryController: MobilePansInventoryController;
  private lifecycleGeneration = 0;
  private discoverySubscription?: { remove(): void };
  private discoveryErrorSubscription?: { remove(): void };
  private discoveryStateSubscription?: { remove(): void };
  private connectionSubscription?: { remove(): void };
  private settings?: PansManagerSettings;
  private rememberedTag?: ManagedDevice;
  private discoveries: readonly DiscoveredDeviceSnapshot[] = EMPTY_DISCOVERIES;
  private hardwareOperationPromise?: Promise<unknown>;
  private manualDiscoveryRequested = false;
  private developerModeEnabled: boolean;

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
    this.developerModeEnabled = options.developerModeEnabled ?? false;
    this.positionPublisher = new MobilePansPositionPublisher(
      {
        staleAfterMs: this.staleAfterMs,
        schedule: this.schedule,
        cancel: this.cancel,
        isConnectionCurrent: (generation) =>
          this.connectionController.isConnectionCurrent(generation),
        getSnapshot: this.getSnapshot,
        publish: (snapshot) => this.publish(snapshot),
      },
      {
        motionAdapter: options.motionAdapter,
        motionInterpolationEnabled: options.motionInterpolationEnabled,
      },
    );
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
      prepareTagForStreaming: () => this.prepareSelectedTagForStreaming(),
    });
    this.inventoryController = new MobilePansInventoryController({
      discoveryTimeoutMs: this.discoveryTimeoutMs,
      now: this.now,
      schedule: this.schedule,
      cancel: this.cancel,
      getRuntime: () => this.runtime,
      getDiscoveries: () => this.discoveries,
      isDeveloperModeEnabled: () => this.developerModeEnabled,
      runHardwareOperation: (action) => this.runHardwareOperation(action),
      onInventoryChanged: (inventory) => this.publishInventory(inventory),
      onCommissioningWarning: (commissioningWarning) =>
        this.publish({ ...this.snapshot, commissioningWarning }),
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

  attachFusionValue(value: SharedValue<FusedPositionOutput | null>): void {
    this.positionPublisher.attachFusionValue(value);
  }

  setMotionInterpolationEnabled(enabled: boolean): void {
    this.positionPublisher.setMotionInterpolationEnabled(enabled);
  }

  async setDeveloperModeEnabled(enabled: boolean): Promise<void> {
    this.developerModeEnabled = enabled;
    if (
      !enabled &&
      this.runtime &&
      this.snapshot.initialization === "ready" &&
      this.settings?.discoveryRssiCutoff !== DEFAULT_DISCOVERY_RSSI_CUTOFF
    ) {
      await this.setDiscoveryRssiCutoff(DEFAULT_DISCOVERY_RSSI_CUTOFF, true);
    }
  }

  async setDiscoveryRssiCutoff(
    cutoff: number,
    productionReset = false,
  ): Promise<void> {
    if (!productionReset && !this.developerModeEnabled) {
      throw new Error("Developer Mode is required to change signal filtering.");
    }
    if (
      !Number.isInteger(cutoff) ||
      cutoff < MIN_DISCOVERY_RSSI_CUTOFF ||
      cutoff > MAX_DISCOVERY_RSSI_CUTOFF
    ) {
      throw new Error(
        `Signal cutoff must be an integer from ${MIN_DISCOVERY_RSSI_CUTOFF} to ${MAX_DISCOVERY_RSSI_CUTOFF} dBm.`,
      );
    }
    await this.saveManagerSettings({ discoveryRssiCutoff: cutoff });
    this.publish({ ...this.snapshot, discoveryRssiCutoff: cutoff });
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
      if (
        !this.developerModeEnabled &&
        this.settings.discoveryRssiCutoff !== DEFAULT_DISCOVERY_RSSI_CUTOFF
      ) {
        this.settings = normalizePansManagerSettings({
          ...this.settings,
          discoveryRssiCutoff: DEFAULT_DISCOVERY_RSSI_CUTOFF,
        });
        await runtime.repository.saveSettings(this.settings);
      }
      this.rememberedTag = this.settings.rememberedTagDeviceId
        ? await runtime.repository.getDevice(
            this.settings.rememberedTagDeviceId,
          )
        : undefined;
      const [devices, networks] = await Promise.all([
        runtime.repository.listDevices(),
        runtime.repository.listNetworks(),
      ]);
      const knownAnchors = sortedCachedAnchors(devices);
      if (!this.rememberedTag && this.settings.rememberedTagDeviceId) {
        await this.saveRememberedTag(undefined);
      }
      // Active-network selection was a development-only workflow. Clear any
      // persisted legacy selection; commissioning now always names a target.
      if (this.settings.activeNetworkId) {
        await this.saveManagerSettings({ activeNetworkId: undefined });
      }
      this.installRuntimeListeners(runtime, generation);
      this.connectionController.setWantsConnection(Boolean(this.rememberedTag));
      this.publishState(this.rememberedTag ? "disconnected" : "idle", {
        initialization: "ready",
        managedDevices: devices,
        knownAnchors,
        networks,
        nativeBuildId: runtime.discovery.getDiagnostics?.().buildId,
        discoveryRssiCutoff: this.settings.discoveryRssiCutoff,
      });
      void this.connectionController.startReconnectLoop();
    } catch (cause) {
      if (generation !== this.lifecycleGeneration) return;
      this.publish({
        ...INITIAL_MOBILE_PANS_SNAPSHOT,
        initialization: "error",
        connectionState: "error",
        livePosition: {
          connectionState: "error",
          isStale: false,
          interpolationActive: false,
        },
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

  async startTagDiscovery(): Promise<void> {
    if (this.snapshot.connectionState === "connected") return;
    await this.startDiscovery();
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
    const saved = await persistSelectedTag(runtime, discovery, this.now());
    this.rememberedTag = saved;
    await this.saveRememberedTag(saved.id);
    this.connectionController.setWantsConnection(true);
    await this.inventoryController.refresh();
    this.publish({
      ...this.snapshot,
      rememberedTag: saved,
      error: undefined,
    });
  }

  async selectConfigureAndConnectTag(transportDeviceId: string): Promise<void> {
    this.publishState("connecting", { error: undefined });
    await this.selectTag(transportDeviceId);
    await this.connect();
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
      livePosition: {
        connectionState: "idle",
        isStale: false,
        interpolationActive: false,
      },
      rawPosition: undefined,
      lastUpdateAt: undefined,
      effectiveUpdateRateHz: 0,
      error: undefined,
    });
  }

  async clearSelectedTag(): Promise<void> {
    await this.forgetTag();
  }

  async renameSelectedTag(label: string): Promise<void> {
    const tag = this.rememberedTag;
    if (!tag) throw new Error("Select a tag before changing its name.");
    await this.renameDevice(tag.id, label);
  }

  async inspectDevice(deviceId: string): Promise<ManagedDevice> {
    return await this.inventoryController.inspectDevice(deviceId);
  }

  async renameDevice(deviceId: string, label: string): Promise<ManagedDevice> {
    const saved = await this.inventoryController.renameDevice(deviceId, label);
    if (this.rememberedTag?.id === saved.id) {
      this.rememberedTag = saved;
      this.publish({ ...this.snapshot, rememberedTag: saved });
    }
    return saved;
  }

  async createNetwork(name: string, panId: number): Promise<ManagedNetwork> {
    return await this.inventoryController.createNetwork(name, panId);
  }

  async updateNetwork(
    networkId: string,
    changes: { readonly name: string; readonly panId: number },
  ): Promise<ManagedNetwork> {
    return await this.inventoryController.updateNetwork(networkId, changes);
  }

  async deleteNetwork(networkId: string): Promise<void> {
    await this.inventoryController.deleteNetwork(networkId);
  }

  async persistDiscoveredAnchor(
    transportDeviceId: string,
    confirmRoleChange = false,
    targetNetworkId?: string,
  ): Promise<ManagedDevice> {
    if (
      confirmRoleChange &&
      this.rememberedTag?.transportDeviceId === transportDeviceId
    ) {
      await this.forgetTag();
    }
    return await this.inventoryController.persistDiscovery(transportDeviceId, {
      role: "anchor",
      confirmRoleChange,
      targetNetworkId,
    });
  }

  async persistDiscoveredDevice(
    transportDeviceId: string,
  ): Promise<ManagedDevice> {
    return await this.inventoryController.persistDiscovery(transportDeviceId);
  }

  async convertDeviceToPerformerTag(deviceId: string): Promise<ManagedDevice> {
    return await this.inventoryController.convertDeviceToPerformerTag(deviceId);
  }

  async assignDeviceToNetwork(
    deviceId: string,
    networkId: string,
  ): Promise<void> {
    await this.inventoryController.assignDeviceToNetwork(deviceId, networkId);
  }

  async setNetworkInitiator(
    networkId: string,
    anchorId: string,
  ): Promise<void> {
    await this.inventoryController.setNetworkInitiator(networkId, anchorId);
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
      const hardwareDiagnostics = await this.runHardwareOperation(
        async () =>
          await runtime.diagnostics.inspect(tag.id, tag.transportDeviceId),
      );
      this.publish({ ...this.snapshot, hardwareDiagnostics });
      return hardwareDiagnostics;
    } catch (cause) {
      const error = normalizeManagerError(cause, {
        deviceId: tag.id,
        operation: "refresh diagnostics",
      });
      this.publish({ ...this.snapshot, error });
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
    return (await this.inventoryController.refresh()).knownAnchors;
  }

  async renameAnchor(anchorId: string, label: string): Promise<ManagedDevice> {
    const runtime = this.requireRuntime();
    const anchor = await runtime.repository.getDevice(anchorId);
    if (
      !anchor ||
      (anchor.role !== "anchor" && anchor.lastKnownConfig?.role !== "anchor")
    ) {
      throw new Error("The selected cached anchor does not exist.");
    }
    return await this.inventoryController.renameDevice(anchorId, label);
  }

  async writeAnchorPosition(
    anchorId: string,
    position: AnchorFieldPosition,
  ): Promise<void> {
    await this.inventoryController.writeAnchorPosition(anchorId, position);
  }

  private async prepareSelectedTagForStreaming(): Promise<void> {
    const tag = this.rememberedTag;
    if (!tag) throw new Error("Select a tag before connecting.");
    this.rememberedTag =
      await this.inventoryController.ensurePerformerTagProfile(tag.id);
    this.publish({ ...this.snapshot, rememberedTag: this.rememberedTag });
  }

  private async runHardwareOperation<T>(action: () => Promise<T>): Promise<T> {
    if (this.hardwareOperationPromise) {
      throw new ManagerError(
        "OPERATION_CANCELLED",
        "Another PANS hardware operation is already in progress.",
      );
    }
    const wasConnected = this.snapshot.connectionState === "connected";
    const operation = (async () => {
      if (wasConnected) await this.connectionController.pauseForOperation();
      try {
        return await action();
      } finally {
        if (wasConnected) {
          await this.connectionController
            .resumeAfterOperation()
            .catch(() => undefined);
        }
      }
    })();
    const tracked = operation.finally(() => {
      if (this.hardwareOperationPromise === tracked) {
        this.hardwareOperationPromise = undefined;
      }
    });
    this.hardwareOperationPromise = tracked;
    return await tracked;
  }

  private publishInventory(inventory: MobilePansInventorySnapshot): void {
    this.publish({
      ...this.snapshot,
      networks: inventory.networks,
      managedDevices: inventory.devices,
      knownAnchors: inventory.knownAnchors,
    });
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
    await this.saveManagerSettings({ rememberedTagDeviceId: deviceId });
  }

  private async saveManagerSettings(
    changes: Partial<PansManagerSettings>,
  ): Promise<void> {
    const runtime = this.runtime;
    if (!runtime) throw new Error("PANS services are not ready.");
    const candidate: Partial<PansManagerSettings> = {
      ...this.settings,
      ...changes,
    };
    if (
      Object.prototype.hasOwnProperty.call(changes, "rememberedTagDeviceId") &&
      changes.rememberedTagDeviceId === undefined
    ) {
      delete candidate.rememberedTagDeviceId;
    }
    if (
      Object.prototype.hasOwnProperty.call(changes, "activeNetworkId") &&
      changes.activeNetworkId === undefined
    ) {
      delete candidate.activeNetworkId;
    }
    this.settings = normalizePansManagerSettings(candidate);
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

  private requireDeveloperRuntime(): MobilePansRuntime {
    if (!this.developerModeEnabled) {
      throw new Error("Developer Mode is required for network commissioning.");
    }
    return this.requireRuntime();
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
