import React from "react";
import type {
  DiscoveredDeviceSnapshot,
  PansDiscoveryState,
} from "@eight2five/mobile/pans-manager";

export interface DiscoveryStatusSnapshot {
  isScanning: boolean;
  state: PansDiscoveryState;
  desiredScanning: boolean;
  error?: string;
}

type Listener = () => void;

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

export class PansDiscoveryStore {
  private listeners = new Set<Listener>();
  private list: DiscoveredDeviceSnapshot[] = [];
  private devices = new Map<string, DiscoveredDeviceSnapshot>();
  private status: DiscoveryStatusSnapshot = {
    isScanning: false,
    state: "idle",
    desiredScanning: true,
  };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getList = () => this.list;
  getDevice = (id: string) => this.devices.get(id);
  getStatus = () => this.status;

  setList(incoming: DiscoveredDeviceSnapshot[]) {
    const devices = new Map<string, DiscoveredDeviceSnapshot>();
    const list = incoming.map((device) => {
      const previous = this.devices.get(device.transportDeviceId);
      const stable =
        previous && shallowEqual(previous, device) ? previous : device;
      devices.set(stable.transportDeviceId, stable);
      return stable;
    });
    if (
      list.length === this.list.length &&
      list.every((device, index) => device === this.list[index])
    )
      return;
    this.devices = devices;
    this.list = list;
    this.publish();
  }

  updateStatus(patch: Partial<DiscoveryStatusSnapshot>) {
    const next = { ...this.status, ...patch };
    if (shallowEqual(this.status, next)) return;
    this.status = next;
    this.publish();
  }

  clear() {
    this.setList([]);
  }

  private publish() {
    for (const listener of this.listeners) listener();
  }
}

export const DiscoveryStoreContext =
  React.createContext<PansDiscoveryStore | null>(null);

function useStore() {
  const store = React.useContext(DiscoveryStoreContext);
  if (!store)
    throw new Error("Discovery hooks must be used inside PansManagerProvider.");
  return store;
}

export function usePansDiscoveryList() {
  const store = useStore();
  return React.useSyncExternalStore(
    store.subscribe,
    store.getList,
    store.getList,
  );
}

export function useDiscoveredDevice(id: string) {
  const store = useStore();
  const getSnapshot = React.useCallback(() => store.getDevice(id), [id, store]);
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useDiscoveryStatus() {
  const store = useStore();
  return React.useSyncExternalStore(
    store.subscribe,
    store.getStatus,
    store.getStatus,
  );
}
