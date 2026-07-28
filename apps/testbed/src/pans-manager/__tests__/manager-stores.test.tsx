import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type {
  ManagedNetwork,
  DiscoveredDeviceSnapshot,
  DisplayDevice,
} from "@eight2five/mobile/pans-manager";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "@eight2five/mobile/pans-manager";

import {
  DiscoveryStoreContext,
  PansDiscoveryStore,
  useDiscoveredDevice,
} from "../stores/discovery-store";
import {
  networkDeviceRowPropsEqual,
  type NetworkDeviceRowProps,
} from "../components/network-device-row";
import { PansPersistedStore } from "../stores/persisted-store";

jest.mock("expo-pans-ble-api", () => ({}));

const device = (id: string, rssi: number): DiscoveredDeviceSnapshot => ({
  transportDeviceId: id,
  rssi,
  lastSeenAt: 1,
  compatibility: "compatible",
});

describe("PansDiscoveryStore", () => {
  it("retains unchanged device identities and does not publish identical snapshots", () => {
    const store = new PansDiscoveryStore();
    const listener = jest.fn();
    store.subscribe(listener);
    store.setList([device("one", -50), device("two", -60)]);
    const first = store.getList();

    store.setList([device("one", -50), device("two", -61)]);
    expect(store.getList()[0]).toBe(first[0]);
    expect(store.getList()[1]).not.toBe(first[1]);
    expect(listener).toHaveBeenCalledTimes(2);

    store.setList([device("one", -50), device("two", -61)]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("isolates a per-device subscriber from other device advertisements", async () => {
    const store = new PansDiscoveryStore();
    store.setList([device("one", -50), device("two", -60)]);
    let renders = 0;
    function DeviceProbe() {
      useDiscoveredDevice("one");
      renders += 1;
      return null;
    }
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <DiscoveryStoreContext.Provider value={store}>
          <DeviceProbe />
        </DiscoveryStoreContext.Provider>,
      );
    });
    const initialRenders = renders;
    await act(async () => {
      store.setList([device("one", -50), device("two", -61)]);
    });
    expect(renders).toBe(initialRenders);
    await act(async () => tree.unmount());
  });
});

describe("PansPersistedStore", () => {
  it("upserts a network batch atomically while preserving unchanged identities", () => {
    const store = new PansPersistedStore();
    const listener = jest.fn();
    const networks = Array.from(
      { length: 5 },
      (_, index): ManagedNetwork => ({
        id: `network-${index}`,
        name: `Network ${index}`,
        panId: index,
        settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    store.replace({
      networks,
      devices: [],
      snapshots: {},
      settings: undefined,
    });
    store.subscribe(listener);

    store.upsertNetworks(
      networks.map((network, index) =>
        index === 2
          ? { ...network, name: "Changed", updatedAt: 2 }
          : { ...network },
      ),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getNetworks()[0]).toBe(networks[0]);
    expect(store.getNetworks()[2]).not.toBe(networks[2]);
  });
});

describe("network device row isolation", () => {
  it("does not rerender unchanged row B when only device A RSSI changes", async () => {
    const renderA = jest.fn();
    const renderB = jest.fn();
    function RowProbe(props: NetworkDeviceRowProps) {
      (props.device.id === "A" ? renderA : renderB)();
      return null;
    }
    const Probe = React.memo(RowProbe, networkDeviceRowPropsEqual);
    const callbacks = {
      onExpandedChange: jest.fn(),
      onOpenSettings: jest.fn().mockResolvedValue(undefined),
    };
    const row = (
      value: DisplayDevice,
      key: string,
    ): React.ReactElement<NetworkDeviceRowProps> => (
      <Probe key={key} device={value} expanded={false} {...callbacks} />
    );
    const display = (id: "A" | "B", rssi: number): DisplayDevice =>
      ({
        id,
        key: `discovery:${id}`,
        displayName: id,
        canonicalIdentifier: id,
        status: "unassigned",
        available: true,
        discovery: device(id, rssi),
      }) as DisplayDevice;
    const a = display("A", -50);
    const b = display("B", -60);
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <>
          {row(a, "A")}
          {row(b, "B")}
        </>,
      );
    });
    expect(renderA).toHaveBeenCalledTimes(1);
    expect(renderB).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.update(
        <>
          {row(display("A", -70), "A")}
          {row(b, "B")}
        </>,
      );
    });
    expect(renderA).toHaveBeenCalledTimes(2);
    expect(renderB).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
});
