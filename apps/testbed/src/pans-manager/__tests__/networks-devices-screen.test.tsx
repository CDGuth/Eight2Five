import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { State } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";
import {
  type AssignDeviceToNetworkProfileResult,
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  ManagerError,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  type ManagedNetwork,
  type PansInspectionResult,
  type PansManagerRepository,
} from "@eight2five/mobile/pans-manager";
import { Spinner } from "@eight2five/ui/components/spinner";

import {
  PansManagerProvider,
  type PansManagerRuntime,
} from "../manager-context";
import {
  NETWORK_DROP_AUTO_EXPAND_MS,
  NetworksDevicesScreen,
} from "../screens/networks-devices-screen";
import {
  NETWORK_DEVICE_DRAG_LONG_PRESS_MS,
  NetworkDeviceDrag,
} from "../components/network-device-drag";
import { NetworkDeviceSection } from "../components/network-device-section";
import { DeviceSettingsModal } from "../device-settings-modal";
import { NetworkEditModal } from "../network-edit-modal";
import {
  TestbedToolbarActionProvider,
  TestbedToolbarActionSlot,
} from "../../components/testbed-toolbar";

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets/lib/module/mock"),
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock("react-native-reanimated", () =>
  jest.requireActual("react-native-reanimated/mock"),
);

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const MockReact = jest.requireActual<typeof import("react")>("react");
    return MockReact.useEffect(callback, [callback]);
  },
}));

describe("NetworksDevicesScreen", () => {
  test("shows toolbar loading, auto-starts, and supports immediate stop/start", async () => {
    const deferred = createDeferred<PansManagerRuntime>();
    const runtime = createRuntime().runtime;
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        toolbarHarness(
          <PansManagerProvider createRuntime={() => deferred.promise}>
            <NetworksDevicesScreen />
          </PansManagerProvider>,
        ),
      );
    });

    expect(tree.root.findAllByType(Spinner)).not.toHaveLength(0);
    expect(findText(tree, "Scan")).toBeUndefined();
    expect(findText(tree, "Stop")).toBeUndefined();
    expect(runtime.discovery.start).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(runtime);
      await flushPromises();
    });

    expect(findText(tree, "Scan")).toBeUndefined();
    expect(runtime.discovery.start).toHaveBeenCalledTimes(1);
    expect(findText(tree, "Scanning…")).toBeTruthy();

    await act(async () => {
      pressTestId(tree, "scan-control");
      await flushPromises();
    });
    expect(runtime.discovery.stop).toHaveBeenCalledTimes(1);
    expect(findText(tree, "Scan")).toBeTruthy();

    await act(async () => {
      pressTestId(tree, "scan-control");
      await flushPromises();
    });
    expect(runtime.discovery.start).toHaveBeenCalledTimes(2);
    expect(findText(tree, "Scan")).toBeUndefined();
    await act(async () => tree.unmount());
  });

  test("renders a compact initialization error and retries", async () => {
    const runtime = createRuntime().runtime;
    const createRuntimeFactory = jest
      .fn()
      .mockRejectedValueOnce(new Error("Native manager unavailable"))
      .mockResolvedValueOnce(runtime);
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        toolbarHarness(
          <PansManagerProvider createRuntime={createRuntimeFactory}>
            <NetworksDevicesScreen />
          </PansManagerProvider>,
        ),
      );
      await flushPromises();
    });

    expect(
      tree.root.findByProps({ testID: "initialization-error" }),
    ).toBeTruthy();
    expect(findText(tree, "Native manager unavailable")).toBeTruthy();
    expect(findText(tree, "Retry")).toBeTruthy();
    expect(findText(tree, "Scan")).toBeUndefined();

    await act(async () => {
      pressTestId(tree, "retry-initialization");
      await flushPromises();
    });
    expect(createRuntimeFactory).toHaveBeenCalledTimes(2);
    expect(runtime.discovery.start).toHaveBeenCalledTimes(1);
    expect(findText(tree, "Scan")).toBeUndefined();
    await act(async () => tree.unmount());
  });

  test("keeps controlled expansion through discovery rerenders and refreshes only explicitly", async () => {
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const harness = createRuntime({ networks: [network], devices: [device] });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        toolbarHarness(
          <PansManagerProvider createRuntime={async () => harness.runtime}>
            <NetworksDevicesScreen />
          </PansManagerProvider>,
        ),
      );
      await flushPromises();
    });

    expect(expansionState(tree, "section-toggle-unassigned")).toBe(true);
    expect(findText(tree, "Unassigned Devices")).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: "network-hierarchy-divider" }),
    ).toBeTruthy();
    expect(tree.root.findByProps({ testID: "networks-heading" })).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: `network-card-${network.id}` }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: `device-offline-${device.id}` }),
    ).toBeTruthy();
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      false,
    );
    expect(
      tree.root.findAllByProps({
        testID: `device-settings-device:${device.id}`,
      }),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({ testID: `refresh-device-${device.id}` }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({ testID: "edit-network-unassigned" }),
    ).toHaveLength(0);

    await act(async () => {
      pressTestId(tree, `edit-network-${network.id}`);
    });
    expect(
      tree.root.findByProps({ testID: "network-edit-modal-root" }),
    ).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      false,
    );

    await act(async () => {
      pressTestId(tree, `section-toggle-network:${network.id}`);
      pressTestId(tree, `device-toggle-device:${device.id}`);
    });
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      true,
    );
    expect(expansionState(tree, `device-toggle-device:${device.id}`)).toBe(
      true,
    );
    expect(
      tree.root.findAllByProps({ testID: "network-device-child-rail" }).length,
    ).toBeGreaterThan(0);
    expect(harness.inspectAndCache).not.toHaveBeenCalled();

    await act(async () => {
      pressTestId(tree, `device-settings-device:${device.id}`);
      await flushPromises();
      await flushPromises();
    });
    expect(
      tree.root.findByProps({ testID: "device-settings-modal-root" }),
    ).toBeTruthy();
    expect(harness.inspectAndCache).not.toHaveBeenCalled();

    await act(async () => {
      harness.emitDiscoveries([discovery(device.transportDeviceId)]);
      await flushPromises();
    });
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      true,
    );
    expect(expansionState(tree, `device-toggle-device:${device.id}`)).toBe(
      true,
    );
    expect(harness.inspectAndCache).toHaveBeenCalledTimes(1);
    expect(harness.inspectAndCache).toHaveBeenCalledWith(device.id);

    await act(async () => {
      pressTestId(tree, `refresh-device-${device.id}`);
      await flushPromises();
    });
    expect(harness.inspectAndCache).toHaveBeenCalledWith(device.id);
    expect(harness.inspectAndCache).toHaveBeenCalledTimes(2);
    expect(findTextPrefix(tree, "Refreshed ")).toBeTruthy();
    await act(async () => tree.unmount());
  });

  test("persists a discovery-only row only when Settings is pressed", async () => {
    const discovered = discovery("transport-new");
    const harness = createRuntime({ discoveries: [discovered] });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        toolbarHarness(
          <PansManagerProvider createRuntime={async () => harness.runtime}>
            <NetworksDevicesScreen />
          </PansManagerProvider>,
        ),
      );
      await flushPromises();
    });

    expect(harness.repository.saveDevice).not.toHaveBeenCalled();
    expect(harness.inspectAndCache).not.toHaveBeenCalled();
    expect(
      tree.root.findAllByProps({ testID: "refresh-device-transport-new" }),
    ).toHaveLength(0);

    await act(async () => {
      pressTestId(tree, "device-settings-discovery:transport-new");
      await flushPromises();
    });

    expect(harness.repository.saveDevice).toHaveBeenCalledTimes(1);
    const persisted = harness.repository.saveDevice.mock
      .calls[0][0] as ManagedDevice;
    expect(persisted.transportDeviceId).toBe("transport-new");
    expect(
      tree.root.findByProps({ testID: "device-settings-modal-root" }),
    ).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(harness.inspectAndCache).toHaveBeenCalledWith(persisted.id);
    await act(async () => tree.unmount());
  });

  test("shows duplicate hardware PAN profile conflicts in the device row", async () => {
    const alpha = savedNetwork();
    const beta = { ...savedNetwork(), id: "network-2", name: "Field B" };
    const device = savedDevice(alpha.id);
    const harness = createRuntime({
      networks: [alpha, beta],
      devices: [device],
      discoveries: [discovery(device.transportDeviceId)],
    });
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        toolbarHarness(
          <PansManagerProvider createRuntime={async () => harness.runtime}>
            <NetworksDevicesScreen />
          </PansManagerProvider>,
        ),
      );
      await flushPromises();
    });
    await act(async () => {
      pressTestId(tree, `device-toggle-device:${device.id}`);
    });

    expect(
      tree.root.findByProps({
        testID: `device-profile-conflict-${device.id}`,
      }),
    ).toBeTruthy();

    await act(async () => tree.unmount());
  });

  test("marks a legacy PAN 0 profile for repair and excludes it as a drop target", async () => {
    const legacy = { ...savedNetwork(), panId: 0 };
    const harness = createRuntime({ networks: [legacy] });
    const tree = await renderNetworkScreen(harness);

    expect(
      findTextContaining(
        tree,
        "PAN 0 is the PANS default for unassigned devices",
      ),
    ).toBeTruthy();
    expect(
      tree.root.findAllByProps({
        testID: `network-drop-zone-${legacy.id}`,
      }),
    ).toHaveLength(0);
    await act(async () => tree.unmount());
  });

  test("provides swipe delete confirmations and closes the previously open row", async () => {
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const harness = createRuntime({ networks: [network], devices: [device] });
    const tree = await renderNetworkScreen(harness);
    const deviceSwipe = swipeHost(tree, `device:${device.id}`);
    const networkSwipe = swipeHost(tree, `network:${network.id}`);

    act(() => deviceSwipe.props.onSwipeableWillOpen());
    act(() => networkSwipe.props.onSwipeableWillOpen());
    expect(deviceSwipe.props.swipeableMethods.close).toHaveBeenCalledTimes(1);

    await act(async () => {
      await pressTestId(tree, `swipe-delete-action-network:${network.id}`);
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });
    expect(
      tree.root.findByProps({ testID: "network-edit-modal-root" }),
    ).toBeTruthy();
    expect(tree.root.findByType(NetworkEditModal).props).toMatchObject({
      network: expect.objectContaining({ id: network.id }),
      isOpen: true,
      destructiveActionRequested: true,
    });
    await act(async () => tree.unmount());
  });

  test("opens device deletion confirmation from the swipe action", async () => {
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const harness = createRuntime({ networks: [network], devices: [device] });
    const tree = await renderNetworkScreen(harness);

    await act(async () => {
      await pressTestId(tree, `swipe-delete-action-device:${device.id}`);
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(
      tree.root.findByProps({ testID: "device-settings-modal-root" }),
    ).toBeTruthy();
    expect(tree.root.findByType(DeviceSettingsModal).props).toMatchObject({
      device: expect.objectContaining({ id: device.id }),
      isOpen: true,
      destructiveActionRequested: true,
      available: false,
    });
    await act(async () => tree.unmount());
  });

  test("shows the idle and scanning empty states plus compact discovery errors", async () => {
    const harness = createRuntime();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        toolbarHarness(
          <PansManagerProvider createRuntime={async () => harness.runtime}>
            <NetworksDevicesScreen />
          </PansManagerProvider>,
        ),
      );
      await flushPromises();
    });
    expect(findText(tree, "Scanning…")).toBeTruthy();

    await act(async () => {
      pressTestId(tree, "scan-control");
      await flushPromises();
    });
    expect(findText(tree, "No devices")).toBeTruthy();

    await act(async () => {
      pressTestId(tree, "scan-control");
      await flushPromises();
    });
    expect(findText(tree, "Scanning…")).toBeTruthy();

    await act(async () => {
      harness.emitError(new ManagerError("UNKNOWN", "Bluetooth scan failed"));
    });
    expect(tree.root.findByProps({ testID: "discovery-error" })).toBeTruthy();
    expect(findText(tree, "Bluetooth scan failed")).toBeTruthy();
    await act(async () => tree.unmount());
  });

  test("only wraps available non-malformed Unassigned rows in a long-press pan gesture", async () => {
    const network = savedNetwork();
    const assigned = savedDevice(network.id);
    const harness = createRuntime({
      networks: [network],
      devices: [assigned],
      discoveries: [
        discovery(assigned.transportDeviceId),
        discovery("eligible"),
        discovery("malformed", { compatibility: "malformed" }),
        discovery("stale", { stale: true }),
      ],
    });
    const tree = await renderNetworkScreen(harness);

    expect(
      tree.root
        .findAllByType(NetworkDeviceDrag)
        .map((node) => node.props.deviceKey),
    ).toEqual(["discovery:eligible"]);
    const gesture = getByGestureTestId(
      "network-device-drag-discovery:eligible",
    );
    expect(gesture.config).toMatchObject({
      activateAfterLongPress: NETWORK_DEVICE_DRAG_LONG_PRESS_MS,
      minPointers: 1,
      maxPointers: 1,
      shouldCancelWhenOutside: false,
    });
    expect(() =>
      getByGestureTestId(`network-device-drag-device:${assigned.id}`),
    ).toThrow();
    expect(() =>
      getByGestureTestId("network-device-drag-discovery:malformed"),
    ).toThrow();

    act(() => {
      fireGestureHandler(gesture, [
        { state: State.BEGAN, absoluteX: 10, absoluteY: 10 },
        { state: State.ACTIVE, absoluteX: 20, absoluteY: 20 },
        { state: State.CANCELLED, absoluteX: 20, absoluteY: 20 },
      ]);
    });
    await act(async () => tree.unmount());
  });

  test("freezes displayed rows during a drag and ignores incoming scan ordering", async () => {
    const harness = createRuntime({ discoveries: [discovery("transport-z")] });
    const tree = await renderNetworkScreen(harness);
    const callbacks = dragCallbacksFor(tree, "discovery:transport-z");

    act(() =>
      callbacks.onDragStart(dragEvent("discovery:transport-z", 20, 40)),
    );
    await act(async () => {
      harness.emitDiscoveries([
        discovery("transport-a", { name: "Alpha", rssi: -40 }),
        discovery("transport-z", { rssi: -30 }),
      ]);
      await flushPromises();
    });

    expect(
      tree.root.findAllByProps({
        testID: "device-settings-discovery:transport-a",
      }),
    ).toHaveLength(0);
    expect(
      accessibilityLabel(tree, "device-toggle-discovery:transport-z"),
    ).toContain("RSSI -75 dBm");

    act(() =>
      callbacks.onDragEnd({
        ...dragEvent("discovery:transport-z", 20, 40),
        cancelled: true,
      }),
    );
    expect(
      tree.root.findAllByProps({
        testID: "device-settings-discovery:transport-a",
      }),
    ).not.toHaveLength(0);
    expect(
      accessibilityLabel(tree, "device-toggle-discovery:transport-z"),
    ).toContain("RSSI -30 dBm");
    await act(async () => tree.unmount());
  });

  test("auto-expands a hovered saved-network header after the dwell delay and cancels on leave", async () => {
    jest.useFakeTimers();
    const network = savedNetwork();
    const harness = createRuntime({
      networks: [network],
      discoveries: [discovery("transport-new")],
    });
    const tree = await renderNetworkScreen(harness, {
      [network.id]: [0, 100, 300, 60],
    });
    const callbacks = dragCallbacksFor(tree, "discovery:transport-new");
    act(() => {
      callbacks.onDragStart(dragEvent("discovery:transport-new", 20, 40));
      callbacks.onDragMove(dragEvent("discovery:transport-new", 40, 120));
      jest.advanceTimersByTime(NETWORK_DROP_AUTO_EXPAND_MS - 1);
    });
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      false,
    );

    act(() => {
      callbacks.onDragMove(dragEvent("discovery:transport-new", 400, 400));
      jest.advanceTimersByTime(NETWORK_DROP_AUTO_EXPAND_MS);
    });
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      false,
    );

    act(() => {
      callbacks.onDragMove(dragEvent("discovery:transport-new", 40, 120));
      jest.advanceTimersByTime(NETWORK_DROP_AUTO_EXPAND_MS);
    });
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      true,
    );
    act(() =>
      callbacks.onDragEnd({
        ...dragEvent("discovery:transport-new", 400, 400),
        cancelled: true,
      }),
    );
    await act(async () => tree.unmount());
  });

  test("persists a discovery before assigning it through the profile operation", async () => {
    const network = savedNetwork();
    const harness = createRuntime({
      networks: [network],
      discoveries: [discovery("transport-new")],
    });
    const tree = await renderNetworkScreen(harness, {
      [network.id]: [0, 100, 300, 60],
    });
    const callbacks = dragCallbacksFor(tree, "discovery:transport-new");
    act(() =>
      callbacks.onDragStart(dragEvent("discovery:transport-new", 20, 40)),
    );
    act(() =>
      callbacks.onDragEnd(dragEvent("discovery:transport-new", 40, 120)),
    );
    expect(findText(tree, "Persisting…")).toBeTruthy();

    await act(async () => await flushPromises());
    expect(harness.repository.saveDevice).toHaveBeenCalledTimes(1);
    expect(harness.assignDeviceToNetworkProfile).toHaveBeenCalledTimes(1);
    expect(
      harness.repository.saveDevice.mock.invocationCallOrder[0],
    ).toBeLessThan(
      harness.assignDeviceToNetworkProfile.mock.invocationCallOrder[0],
    );
    const persisted = harness.repository.saveDevice.mock
      .calls[0][0] as ManagedDevice;
    expect(harness.assignDeviceToNetworkProfile).toHaveBeenCalledWith({
      deviceId: persisted.id,
      targetNetworkId: network.id,
    });
    expect(harness.repository.associateDevice).not.toHaveBeenCalled();
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      true,
    );
    expect(
      tree.root.findAllByProps({
        testID: `device-settings-device:${persisted.id}`,
      }),
    ).not.toHaveLength(0);
    expect(findText(tree, "Persisting…")).toBeUndefined();
    await act(async () => tree.unmount());
  });

  test("keeps a failed assignment unassociated, warns about association-stage hardware state, and retries without persisting twice", async () => {
    const network = savedNetwork();
    const harness = createRuntime({
      networks: [network],
      discoveries: [discovery("transport-new")],
      assignmentResults: [
        {
          outcome: "failed",
          stage: "association",
          error: { code: "STORAGE_FAILURE", message: "Association failed." },
        },
        { outcome: "assigned", stage: "complete" },
      ],
    });
    const tree = await renderNetworkScreen(harness, {
      [network.id]: [0, 100, 300, 60],
    });
    const callbacks = dragCallbacksFor(tree, "discovery:transport-new");
    act(() =>
      callbacks.onDragStart(dragEvent("discovery:transport-new", 20, 40)),
    );
    act(() =>
      callbacks.onDragEnd(dragEvent("discovery:transport-new", 40, 120)),
    );
    await act(async () => await flushPromises());

    const persisted = harness.repository.saveDevice.mock
      .calls[0][0] as ManagedDevice;
    expect(
      harness.getDevices().find((device) => device.id === persisted.id)
        ?.networkId,
    ).toBeUndefined();
    expect(harness.repository.associateDevice).not.toHaveBeenCalled();
    expect(
      findTextContaining(tree, "Hardware PAN may have changed"),
    ).toBeTruthy();
    expect(findText(tree, "Retry")).toBeTruthy();

    await act(async () => {
      pressTestId(tree, "retry-drop-assignment");
      await flushPromises();
    });
    expect(harness.repository.saveDevice).toHaveBeenCalledTimes(1);
    expect(harness.assignDeviceToNetworkProfile).toHaveBeenCalledTimes(2);
    expect(
      harness.getDevices().find((device) => device.id === persisted.id)
        ?.networkId,
    ).toBe(network.id);
    expect(
      findTextContaining(tree, "Hardware PAN may have changed"),
    ).toBeUndefined();
    await act(async () => tree.unmount());
  });
});

function createRuntime(
  options: {
    networks?: ManagedNetwork[];
    devices?: ManagedDevice[];
    discoveries?: DiscoveredDeviceSnapshot[];
    assignmentResults?: Pick<
      AssignDeviceToNetworkProfileResult,
      "outcome" | "stage" | "error"
    >[];
  } = {},
) {
  let networks = [...(options.networks ?? [])];
  let devices = [...(options.devices ?? [])];
  const assignmentResults = [...(options.assignmentResults ?? [])];
  let discoveryListener: (items: DiscoveredDeviceSnapshot[]) => void = () => {};
  let errorListener: (error: ManagerError) => void = () => {};
  const repository = {
    listNetworks: jest.fn(async () => [...networks]),
    deleteNetwork: jest.fn(async (networkId: string) => {
      networks = networks.filter((network) => network.id !== networkId);
      devices = devices.map((device) => {
        if (device.networkId !== networkId) return device;
        const updated = { ...device };
        delete updated.networkId;
        return updated;
      });
    }),
    listDevices: jest.fn(async () => [...devices]),
    getSettings: jest.fn().mockResolvedValue(undefined),
    getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
    saveDevice: jest.fn(async (device: ManagedDevice) => {
      devices = [...devices.filter((item) => item.id !== device.id), device];
    }),
    deleteDevice: jest.fn(async (deviceId: string) => {
      devices = devices.filter((device) => device.id !== deviceId);
    }),
    associateDevice: jest.fn(
      async (
        association: Parameters<PansManagerRepository["associateDevice"]>[0],
      ) => {
        devices = devices.map((device) =>
          device.id === association.deviceId
            ? {
                ...device,
                networkId: association.networkId,
                updatedAt: association.associatedAt,
              }
            : device,
        );
      },
    ),
    dissociateDevice: jest.fn(
      async (networkId: string, deviceId: string, dissociatedAt: number) => {
        devices = devices.map((device) => {
          if (device.id !== deviceId || device.networkId !== networkId)
            return device;
          const updated = { ...device, updatedAt: dissociatedAt };
          delete updated.networkId;
          return updated;
        });
      },
    ),
  } as unknown as jest.Mocked<PansManagerRepository>;
  const inspection = inspectionResult();
  const inspectAndCache = jest.fn().mockResolvedValue(inspection);
  const unassignDeviceHardware = jest.fn().mockResolvedValue({
    deviceId: "device-1",
    transportDeviceId: "transport-1",
    outcome: "verified",
    inspected: inspection,
    writes: [
      { field: "uwbMode", status: "verified" },
      { field: "panId", status: "verified" },
    ],
    warnings: [],
  });
  const assignDeviceToNetworkProfile = jest.fn(
    async (input: { deviceId: string; targetNetworkId: string }) => {
      const configured = assignmentResults.shift() ?? {
        outcome: "assigned" as const,
        stage: "complete" as const,
      };
      if (configured.outcome === "assigned") {
        const targetPanId = networks.find(
          (network) => network.id === input.targetNetworkId,
        )?.panId;
        devices = devices.map((device) =>
          device.id === input.deviceId
            ? {
                ...device,
                networkId: input.targetNetworkId,
                ...(targetPanId === undefined
                  ? {}
                  : {
                      lastKnownConfig: {
                        ...(device.lastKnownConfig ?? {
                          role: "anchor" as const,
                          uwbMode: "active" as const,
                          ledEnabled: true,
                          firmwareUpdateEnabled: false,
                          initiatorEnabled: false,
                        }),
                        panId: targetPanId,
                      },
                    }),
              }
            : device,
        );
      }
      return {
        deviceId: input.deviceId,
        targetNetworkId: input.targetNetworkId,
        ...configured,
      } as AssignDeviceToNetworkProfileResult;
    },
  );
  const runtime: PansManagerRuntime = {
    repository,
    discovery: {
      isScanning: false,
      state: "idle",
      desiredScanning: false,
      getPermissionStatus: jest.fn(() => ({ bluetooth: "granted" })),
      requestPermissions: jest.fn().mockResolvedValue({ bluetooth: "granted" }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      clear: jest.fn(),
      subscribe: jest.fn((listener) => {
        discoveryListener = listener;
        listener(options.discoveries ?? []);
        return { remove: jest.fn() };
      }),
      subscribeErrors: jest.fn((listener) => {
        errorListener = listener;
        return { remove: jest.fn() };
      }),
      subscribeDiagnostics: jest.fn(() => ({ remove: jest.fn() })),
      subscribeState: jest.fn((listener) => {
        listener("idle");
        return { remove: jest.fn() };
      }),
      getDiagnostics: jest.fn(() => scanDiagnostics()),
    },
    sessions: {
      closeDevice: jest.fn().mockResolvedValue(undefined),
      closeAll: jest.fn().mockResolvedValue(undefined),
    },
    configuration: {
      inspect: jest.fn(),
      inspectAndCache,
      configureDevice: jest.fn(),
      applyConfigurationDiff: jest.fn(),
      assignPanId: jest.fn(),
      unassignDeviceHardware,
    },
    commissioning: {
      assignDeviceToNetworkProfile,
      migrateNetworkProfilePan: jest.fn(),
    },
    diagnostics: { inspect: jest.fn() },
    batch: {} as PansManagerRuntime["batch"],
    logs: {
      flush: jest.fn().mockResolvedValue(undefined),
    } as unknown as PansManagerRuntime["logs"],
    topology: {} as PansManagerRuntime["topology"],
    createPositionStream: jest.fn(),
    networkExport: {
      exportNetworkJson: jest.fn(),
      exportNetworkCsv: jest.fn(),
      validateImport: jest.fn(),
      importNetwork: jest.fn(),
    },
    closeStorage: jest.fn().mockResolvedValue(undefined),
  };
  return {
    runtime,
    repository,
    inspectAndCache,
    unassignDeviceHardware,
    assignDeviceToNetworkProfile,
    getDevices: () => [...devices],
    emitDiscoveries(items: DiscoveredDeviceSnapshot[]) {
      discoveryListener(items);
    },
    emitError(error: ManagerError) {
      errorListener(error);
    },
  };
}

function scanDiagnostics() {
  return {
    state: "idle" as const,
    buildId: "test-build",
    scanSessionId: 0,
    rawResultCount: 0,
    pansResultCount: 0,
    parsedServiceDataHitCount: 0,
    rawAdvertisementHitCount: 0,
    rejectedResultCount: 0,
  };
}

function savedNetwork(): ManagedNetwork {
  return {
    id: "network-1",
    name: "Field A",
    panId: 7,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
    createdAt: 1,
    updatedAt: 1,
  };
}

function savedDevice(networkId: string): ManagedDevice {
  return {
    id: "device-1",
    networkId,
    transportDeviceId: "transport-1",
    nickname: "Front hash",
    label: "hardware-only",
    role: "anchor",
    lastKnownConfig: {
      role: "anchor",
      panId: 7,
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: true,
      position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

function discovery(
  transportDeviceId: string,
  overrides: Partial<DiscoveredDeviceSnapshot> = {},
): DiscoveredDeviceSnapshot {
  return {
    transportDeviceId,
    name: "hardware-advertisement",
    rssi: -75,
    lastSeenAt: 10,
    compatibility: "compatible",
    ...overrides,
  };
}

function inspectionResult(): PansInspectionResult {
  return {
    deviceId: "device-1",
    transportDeviceId: "transport-1",
    inspectedAt: 20,
    panId: 7,
    operationMode: {
      role: "anchor",
      uwbMode: "active",
      selectedFirmware: 1,
      accelerometerEnabled: false,
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: true,
      lowPowerModeEnabled: false,
      locationEngineEnabled: false,
      raw: [0, 0],
    },
    warnings: [],
  };
}

async function renderNetworkScreen(
  harness: ReturnType<typeof createRuntime>,
  zones: Record<string, [number, number, number, number]> = {},
) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <PansManagerProvider createRuntime={async () => harness.runtime}>
        <NetworksDevicesScreen />
      </PansManagerProvider>,
      {
        createNodeMock: (element) => {
          const testID = (element.props as { testID?: string }).testID;
          const networkId = testID?.startsWith("network-drop-zone-")
            ? testID.slice("network-drop-zone-".length)
            : undefined;
          const rectangle = networkId ? zones[networkId] : undefined;
          if (!rectangle) return null;
          return {
            measureInWindow: (
              callback: (
                x: number,
                y: number,
                width: number,
                height: number,
              ) => void,
            ) => callback(...rectangle),
          };
        },
      },
    );
    await flushPromises();
  });
  act(() => {
    for (const [networkId, [x, y, width, height]] of Object.entries(zones)) {
      const section = tree.root
        .findAllByType(NetworkDeviceSection)
        .find((node) => node.props.section.network?.id === networkId);
      section?.props.onDropZoneChange?.({
        networkId,
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
      });
    }
  });
  return tree;
}

function dragCallbacksFor(
  tree: TestRenderer.ReactTestRenderer,
  deviceKey: string,
) {
  const drag = tree.root
    .findAllByType(NetworkDeviceDrag)
    .find((node) => node.props.deviceKey === deviceKey);
  if (!drag) throw new Error(`No drag wrapper found for ${deviceKey}`);
  return {
    onDragStart: drag.props.onDragStart,
    onDragMove: drag.props.onDragMove,
    onDragEnd: drag.props.onDragEnd,
  };
}

function dragEvent(deviceKey: string, x: number, y: number) {
  return { deviceKey, x, y };
}

function pressTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = tree.root
    .findAllByProps({ testID })
    .find((node) => typeof node.props.onPress === "function");
  if (!target) throw new Error(`No pressable found for ${testID}`);
  return target.props.onPress();
}

function swipeHost(tree: TestRenderer.ReactTestRenderer, rowKey: string) {
  const swipe = tree.root
    .findAllByProps({ testID: `swipe-delete-${rowKey}` })
    .find((node) => node.props.swipeableMethods);
  if (!swipe) throw new Error(`No swipeable host found for ${rowKey}`);
  return swipe;
}

function toolbarHarness(children: React.ReactNode) {
  return (
    <TestbedToolbarActionProvider>
      <TestbedToolbarActionSlot />
      {children}
    </TestbedToolbarActionProvider>
  );
}

function expansionState(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
): boolean | undefined {
  return tree.root
    .findAllByProps({ testID })
    .find((node) => node.props.accessibilityState?.expanded !== undefined)
    ?.props.accessibilityState.expanded;
}

function findText(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root
    .findAllByType("Text" as never)
    .find((node) => node.props.children === text);
}

function findTextPrefix(tree: TestRenderer.ReactTestRenderer, prefix: string) {
  return tree.root
    .findAllByType("Text" as never)
    .find(
      (node) =>
        typeof node.props.children === "string" &&
        node.props.children.startsWith(prefix),
    );
}

function findTextContaining(
  tree: TestRenderer.ReactTestRenderer,
  expected: string,
) {
  return tree.root
    .findAllByType("Text" as never)
    .find(
      (node) =>
        typeof node.props.children === "string" &&
        node.props.children.includes(expected),
    );
}

function accessibilityLabel(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
): string {
  const target = tree.root
    .findAllByProps({ testID })
    .find((node) => typeof node.props.accessibilityLabel === "string");
  if (!target) throw new Error(`No accessibility label found for ${testID}`);
  return target.props.accessibilityLabel;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
