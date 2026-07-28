import React from "react";
import type {
  DeviceConfigurationSnapshot,
  ManagedDevice,
  ManagedNetwork,
  PansManagerSettings,
} from "@eight2five/mobile/pans-manager";

type Listener = () => void;
export interface ManagedNetworkSnapshot {
  network: ManagedNetwork | undefined;
  devices: ManagedDevice[];
}

const shallowEqual = (left: object, right: object) => {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        (left as Record<string, unknown>)[key] ===
        (right as Record<string, unknown>)[key],
    )
  );
};

function reconcile<T extends { id: string }>(previous: T[], incoming: T[]) {
  const byId = new Map(previous.map((item) => [item.id, item]));
  const next = incoming.map((item) => {
    const old = byId.get(item.id);
    return old && shallowEqual(old, item) ? old : item;
  });
  return next.length === previous.length &&
    next.every((item, index) => item === previous[index])
    ? previous
    : next;
}

function reconcileOne<T extends object>(previous: T | undefined, incoming: T) {
  return previous && shallowEqual(previous, incoming) ? previous : incoming;
}

export class PansPersistedStore {
  private listeners = new Set<Listener>();
  private networks: ManagedNetwork[] = [];
  private devices: ManagedDevice[] = [];
  private snapshots: Record<string, DeviceConfigurationSnapshot> = {};
  private settings: PansManagerSettings | undefined;
  private networkCache = new Map<string, ManagedNetworkSnapshot>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getNetworks = () => this.networks;
  getDevices = () => this.devices;
  getSnapshots = () => this.snapshots;
  getDeviceSnapshot = (id: string) => this.snapshots[id];
  getSettings = () => this.settings;
  getNetwork = (id: string) => this.networks.find((item) => item.id === id);
  getDevice = (id: string) => this.devices.find((item) => item.id === id);
  getNetworkSnapshot = (id: string) => {
    const network = this.getNetwork(id);
    const devices = this.devices.filter((item) => item.networkId === id);
    const cached = this.networkCache.get(id);
    if (
      cached &&
      cached.network === network &&
      devices.length === cached.devices.length &&
      devices.every((item, index) => item === cached.devices[index])
    )
      return cached;
    const next = { network, devices };
    this.networkCache.set(id, next);
    return next;
  };

  replace(input: {
    networks: ManagedNetwork[];
    devices: ManagedDevice[];
    snapshots: Record<string, DeviceConfigurationSnapshot>;
    settings: PansManagerSettings | undefined;
  }) {
    const networks = reconcile(this.networks, input.networks);
    const devices = reconcile(this.devices, input.devices);
    const snapshots = this.reconcileSnapshots(input.snapshots);
    const settings =
      this.settings &&
      input.settings &&
      shallowEqual(this.settings, input.settings)
        ? this.settings
        : input.settings;
    if (
      networks === this.networks &&
      devices === this.devices &&
      snapshots === this.snapshots &&
      settings === this.settings
    )
      return;
    this.networks = networks;
    this.devices = devices;
    this.snapshots = snapshots;
    this.settings = settings;
    for (const listener of this.listeners) listener();
  }

  upsertNetwork(network: ManagedNetwork) {
    this.upsertNetworks([network]);
  }

  upsertNetworks(incoming: ManagedNetwork[]) {
    const byId = new Map(incoming.map((item) => [item.id, item]));
    const retained = this.networks.map((item) => {
      const next = byId.get(item.id);
      if (!next) return item;
      byId.delete(item.id);
      return reconcileOne(item, next);
    });
    this.publish({ networks: [...retained, ...byId.values()] });
  }

  removeNetwork(id: string, affectedDevices: ManagedDevice[] = []) {
    this.publish({
      networks: this.networks.filter((item) => item.id !== id),
      devices: reconcile(
        this.devices,
        mergeById(this.devices, affectedDevices),
      ),
    });
  }

  upsertDevice(device: ManagedDevice, snapshot?: DeviceConfigurationSnapshot) {
    const index = this.devices.findIndex((item) => item.id === device.id);
    const old = index < 0 ? undefined : this.devices[index];
    const canonical = reconcileOne(old, device);
    const devices =
      index < 0
        ? [...this.devices, canonical]
        : canonical === old
          ? this.devices
          : this.devices.map((item, itemIndex) =>
              itemIndex === index ? canonical : item,
            );
    this.publish({
      devices,
      ...(snapshot ? { snapshots: [snapshot] } : {}),
    });
  }

  upsertDeviceWithSnapshot(
    device: ManagedDevice,
    snapshot: DeviceConfigurationSnapshot | undefined,
  ) {
    const index = this.devices.findIndex((item) => item.id === device.id);
    const old = index < 0 ? undefined : this.devices[index];
    const canonical = reconcileOne(old, device);
    const devices =
      index < 0
        ? [...this.devices, canonical]
        : canonical === old
          ? this.devices
          : this.devices.map((item, itemIndex) =>
              itemIndex === index ? canonical : item,
            );
    this.publish({
      devices,
      ...(snapshot
        ? { snapshots: [snapshot] }
        : { removeSnapshotIds: [device.id] }),
    });
  }

  upsertDevices(devices: ManagedDevice[]) {
    const next = reconcile(this.devices, mergeById(this.devices, devices));
    this.publish({ devices: next });
  }

  removeDevice(id: string) {
    this.publish({
      devices: this.devices.filter((item) => item.id !== id),
      removeSnapshotIds: [id],
    });
  }

  upsertSnapshot(snapshot: DeviceConfigurationSnapshot) {
    this.upsertSnapshots([snapshot]);
  }

  upsertSnapshots(snapshots: DeviceConfigurationSnapshot[]) {
    this.publish({ snapshots });
  }

  removeSnapshot(deviceId: string) {
    this.publish({ removeSnapshotIds: [deviceId] });
  }

  upsertSettings(settings: PansManagerSettings) {
    this.publish({ settings });
  }

  removeSettings() {
    this.publish({ clearSettings: true });
  }

  private publish(input: {
    networks?: ManagedNetwork[];
    devices?: ManagedDevice[];
    snapshots?: DeviceConfigurationSnapshot[];
    removeSnapshotIds?: string[];
    settings?: PansManagerSettings;
    clearSettings?: boolean;
  }) {
    const networks = input.networks ?? this.networks;
    const devices = input.devices ?? this.devices;
    let snapshots = this.snapshots;
    if (input.snapshots?.length || input.removeSnapshotIds?.length) {
      const next = { ...snapshots };
      for (const snapshot of input.snapshots ?? []) {
        next[snapshot.deviceId] = reconcileOne(
          next[snapshot.deviceId],
          snapshot,
        );
      }
      for (const id of input.removeSnapshotIds ?? []) delete next[id];
      snapshots = this.reconcileSnapshots(next);
    }
    const settings = input.clearSettings
      ? undefined
      : input.settings
        ? reconcileOne(this.settings, input.settings)
        : this.settings;
    if (
      networks === this.networks &&
      devices === this.devices &&
      snapshots === this.snapshots &&
      settings === this.settings
    )
      return;
    this.networks = networks;
    this.devices = devices;
    this.snapshots = snapshots;
    this.settings = settings;
    for (const listener of this.listeners) listener();
  }

  private reconcileSnapshots(
    incoming: Record<string, DeviceConfigurationSnapshot>,
  ) {
    const next = Object.fromEntries(
      Object.entries(incoming).map(([id, snapshot]) => {
        const old = this.snapshots[id];
        return [id, old && shallowEqual(old, snapshot) ? old : snapshot];
      }),
    );
    const keys = Object.keys(next);
    return keys.length === Object.keys(this.snapshots).length &&
      keys.every((id) => next[id] === this.snapshots[id])
      ? this.snapshots
      : next;
  }
}

function mergeById<T extends { id: string }>(previous: T[], incoming: T[]) {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...previous.filter((item) => !incomingIds.has(item.id)), ...incoming];
}

export const PersistedStoreContext =
  React.createContext<PansPersistedStore | null>(null);
function useStore() {
  const store = React.useContext(PersistedStoreContext);
  if (!store)
    throw new Error("Persisted hooks must be used inside PansManagerProvider.");
  return store;
}
function useSelected<T>(selector: (store: PansPersistedStore) => T) {
  const store = useStore();
  const getSnapshot = () => selector(store);
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
export const useManagedNetworks = () =>
  useSelected((store) => store.getNetworks());
export const useManagedDevices = () =>
  useSelected((store) => store.getDevices());
export const useManagerSettings = () =>
  useSelected((store) => store.getSettings());
export const useManagedDeviceSnapshots = () =>
  useSelected((store) => store.getSnapshots());
export const useManagedDeviceSnapshot = (id: string) =>
  useSelected((store) => store.getDeviceSnapshot(id));
export const useManagedNetwork = (id: string) =>
  useSelected((store) => store.getNetworkSnapshot(id));
export const useManagedDevice = (id: string) =>
  useSelected((store) => store.getDevice(id));
