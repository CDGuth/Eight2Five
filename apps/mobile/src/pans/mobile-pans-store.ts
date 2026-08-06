import {
  assertNetworkProfilePanId,
  assertUniqueName,
  assertValidLabel,
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  DEFAULT_DISCOVERY_RSSI_CUTOFF,
  deviceFromDiscovery,
  diffPerformerTagProfile,
  MAX_DISCOVERY_RSSI_CUTOFF,
  MIN_DISCOVERY_RSSI_CUTOFF,
  normalizeManagerError,
  normalizePansManagerSettings,
  normalizeTransportDeviceId,
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
  createLocalId,
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
      if (
        this.settings.activeNetworkId &&
        !networks.some(
          (network) => network.id === this.settings?.activeNetworkId,
        )
      ) {
        await this.saveManagerSettings({ activeNetworkId: undefined });
      }
      this.installRuntimeListeners(runtime, generation);
      this.connectionController.setWantsConnection(Boolean(this.rememberedTag));
      this.publishState(this.rememberedTag ? "disconnected" : "idle", {
        initialization: "ready",
        knownAnchors,
        networks,
        activeNetworkId: this.settings.activeNetworkId,
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

  async selectConfigureAndConnectTag(transportDeviceId: string): Promise<void> {
    await this.selectTag(transportDeviceId);
    await this.stopDiscovery();
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
    if (!this.developerModeEnabled) {
      throw new Error("Developer Mode is required to rename a tag.");
    }
    assertValidLabel(label);
    const runtime = this.requireRuntime();
    const tag = this.rememberedTag;
    if (!tag) throw new Error("Select a tag before changing its name.");
    await this.runHardwareOperation(async () => {
      const result = await runtime.configuration.applyConfigurationDiff(
        tag.id,
        {
          label,
        },
      );
      if (
        result.error ||
        result.writes.some(
          (write) => write.status === "failed" || write.status === "mismatch",
        )
      ) {
        throw new Error(
          result.error?.message ?? "The tag name could not be verified.",
        );
      }
      this.rememberedTag = (await runtime.repository.getDevice(tag.id)) ?? tag;
      this.publish({ ...this.snapshot, rememberedTag: this.rememberedTag });
    });
  }

  async createNetwork(name: string, panId: number): Promise<ManagedNetwork> {
    const runtime = this.requireDeveloperRuntime();
    const networks = await runtime.repository.listNetworks();
    assertUniqueName(
      name,
      networks.map((network) => network.name),
    );
    assertNetworkProfilePanId(panId);
    if (networks.some((network) => network.panId === panId)) {
      throw new Error("A network with this PAN ID already exists.");
    }
    const now = this.now();
    const network = await runtime.repository.saveNetwork({
      id: createLocalId("network"),
      name: name.trim(),
      panId,
      settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
    await this.refreshNetworksAndDevices();
    return network;
  }

  async updateNetwork(
    networkId: string,
    changes: { readonly name: string; readonly panId: number },
  ): Promise<ManagedNetwork> {
    const runtime = this.requireDeveloperRuntime();
    const [network, networks] = await Promise.all([
      runtime.repository.getNetwork(networkId),
      runtime.repository.listNetworks(),
    ]);
    if (!network) throw new Error("The selected network no longer exists.");
    assertUniqueName(
      changes.name,
      networks.filter((item) => item.id !== networkId).map((item) => item.name),
    );
    assertNetworkProfilePanId(changes.panId);
    if (
      networks.some(
        (item) => item.id !== networkId && item.panId === changes.panId,
      )
    ) {
      throw new Error("A network with this PAN ID already exists.");
    }
    // Profile edits are app-local. Physical nodes change only via explicit assignment.
    const saved = await runtime.repository.saveNetwork({
      ...network,
      name: changes.name.trim(),
      panId: changes.panId,
      updatedAt: this.now(),
    });
    await this.refreshNetworksAndDevices();
    return saved;
  }

  async deleteNetwork(networkId: string): Promise<void> {
    const runtime = this.requireDeveloperRuntime();
    const devices = await runtime.repository.listNetworkDevices(networkId);
    for (const device of devices) {
      await runtime.repository.dissociateDevice(
        networkId,
        device.id,
        this.now(),
      );
    }
    await runtime.repository.deleteNetwork(networkId);
    if (this.settings?.activeNetworkId === networkId) {
      await this.saveManagerSettings({ activeNetworkId: undefined });
    }
    await this.refreshNetworksAndDevices();
  }

  async setActiveNetwork(networkId: string | undefined): Promise<void> {
    const runtime = this.requireDeveloperRuntime();
    if (networkId && !(await runtime.repository.getNetwork(networkId))) {
      throw new Error("The selected network no longer exists.");
    }
    await this.saveManagerSettings({ activeNetworkId: networkId });
    this.publish({ ...this.snapshot, activeNetworkId: networkId });
  }

  async persistDiscoveredAnchor(
    transportDeviceId: string,
    confirmRoleChange = false,
  ): Promise<ManagedDevice> {
    const runtime = this.requireDeveloperRuntime();
    const discovery = this.discoveries.find(
      (item) => item.transportDeviceId === transportDeviceId,
    );
    if (
      !discovery ||
      discovery.stale ||
      discovery.compatibility !== "compatible"
    ) {
      throw new Error("The selected device is no longer available.");
    }
    const advertisedRole = discovery.presence?.role;
    if (advertisedRole !== "anchor" && !confirmRoleChange) {
      throw new Error("Confirm changing this device from a tag to an anchor.");
    }
    const devices = await runtime.repository.listDevices();
    const existing = devices.find(
      (device) => device.transportDeviceId === transportDeviceId,
    );
    let saved = await runtime.repository.saveDevice({
      ...deviceFromDiscovery(discovery, existing, {
        id: existing?.id ?? createLocalId("anchor"),
        now: this.now(),
      }),
      role: advertisedRole ?? existing?.role,
    });
    await runtime.discovery.stop();
    await this.runHardwareOperation(async () => {
      const inspection = await runtime.configuration.inspectAndCache(saved.id);
      if (inspection.operationMode.role !== "anchor") {
        if (!confirmRoleChange) {
          throw new Error(
            "Confirm changing this device from a tag to an anchor.",
          );
        }
        const result = await runtime.configuration.applyConfigurationDiff(
          saved.id,
          {
            role: "anchor",
            uwbMode: "active",
            ledEnabled: true,
            firmwareUpdateEnabled: true,
            initiatorEnabled: false,
          },
        );
        if (result.error || result.inspected?.operationMode.role !== "anchor") {
          throw new Error(
            result.error?.message ?? "The anchor role could not be verified.",
          );
        }
        const reinspection = await runtime.configuration.inspectAndCache(
          saved.id,
        );
        if (reinspection.operationMode.role !== "anchor") {
          throw new Error(
            "The anchor role did not persist after reconnecting.",
          );
        }
      }
      if (this.settings?.activeNetworkId) {
        const assignment =
          await runtime.commissioning.assignDeviceToNetworkProfile({
            deviceId: saved.id,
            targetNetworkId: this.settings.activeNetworkId,
          });
        if (assignment.outcome !== "assigned") {
          throw new Error(
            assignment.error?.message ??
              "The anchor network could not be verified.",
          );
        }
      }
    });
    saved = (await runtime.repository.getDevice(saved.id)) ?? saved;
    await this.refreshNetworksAndDevices();
    return saved;
  }

  async assignDeviceToActiveNetwork(deviceId: string): Promise<void> {
    const runtime = this.requireDeveloperRuntime();
    const targetNetworkId = this.settings?.activeNetworkId;
    if (!targetNetworkId) throw new Error("Select an active network first.");
    await this.runHardwareOperation(async () => {
      const result = await runtime.commissioning.assignDeviceToNetworkProfile({
        deviceId,
        targetNetworkId,
      });
      if (result.outcome !== "assigned") {
        throw new Error(result.error?.message ?? "Network assignment failed.");
      }
    });
    await this.refreshNetworksAndDevices();
  }

  async setAnchorInitiator(anchorId: string): Promise<void> {
    const runtime = this.requireDeveloperRuntime();
    const activeNetworkId = this.settings?.activeNetworkId;
    if (!activeNetworkId) throw new Error("Select an active network first.");
    const anchors = (
      await runtime.repository.listNetworkDevices(activeNetworkId)
    ).filter(
      (device) =>
        device.lastKnownConfig?.role === "anchor" || device.role === "anchor",
    );
    const selected = anchors.find((anchor) => anchor.id === anchorId);
    if (!selected)
      throw new Error("The selected anchor is not in the active network.");
    const unreachable: string[] = [];
    await this.runHardwareOperation(async () => {
      const setResult = await runtime.configuration.applyConfigurationDiff(
        anchorId,
        {
          initiatorEnabled: true,
        },
      );
      if (
        setResult.error ||
        setResult.writes.some(
          (write) => write.status === "mismatch" || write.status === "failed",
        )
      ) {
        throw new Error(
          setResult.error?.message ?? "Initiator readback failed.",
        );
      }
      for (const prior of anchors.filter((anchor) => anchor.id !== anchorId)) {
        const reachable = this.discoveries.some(
          (item) =>
            !item.stale &&
            normalizeTransportDeviceId(item.transportDeviceId) ===
              normalizeTransportDeviceId(prior.transportDeviceId),
        );
        if (!reachable) {
          unreachable.push(
            prior.lastKnownConfig?.label ?? prior.label ?? prior.id,
          );
          continue;
        }
        const clearResult = await runtime.configuration.applyConfigurationDiff(
          prior.id,
          { initiatorEnabled: false },
        );
        if (
          clearResult.error ||
          clearResult.writes.some(
            (write) => write.status === "mismatch" || write.status === "failed",
          )
        ) {
          unreachable.push(
            prior.lastKnownConfig?.label ?? prior.label ?? prior.id,
          );
        }
      }
      const verification =
        await runtime.configuration.inspectAndCache(anchorId);
      if (
        verification.operationMode.role !== "anchor" ||
        !verification.operationMode.initiatorEnabled
      ) {
        throw new Error("The selected initiator could not be verified.");
      }
    });
    await this.refreshNetworksAndDevices();
    this.publish({
      ...this.snapshot,
      commissioningWarning: unreachable.length
        ? `Initiator set, but ${unreachable.length} prior anchor${unreachable.length === 1 ? " was" : "s were"} unreachable and could not be verified.`
        : undefined,
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
    const runtime = this.requireRuntime();
    const devices = await runtime.repository.listDevices();
    const knownAnchors = sortedCachedAnchors(devices);
    this.publish({ ...this.snapshot, knownAnchors });
    return knownAnchors;
  }

  async renameAnchor(anchorId: string, label: string): Promise<ManagedDevice> {
    if (!this.developerModeEnabled) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "Enable Developer Mode before renaming anchors.",
      );
    }
    const requestedLabel = label.trim();
    assertValidLabel(requestedLabel);
    const runtime = this.requireRuntime();
    const anchor = await runtime.repository.getDevice(anchorId);
    if (
      !anchor ||
      (anchor.role !== "anchor" && anchor.lastKnownConfig?.role !== "anchor")
    ) {
      throw new Error("The selected cached anchor does not exist.");
    }
    try {
      await this.runHardwareOperation(async () => {
        const result = await runtime.configuration.applyConfigurationDiff(
          anchor.id,
          { label: requestedLabel },
        );
        const write = result.writes.find((item) => item.field === "label");
        if (
          result.error ||
          write?.status === "failed" ||
          write?.status === "mismatch"
        ) {
          throw new ManagerError(
            result.error?.code ?? "WRITE_FAILED",
            result.error?.message ?? "The anchor name could not be verified.",
            { deviceId: anchor.id, operation: "rename anchor" },
          );
        }
      });
      await this.refreshCachedAnchors();
      return (await runtime.repository.getDevice(anchor.id)) ?? anchor;
    } catch (cause) {
      throw normalizeManagerError(cause, {
        deviceId: anchor.id,
        operation: "rename anchor",
      });
    }
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
    const anchor = await runtime.repository.getDevice(anchorId);
    if (
      !anchor ||
      (anchor.role !== "anchor" && anchor.lastKnownConfig?.role !== "anchor")
    ) {
      throw new Error("The selected cached anchor does not exist.");
    }
    const cachedPosition =
      anchor.lastKnownConfig?.role === "anchor"
        ? anchor.lastKnownConfig.position
        : undefined;
    if (
      cachedPosition?.xMeters === position.xMeters &&
      cachedPosition.yMeters === position.yMeters &&
      cachedPosition.zMeters === position.zMeters &&
      cachedPosition.quality === 100
    ) {
      return;
    }
    const activeNetworkMatch =
      this.developerModeEnabled &&
      this.settings?.activeNetworkId !== undefined &&
      anchor.networkId === this.settings.activeNetworkId;
    const connectedTagMatch = Boolean(
      this.rememberedTag &&
      this.snapshot.connectionState === "connected" &&
      areDevicesNetworkAssociated(this.rememberedTag, anchor),
    );
    if (!activeNetworkMatch && !connectedTagMatch) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "The anchor is not verified on the active network.",
        { deviceId: anchor.id, operation: "write anchor position" },
      );
    }
    try {
      await this.runHardwareOperation(async () => {
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
      });
      await this.refreshCachedAnchors();
    } catch (cause) {
      const error = normalizeManagerError(cause, {
        deviceId: anchor.id,
        operation: "write anchor position",
      });
      throw error;
    }
  }

  private async prepareSelectedTagForStreaming(): Promise<void> {
    const runtime = this.requireRuntime();
    const tag = this.rememberedTag;
    if (!tag) throw new Error("Select a tag before connecting.");
    await this.runHardwareOperation(async () => {
      const inspection = await runtime.configuration.inspectAndCache(tag.id);
      const profileChanges = diffPerformerTagProfile(inspection);
      let reconnectVerificationRequired = false;
      let locationModeWrittenUnverified = false;
      if (Object.keys(profileChanges).length > 0) {
        const configured = await runtime.configuration.applyConfigurationDiff(
          tag.id,
          profileChanges,
        );
        if (
          configured.error ||
          configured.writes.some(
            (write) => write.status === "failed" || write.status === "mismatch",
          )
        ) {
          throw new Error(
            configured.error?.message ??
              "The performer tag profile could not be verified.",
          );
        }
        reconnectVerificationRequired = configured.writes.length > 0;
        locationModeWrittenUnverified = configured.writes.some(
          (write) =>
            write.field === "locationDataMode" &&
            write.status === "written-unverified",
        );
        if (configured.inspected) {
          const remaining = diffPerformerTagProfile(configured.inspected);
          if (
            configured.inspected.locationDataMode === undefined &&
            locationModeWrittenUnverified
          ) {
            delete remaining.locationDataMode;
          }
          if (Object.keys(remaining).length > 0) {
            throw new Error(
              "The performer tag profile readback did not match.",
            );
          }
        }
      }
      const activeNetworkId = this.developerModeEnabled
        ? this.settings?.activeNetworkId
        : undefined;
      if (activeNetworkId) {
        const assignment =
          await runtime.commissioning.assignDeviceToNetworkProfile({
            deviceId: tag.id,
            targetNetworkId: activeNetworkId,
          });
        if (assignment.outcome !== "assigned") {
          throw new Error(
            assignment.error?.message ??
              "The tag network could not be verified.",
          );
        }
        reconnectVerificationRequired =
          reconnectVerificationRequired ||
          Boolean(assignment.configuration?.writes.length);
      }
      if (reconnectVerificationRequired) {
        const reinspection = await runtime.configuration.inspectAndCache(
          tag.id,
        );
        const remaining = diffPerformerTagProfile(reinspection);
        if (
          reinspection.locationDataMode === undefined &&
          locationModeWrittenUnverified
        ) {
          delete remaining.locationDataMode;
        }
        if (Object.keys(remaining).length > 0) {
          throw new Error(
            "The performer tag profile did not persist after reconnecting.",
          );
        }
        if (activeNetworkId) {
          const activeNetwork =
            await runtime.repository.getNetwork(activeNetworkId);
          if (activeNetwork && reinspection.panId !== activeNetwork.panId) {
            throw new Error(
              "The active network did not persist after reconnecting.",
            );
          }
        }
      }
      // The native PANS gateway exposes no hardware-reset command. Closing the
      // serialized configuration session here and opening the stream session
      // below provides the required reconnect/readback boundary.
      this.rememberedTag =
        (await runtime.repository.getDevice(tag.id)) ?? this.rememberedTag;
    });
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

  private async refreshNetworksAndDevices(): Promise<void> {
    const runtime = this.requireRuntime();
    const [networks, devices] = await Promise.all([
      runtime.repository.listNetworks(),
      runtime.repository.listDevices(),
    ]);
    this.publish({
      ...this.snapshot,
      networks,
      knownAnchors: sortedCachedAnchors(devices),
      activeNetworkId: this.settings?.activeNetworkId,
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
