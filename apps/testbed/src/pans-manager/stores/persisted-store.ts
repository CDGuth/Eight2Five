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

  setSettings(settings: PansManagerSettings) {
    if (this.settings && shallowEqual(this.settings, settings)) return;
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
