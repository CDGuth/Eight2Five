import {
  assertNetworkProfilePanId,
  assertUniqueName,
  assertValidLabel,
  cachedDeviceMatchesPerformerTagProfile,
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  deviceFromDiscovery,
  diffPerformerTagProfile,
  diffProductionAnchorProfile,
  normalizeManagerError,
  normalizeTransportDeviceId,
  ManagerError,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  type ManagedNetwork,
  type PansInspectionResult,
} from "@eight2five/mobile/pans-manager";
import type { AnchorFieldPosition } from "@eight2five/mobile/field";

import { createLocalId, findDiscovery } from "./mobile-pans-model";
import { sortedCachedAnchors } from "./mobile-pans-device-cache";
import type { MobilePansRuntime } from "./mobile-pans-runtime";

interface InventoryControllerHost {
  readonly discoveryTimeoutMs: number;
  readonly now: () => number;
  readonly schedule: typeof setTimeout;
  readonly cancel: typeof clearTimeout;
  getRuntime(): MobilePansRuntime | undefined;
  getDiscoveries(): readonly DiscoveredDeviceSnapshot[];
  isDeveloperModeEnabled(): boolean;
  runHardwareOperation<T>(action: () => Promise<T>): Promise<T>;
  onInventoryChanged(inventory: MobilePansInventorySnapshot): void;
  onCommissioningWarning(warning: string | undefined): void;
}

export interface MobilePansInventorySnapshot {
  readonly networks: readonly ManagedNetwork[];
  readonly devices: readonly ManagedDevice[];
  readonly knownAnchors: readonly ManagedDevice[];
}

/**
 * Owns persistent PANS inventory and explicit commissioning operations.
 * Connection/reconnect and position streaming deliberately remain in
 * MobilePansConnectionController/MobilePansStore.
 */
export class MobilePansInventoryController {
  private anchorWritePromise?: Promise<void>;

  constructor(private readonly host: InventoryControllerHost) {}

  async refresh(): Promise<MobilePansInventorySnapshot> {
    const runtime = this.requireRuntime();
    const [networks, devices] = await Promise.all([
      runtime.repository.listNetworks(),
      runtime.repository.listDevices(),
    ]);
    const inventory = Object.freeze({
      networks,
      devices,
      knownAnchors: sortedCachedAnchors(devices),
    });
    this.host.onInventoryChanged(inventory);
    return inventory;
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
    const now = this.host.now();
    const network = await runtime.repository.saveNetwork({
      id: createLocalId("network"),
      name: name.trim(),
      panId,
      settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
      createdAt: now,
      updatedAt: now,
    });
    await this.refresh();
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
    const saved = await runtime.repository.saveNetwork({
      ...network,
      name: changes.name.trim(),
      panId: changes.panId,
      updatedAt: this.host.now(),
    });
    await this.refresh();
    return saved;
  }

  async deleteNetwork(networkId: string): Promise<void> {
    const runtime = this.requireDeveloperRuntime();
    const devices = await runtime.repository.listNetworkDevices(networkId);
    for (const device of devices) {
      await runtime.repository.dissociateDevice(
        networkId,
        device.id,
        this.host.now(),
      );
    }
    await runtime.repository.deleteNetwork(networkId);
    await this.refresh();
  }

  async persistDiscovery(
    transportDeviceId: string,
    options: {
      readonly role?: "tag" | "anchor";
      readonly confirmRoleChange?: boolean;
      readonly targetNetworkId?: string;
    } = {},
  ): Promise<ManagedDevice> {
    const runtime = this.requireDeveloperRuntime();
    const discovery = this.findCurrentDiscovery(transportDeviceId);
    if (!discovery || discovery.compatibility !== "compatible") {
      throw new Error("The selected device is no longer available.");
    }
    const devices = await runtime.repository.listDevices();
    const normalizedTransportId = normalizeTransportDeviceId(transportDeviceId);
    const existing = devices.find(
      (device) =>
        normalizeTransportDeviceId(device.transportDeviceId) ===
        normalizedTransportId,
    );
    let saved = await runtime.repository.saveDevice({
      ...deviceFromDiscovery(discovery, existing, {
        id: existing?.id ?? createLocalId(options.role ?? "device"),
        now: this.host.now(),
      }),
      role: discovery.presence?.role ?? existing?.role,
    });

    if (options.role === "anchor") {
      const advertisedRole = discovery.presence?.role;
      if (advertisedRole !== "anchor" && !options.confirmRoleChange) {
        throw new Error(
          "Confirm changing this device from a tag to an anchor.",
        );
      }
      await this.host.runHardwareOperation(async () => {
        await this.withDiscoveredDevice(saved, async () => {
          await this.repairAnchorProfile(
            saved,
            options.confirmRoleChange === true,
          );
          if (options.targetNetworkId) {
            await this.assignDeviceToNetworkUnsafe(
              saved.id,
              options.targetNetworkId,
            );
          }
        });
      });
    } else if (options.targetNetworkId) {
      await this.assignDeviceToNetwork(saved.id, options.targetNetworkId);
    }

    saved = (await runtime.repository.getDevice(saved.id)) ?? saved;
    await this.refresh();
    return saved;
  }

  async ensurePerformerTagProfile(deviceId: string): Promise<ManagedDevice> {
    const runtime = this.requireRuntime();
    const device = await runtime.repository.getDevice(deviceId);
    if (!device) throw new Error("The selected device no longer exists.");
    if (cachedDeviceMatchesPerformerTagProfile(device)) return device;

    await this.host.runHardwareOperation(async () => {
      await this.withDiscoveredDevice(device, async () => {
        await this.repairPerformerTagProfile(device, false);
      });
    });
    return (await runtime.repository.getDevice(device.id)) ?? device;
  }

  async convertDeviceToPerformerTag(deviceId: string): Promise<ManagedDevice> {
    const runtime = this.requireDeveloperRuntime();
    const device = await runtime.repository.getDevice(deviceId);
    if (!device) throw new Error("The selected device no longer exists.");

    await this.host.runHardwareOperation(async () => {
      await this.withDiscoveredDevice(device, async () => {
        await this.repairPerformerTagProfile(device, true);
      });
    });
    await this.refresh();
    return (await runtime.repository.getDevice(device.id)) ?? device;
  }

  async assignDeviceToNetwork(
    deviceId: string,
    targetNetworkId: string,
  ): Promise<void> {
    const runtime = this.requireDeveloperRuntime();
    const [device, network] = await Promise.all([
      runtime.repository.getDevice(deviceId),
      runtime.repository.getNetwork(targetNetworkId),
    ]);
    if (!device) throw new Error("The selected device no longer exists.");
    if (!network) throw new Error("The selected network no longer exists.");
    await this.host.runHardwareOperation(async () => {
      await this.withDiscoveredDevice(device, async () => {
        await this.assignDeviceToNetworkUnsafe(device.id, network.id);
      });
    });
    await this.refresh();
  }

  async setNetworkInitiator(
    networkId: string,
    anchorId: string,
  ): Promise<void> {
    const runtime = this.requireDeveloperRuntime();
    const anchors = (
      await runtime.repository.listNetworkDevices(networkId)
    ).filter(
      (device) =>
        device.role === "anchor" || device.lastKnownConfig?.role === "anchor",
    );
    const selected = anchors.find((anchor) => anchor.id === anchorId);
    if (!selected) {
      throw new Error("The selected anchor is not assigned to this network.");
    }
    const unreachable: string[] = [];
    await this.host.runHardwareOperation(async () => {
      await this.withDiscoveredDevice(selected, async () => {
        const setResult = await runtime.configuration.applyConfigurationDiff(
          selected.id,
          { initiatorEnabled: true },
        );
        this.assertConfigurationSucceeded(
          setResult,
          "Initiator readback failed.",
        );
        const verification = await runtime.configuration.inspectAndCache(
          selected.id,
        );
        if (
          verification.operationMode.role !== "anchor" ||
          !verification.operationMode.initiatorEnabled
        ) {
          throw new Error("The selected initiator could not be verified.");
        }
      });

      for (const prior of anchors.filter((anchor) => anchor.id !== anchorId)) {
        if (!this.findCurrentDiscovery(prior.transportDeviceId)) {
          unreachable.push(this.deviceName(prior));
          continue;
        }
        try {
          await this.withDiscoveredDevice(prior, async () => {
            const clearResult =
              await runtime.configuration.applyConfigurationDiff(prior.id, {
                initiatorEnabled: false,
              });
            this.assertConfigurationSucceeded(
              clearResult,
              "Prior initiator could not be cleared.",
            );
          });
        } catch {
          unreachable.push(this.deviceName(prior));
        }
      }
    });
    await this.refresh();
    this.host.onCommissioningWarning(
      unreachable.length
        ? `Initiator set, but ${unreachable.length} prior anchor${
            unreachable.length === 1 ? " was" : "s were"
          } unreachable and could not be verified.`
        : undefined,
    );
  }

  async inspectDevice(deviceId: string): Promise<ManagedDevice> {
    const runtime = this.requireDeveloperRuntime();
    const device = await runtime.repository.getDevice(deviceId);
    if (!device) throw new Error("The selected device no longer exists.");
    await this.host.runHardwareOperation(async () => {
      await this.withDiscoveredDevice(device, async () => {
        await runtime.configuration.inspectAndCache(device.id);
      });
    });
    await this.refresh();
    return (await runtime.repository.getDevice(device.id)) ?? device;
  }

  async renameDevice(deviceId: string, label: string): Promise<ManagedDevice> {
    this.requireDeveloperRuntime();
    const requestedLabel = label.trim();
    assertValidLabel(requestedLabel);
    const runtime = this.requireRuntime();
    const device = await runtime.repository.getDevice(deviceId);
    if (!device) throw new Error("The selected device no longer exists.");
    try {
      await this.host.runHardwareOperation(async () => {
        await this.withDiscoveredDevice(device, async () => {
          const result = await runtime.configuration.applyConfigurationDiff(
            device.id,
            { label: requestedLabel },
          );
          this.assertConfigurationSucceeded(
            result,
            "The device name could not be verified.",
          );
        });
      });
      await this.refresh();
      return (await runtime.repository.getDevice(device.id)) ?? device;
    } catch (cause) {
      throw normalizeManagerError(cause, {
        deviceId: device.id,
        operation: "rename device",
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
    const runtime = this.requireDeveloperRuntime();
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
    try {
      await this.host.runHardwareOperation(async () => {
        await this.withDiscoveredDevice(anchor, async () => {
          const result = await runtime.configuration.applyConfigurationDiff(
            anchor.id,
            { position: { ...position, quality: 100 } },
          );
          const write = result.writes.find((item) => item.field === "position");
          if (result.error || write?.status !== "written-unverified") {
            throw new ManagerError(
              result.error?.code ?? "WRITE_FAILED",
              result.error?.message ??
                "The anchor rejected the position write.",
              { deviceId: anchor.id, operation: "write anchor position" },
            );
          }
        });
      });
      await this.refresh();
    } catch (cause) {
      throw normalizeManagerError(cause, {
        deviceId: anchor.id,
        operation: "write anchor position",
      });
    }
  }

  private async repairAnchorProfile(
    device: ManagedDevice,
    allowRoleChange: boolean,
  ): Promise<void> {
    const runtime = this.requireRuntime();
    const inspection = await runtime.configuration.inspectAndCache(device.id);
    const changingRole = inspection.operationMode.role !== "anchor";
    if (changingRole && !allowRoleChange) {
      throw new Error("Confirm changing this device from a tag to an anchor.");
    }

    const changes = diffProductionAnchorProfile(inspection);
    if (changingRole) changes.initiatorEnabled = false;
    if (Object.keys(changes).length === 0) return;

    const configured = await runtime.configuration.applyConfigurationDiff(
      device.id,
      changes,
    );
    this.assertConfigurationSucceeded(
      configured,
      "The production anchor profile could not be verified.",
    );
    const reinspection = await runtime.configuration.inspectAndCache(device.id);
    if (
      Object.keys(diffProductionAnchorProfile(reinspection)).length > 0 ||
      (changingRole && reinspection.operationMode.initiatorEnabled)
    ) {
      throw new Error(
        "The production anchor profile did not persist after reconnecting.",
      );
    }
  }

  private async repairPerformerTagProfile(
    device: ManagedDevice,
    verifyAfterReconnect: boolean,
  ): Promise<void> {
    const runtime = this.requireRuntime();
    const inspection = await runtime.configuration.inspectAndCache(device.id);
    const changes = diffPerformerTagProfile(inspection);
    if (Object.keys(changes).length === 0) return;

    const configured = await runtime.configuration.applyConfigurationDiff(
      device.id,
      changes,
    );
    this.assertConfigurationSucceeded(
      configured,
      "The performer tag profile could not be verified.",
    );
    const locationModeWrittenUnverified = configured.writes.some(
      (write) =>
        write.field === "locationDataMode" &&
        write.status === "written-unverified",
    );
    if (configured.inspected) {
      this.assertPerformerTagProfile(
        configured.inspected,
        locationModeWrittenUnverified,
      );
    }
    if (verifyAfterReconnect) {
      const reinspection = await runtime.configuration.inspectAndCache(
        device.id,
      );
      this.assertPerformerTagProfile(
        reinspection,
        locationModeWrittenUnverified,
      );
    }
  }

  private assertPerformerTagProfile(
    inspection: PansInspectionResult,
    allowMissingLocationMode: boolean,
  ): void {
    const remaining = diffPerformerTagProfile(inspection);
    if (allowMissingLocationMode && inspection.locationDataMode === undefined) {
      delete remaining.locationDataMode;
    }
    if (Object.keys(remaining).length > 0) {
      throw new Error("The performer tag profile readback did not match.");
    }
  }

  private async assignDeviceToNetworkUnsafe(
    deviceId: string,
    targetNetworkId: string,
  ): Promise<void> {
    const runtime = this.requireRuntime();
    const result = await runtime.commissioning.assignDeviceToNetworkProfile({
      deviceId,
      targetNetworkId,
    });
    if (result.outcome !== "assigned") {
      throw new Error(result.error?.message ?? "Network assignment failed.");
    }
  }

  private async withDiscoveredDevice<T>(
    device: ManagedDevice,
    action: () => Promise<T>,
  ): Promise<T> {
    const runtime = this.requireRuntime();
    const existing = this.findCurrentDiscovery(device.transportDeviceId);
    const ownsDiscovery = !runtime.discovery.desiredScanning;
    if (ownsDiscovery) {
      const permission = runtime.discovery.getPermissionStatus();
      if (permission.bluetooth !== "granted") {
        await runtime.discovery.requestPermissions();
      }
      await runtime.discovery.start();
    }
    if (!existing) await this.waitForDiscovery(device);
    try {
      return await action();
    } finally {
      if (ownsDiscovery) await runtime.discovery.stop().catch(() => undefined);
    }
  }

  private async waitForDiscovery(device: ManagedDevice): Promise<void> {
    const runtime = this.requireRuntime();
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let subscription: { remove(): void } | undefined;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        this.host.cancel(timer);
        subscription?.remove();
        action();
      };
      const timer = this.host.schedule(
        () =>
          finish(() =>
            reject(
              new ManagerError(
                "DEVICE_NOT_FOUND",
                "The selected PANS device was not found nearby.",
                { deviceId: device.id, operation: "discover device" },
              ),
            ),
          ),
        this.host.discoveryTimeoutMs,
      );
      subscription = runtime.discovery.subscribe((discoveries) => {
        const match = findDiscovery(discoveries, device.transportDeviceId);
        if (!match || match.stale || match.compatibility !== "compatible")
          return;
        finish(resolve);
      });
      if (settled) subscription.remove();
    });
  }

  private findCurrentDiscovery(
    transportDeviceId: string,
  ): DiscoveredDeviceSnapshot | undefined {
    const match = findDiscovery(this.host.getDiscoveries(), transportDeviceId);
    return match && !match.stale ? match : undefined;
  }

  private assertConfigurationSucceeded(
    result: {
      readonly error?: { readonly message: string };
      readonly writes: readonly { readonly status: string }[];
    },
    fallback: string,
  ): void {
    if (
      result.error ||
      result.writes.some(
        (write) => write.status === "failed" || write.status === "mismatch",
      )
    ) {
      throw new Error(result.error?.message ?? fallback);
    }
  }

  private deviceName(device: ManagedDevice): string {
    return device.lastKnownConfig?.label ?? device.label ?? device.id;
  }

  private requireRuntime(): MobilePansRuntime {
    const runtime = this.host.getRuntime();
    if (!runtime) throw new Error("PANS services are not ready.");
    return runtime;
  }

  private requireDeveloperRuntime(): MobilePansRuntime {
    if (!this.host.isDeveloperModeEnabled()) {
      throw new Error("Developer Mode is required for PANS commissioning.");
    }
    return this.requireRuntime();
  }
}
