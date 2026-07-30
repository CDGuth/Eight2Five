import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
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
  NetworksDevicesScreen,
  flattenNetworkDeviceRows,
} from "../screens/networks-devices-screen";
import { DeviceSettingsModal } from "../device-settings-modal";
import {
  TestbedToolbarActionProvider,
  TestbedToolbarActionSlot,
} from "../../components/testbed-toolbar";

jest.mock("expo-pans-ble-api", () => ({}));
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

  test("handles sustained discovery updates without a maximum-depth warning", async () => {
    const harness = createRuntime();
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    let tree!: TestRenderer.ReactTestRenderer;
    try {
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

      for (let update = 1; update <= 60; update += 1) {
        await act(async () => {
          harness.emitDiscoveries([
            {
              ...discovery("transport-live"),
              rssi: -60 - (update % 10),
              lastSeenAt: update,
            },
          ]);
          await flushPromises();
        });
      }

      expect(
        consoleError.mock.calls.some((call) =>
          call.some(
            (argument) =>
              typeof argument === "string" &&
              argument.includes("Maximum update depth exceeded"),
          ),
        ),
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
      if (tree) await act(async () => tree.unmount());
    }
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
      tree.root.findAllByProps({ testID: `device-offline-${device.id}` }),
    ).toHaveLength(0);
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      false,
    );
    expect(
      tree.root.findAllByProps({
        testID: `device-settings-device:${device.id}`,
      }),
    ).toHaveLength(0);
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

    await expandNetworkSection(tree, network.id);
    await act(async () => {
      pressTestId(tree, `device-toggle-device:${device.id}`);
    });
    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      true,
    );
    expect(expansionState(tree, `device-toggle-device:${device.id}`)).toBe(
      true,
    );
    expect(harness.inspectAndCache).not.toHaveBeenCalled();

    await act(async () => {
      pressTestId(tree, `device-settings-device:${device.id}`);
      await flushPromises();
      await flushPromises();
    });
    await flushDeferredAnimation();
    expect(
      tree.root.findByProps({ testID: "device-settings-modal-root" }),
    ).toBeTruthy();
    expect(harness.inspectAndCache).not.toHaveBeenCalled();

    const inspectionsBeforeDiscovery =
      harness.inspectAndCache.mock.calls.length;
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
    expect(harness.inspectAndCache.mock.calls.length).toBeGreaterThan(
      inspectionsBeforeDiscovery,
    );
    expect(harness.inspectAndCache).toHaveBeenCalledWith(device.id);

    const inspectionsBeforeRefresh = harness.inspectAndCache.mock.calls.length;
    await act(async () => {
      pressTestId(tree, `refresh-device-${device.id}`);
      await flushPromises();
    });
    expect(harness.inspectAndCache).toHaveBeenCalledWith(device.id);
    expect(harness.inspectAndCache).toHaveBeenCalledTimes(
      inspectionsBeforeRefresh + 1,
    );
    expect(findTextPrefix(tree, "Refreshed ")).toBeTruthy();
    await act(async () => tree.unmount());
  });

  test("lazy-mounts network rows while expanded and unmounts them after collapse", async () => {
    jest.useFakeTimers();
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const harness = createRuntime({ networks: [network], devices: [device] });
    const tree = await renderNetworkScreen(harness);

    expect(expansionState(tree, `section-toggle-network:${network.id}`)).toBe(
      false,
    );
    expect(
      tree.root.findAllByProps({
        testID: `device-settings-device:${device.id}`,
      }),
    ).toHaveLength(0);

    await expandNetworkSection(tree, network.id);
    expect(
      tree.root.findAllByProps({
        testID: `device-settings-device:${device.id}`,
      }),
    ).not.toHaveLength(0);

    await act(async () => {
      pressTestId(tree, `section-toggle-network:${network.id}`);
    });
    expect(
      tree.root.findAllByProps({
        testID: `device-settings-device:${device.id}`,
      }),
    ).toHaveLength(0);
    await act(async () => tree.unmount());
    jest.useRealTimers();
  });

  test("keeps large unassigned populations in virtualized rows", async () => {
    const discoveries = Array.from({ length: 100 }, (_, index) =>
      discovery(`transport-${index}`),
    );
    const tree = await renderNetworkScreen(createRuntime({ discoveries }));
    const list = tree.root
      .findAllByProps({ testID: "network-device-sections" })
      .find((node) => Array.isArray(node.props.data));

    expect(list?.props.data).toHaveLength(102);
    const mounted = tree.root.findAll(
      (node) =>
        typeof node.props.testID === "string" &&
        node.props.testID.startsWith("device-settings-discovery:"),
    );
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length).toBeLessThan(discoveries.length);
    await act(async () => tree.unmount());
  });

  test("omits collapsed device models and virtualizes expanded network populations", async () => {
    const network = savedNetwork();
    const devices = Array.from({ length: 100 }, (_, index) =>
      savedDeviceForIndex(network.id, index),
    );
    const tree = await renderNetworkScreen(
      createRuntime({ networks: [network], devices }),
    );
    const list = tree.root
      .findAllByProps({ testID: "network-device-sections" })
      .find((node) => Array.isArray(node.props.data));

    expect(
      list?.props.data.filter((row: { kind: string }) => row.kind === "device"),
    ).toHaveLength(0);
    await expandNetworkSection(tree, network.id);
    const expandedList = tree.root
      .findAllByProps({ testID: "network-device-sections" })
      .find((node) => Array.isArray(node.props.data));
    expect(
      expandedList?.props.data.filter(
        (row: { kind: string }) => row.kind === "device",
      ),
    ).toHaveLength(devices.length);
    const mounted = tree.root.findAll(
      (node) =>
        typeof node.props.testID === "string" &&
        node.props.testID.startsWith("device-settings-device:"),
    );
    expect(mounted.length).toBeGreaterThan(0);
    expect(mounted.length).toBeLessThan(devices.length);
    await act(async () => tree.unmount());
  });

  test("flattened row models insert devices only for expanded sections", () => {
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const section = {
      key: `network:${network.id}`,
      type: "network" as const,
      network,
      devices: [
        {
          key: `device:${device.id}`,
          id: device.id,
          displayName: device.nickname!,
          canonicalIdentifier: device.transportDeviceId,
          transportDeviceId: device.transportDeviceId,
          status: "assigned-matching" as const,
          cachedPanId: network.panId,
          cachedProfileMatchStatus: "matched" as const,
          matchingNetworkIds: [network.id],
          available: false,
          savedDevice: device,
        },
      ],
    };
    expect(
      flattenNetworkDeviceRows([section], new Set()).some(
        (row) => row.kind === "device",
      ),
    ).toBe(false);
    expect(
      flattenNetworkDeviceRows([section], new Set([section.key])).filter(
        (row) => row.kind === "device",
      ),
    ).toHaveLength(1);
  });

  test("opens, saves, and closes cached settings for a saved offline device without inspection", async () => {
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const harness = createRuntime({ networks: [network], devices: [device] });
    const tree = await renderNetworkScreen(harness);
    await expandNetworkSection(tree, network.id);

    await act(async () => {
      pressTestId(tree, `device-settings-device:${device.id}`);
      await flushPromises();
    });

    expect(tree.root.findByType(DeviceSettingsModal).props).toMatchObject({
      device: expect.objectContaining({ id: device.id }),
      available: false,
      isOpen: true,
    });
    expect(harness.inspectAndCache).not.toHaveBeenCalled();

    await act(async () => {
      pressTestId(tree, "save-device-settings");
      await flushPromises();
    });
    expect(harness.applyConfigurationDiff).not.toHaveBeenCalled();

    act(() => tree.root.findByType(DeviceSettingsModal).props.onClose());
    expect(
      tree.root.findAllByProps({ testID: "device-settings-modal-root" }),
    ).toHaveLength(0);
    await act(async () => tree.unmount());
  });

  test("shares one auto/modal inspection, saves a hardware edit, and closes settings", async () => {
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const harness = createRuntime({
      networks: [network],
      devices: [device],
      discoveries: [discovery(device.transportDeviceId)],
    });
    const tree = await renderNetworkScreen(harness);
    await expandNetworkSection(tree, network.id);
    const inspectionsBeforeOpening = harness.inspectAndCache.mock.calls.length;

    await act(async () => {
      pressTestId(tree, `device-settings-device:${device.id}`);
      await flushPromises();
      await flushPromises();
    });
    await flushDeferredAnimation();

    expect(tree.root.findByType(DeviceSettingsModal).props).toMatchObject({
      device: expect.objectContaining({ id: device.id }),
      available: true,
      isOpen: true,
    });
    expect(harness.inspectAndCache).toHaveBeenCalledTimes(
      inspectionsBeforeOpening,
    );
    expect(harness.inspectAndCache).toHaveBeenLastCalledWith(device.id);

    act(() =>
      changeTextTestId(tree, "device-hardware-label-input", "Renamed anchor"),
    );
    await act(async () => {
      pressTestId(tree, "save-device-settings");
      await flushPromises();
      await flushPromises();
    });
    expect(harness.applyConfigurationDiff).toHaveBeenCalledWith(device.id, {
      label: "Renamed anchor",
    });

    act(() => tree.root.findByType(DeviceSettingsModal).props.onClose());
    expect(
      tree.root.findAllByProps({ testID: "device-settings-modal-root" }),
    ).toHaveLength(0);
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
    await act(async () => {
      pressTestId(tree, "save-device-settings");
      await flushPromises();
    });
    expect(harness.applyConfigurationDiff).not.toHaveBeenCalled();
    act(() => tree.root.findByType(DeviceSettingsModal).props.onClose());
    expect(
      tree.root.findAllByProps({ testID: "device-settings-modal-root" }),
    ).toHaveLength(0);
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
      pressTestId(tree, `section-toggle-network:${alpha.id}`);
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

  test("marks a legacy PAN 0 profile for repair", async () => {
    const legacy = { ...savedNetwork(), panId: 0 };
    const harness = createRuntime({ networks: [legacy] });
    const tree = await renderNetworkScreen(harness);

    expect(
      findTextContaining(
        tree,
        "PAN 0 is the PANS default for unassigned devices",
      ),
    ).toBeTruthy();
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
});

function createRuntime(
  options: {
    networks?: ManagedNetwork[];
    devices?: ManagedDevice[];
    discoveries?: DiscoveredDeviceSnapshot[];
  } = {},
) {
  let networks = [...(options.networks ?? [])];
  let devices = [...(options.devices ?? [])];
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
    getDevice: jest.fn(async (deviceId: string) =>
      devices.find((device) => device.id === deviceId),
    ),
    getSettings: jest.fn().mockResolvedValue(undefined),
    getLatestDeviceSnapshots: jest.fn().mockResolvedValue({}),
    getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
    saveDevice: jest.fn(async (device: ManagedDevice) => {
      devices = [...devices.filter((item) => item.id !== device.id), device];
      return device;
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
        return devices.find((device) => device.id === association.deviceId)!;
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
        return devices.find((device) => device.id === deviceId)!;
      },
    ),
  } as unknown as jest.Mocked<PansManagerRepository>;
  const inspection = inspectionResult();
  const inspectAndCache = jest.fn().mockResolvedValue(inspection);
  const applyConfigurationDiff = jest.fn().mockResolvedValue({
    deviceId: "device-1",
    transportDeviceId: "transport-1",
    outcome: "verified",
    writes: [],
    warnings: [],
  });
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
      return {
        deviceId: input.deviceId,
        targetNetworkId: input.targetNetworkId,
        stage: "complete" as const,
        outcome: "assigned" as const,
        device: devices.find((device) => device.id === input.deviceId),
        network: networks.find(
          (network) => network.id === input.targetNetworkId,
        ),
      };
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
      applyConfigurationDiff,
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
    applyConfigurationDiff,
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

function savedDeviceForIndex(networkId: string, index: number): ManagedDevice {
  const base = savedDevice(networkId);
  return {
    ...base,
    id: `device-${index}`,
    transportDeviceId: `transport-${index}`,
    nickname: `Device ${index}`,
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

async function renderNetworkScreen(harness: ReturnType<typeof createRuntime>) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <PansManagerProvider createRuntime={async () => harness.runtime}>
        <NetworksDevicesScreen />
      </PansManagerProvider>,
    );
    await flushPromises();
  });
  return tree;
}

function pressTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = tree.root
    .findAllByProps({ testID })
    .find((node) => typeof node.props.onPress === "function");
  if (target) return target.props.onPress();
  const portalTarget = findModalElementProps(tree, testID, "onPress");
  if (!portalTarget) throw new Error(`No pressable found for ${testID}`);
  return portalTarget.onPress();
}

function changeTextTestId(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
  value: string,
) {
  const target = tree.root
    .findAllByProps({ testID })
    .find((node) => typeof node.props.onChangeText === "function");
  if (target) return target.props.onChangeText(value);
  const portalTarget = findModalElementProps(tree, testID, "onChangeText");
  if (!portalTarget) throw new Error(`No text input found for ${testID}`);
  return portalTarget.onChangeText(value);
}

function findModalElementProps(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
  handler: "onPress" | "onChangeText",
): Record<string, any> | undefined {
  const modal = tree.root.findByProps({ testID: "device-settings-modal-root" });
  const visit = (value: React.ReactNode): Record<string, any> | undefined => {
    if (!React.isValidElement(value)) return undefined;
    const props = value.props as Record<string, any>;
    if (props.testID === testID && typeof props[handler] === "function")
      return props;
    for (const child of React.Children.toArray(props.children)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  for (const child of React.Children.toArray(modal.props.children)) {
    const found = visit(child);
    if (found) return found;
  }
  return undefined;
}

function toolbarHarness(children: React.ReactNode) {
  return (
    <TestbedToolbarActionProvider>
      <TestbedToolbarActionSlot />
      {children}
    </TestbedToolbarActionProvider>
  );
}

async function expandNetworkSection(
  tree: TestRenderer.ReactTestRenderer,
  networkId: string,
) {
  if (expansionState(tree, `section-toggle-network:${networkId}`)) return;
  await act(async () => {
    pressTestId(tree, `section-toggle-network:${networkId}`);
    await flushPromises();
  });
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

async function flushAnimationFrame() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

async function flushDeferredAnimation() {
  await act(async () => {
    await flushAnimationFrame();
    await flushPromises();
  });
}
