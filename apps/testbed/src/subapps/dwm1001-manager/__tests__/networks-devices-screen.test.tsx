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

import {
  PansManagerProvider,
  type PansManagerRuntime,
} from "../manager-context";
import { NetworksDevicesScreen } from "../screens/networks-devices-screen";

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("react-native-reanimated", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const animation: Record<string, jest.Mock> = {};
  for (const method of ["delay", "duration", "easing", "withInitialValues"])
    animation[method] = jest.fn(() => animation);
  const createAnimatedComponent = (component: React.ElementType) => component;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent },
    createAnimatedComponent,
    Easing: { linear: jest.fn() },
    FadeIn: animation,
    FadeOut: animation,
    ZoomIn: animation,
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value,
    interpolate: (value: number, input: number[], output: number[]) =>
      value === input[0] ? output[0] : output[output.length - 1],
  };
});

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

describe("NetworksDevicesScreen", () => {
  test("does not auto-scan, shows native loading, and exposes one Scan/Stop toggle", async () => {
    const deferred = createDeferred<PansManagerRuntime>();
    const runtime = createRuntime().runtime;
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={() => deferred.promise}>
          <NetworksDevicesScreen />
        </PansManagerProvider>,
      );
    });

    expect(findText(tree, "Native Module Loading")).toBeTruthy();
    expect(findText(tree, "Scan")).toBeUndefined();
    expect(findText(tree, "Stop")).toBeUndefined();
    expect(runtime.discovery.start).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(runtime);
      await flushPromises();
    });

    expect(findText(tree, "Scan")).toBeTruthy();
    expect(countScanStopLabels(tree)).toBe(1);
    expect(runtime.discovery.start).not.toHaveBeenCalled();

    await act(async () => {
      pressTestId(tree, "scan-control");
      await flushPromises();
    });
    expect(runtime.discovery.start).toHaveBeenCalledTimes(1);
    expect(findText(tree, "Stop")).toBeTruthy();
    expect(countScanStopLabels(tree)).toBe(1);

    await act(async () => {
      pressTestId(tree, "scan-control");
    });
    expect(runtime.discovery.stop).toHaveBeenCalledTimes(1);
    expect(findText(tree, "Scan")).toBeTruthy();
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
        <PansManagerProvider createRuntime={createRuntimeFactory}>
          <NetworksDevicesScreen />
        </PansManagerProvider>,
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
    expect(findText(tree, "Scan")).toBeTruthy();
    await act(async () => tree.unmount());
  });

  test("keeps controlled expansion through discovery rerenders and refreshes only explicitly", async () => {
    const network = savedNetwork();
    const device = savedDevice(network.id);
    const harness = createRuntime({ networks: [network], devices: [device] });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => harness.runtime}>
          <NetworksDevicesScreen />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    expect(expansionState(tree, "section-toggle-unassigned")).toBe(true);
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
    expect(harness.inspectAndCache).not.toHaveBeenCalled();

    await act(async () => {
      pressTestId(tree, `device-settings-device:${device.id}`);
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
    expect(harness.inspectAndCache).not.toHaveBeenCalled();

    await act(async () => {
      pressTestId(tree, `refresh-device-${device.id}`);
      await flushPromises();
    });
    expect(harness.inspectAndCache).toHaveBeenCalledWith(device.id);
    expect(findTextPrefix(tree, "Refreshed ")).toBeTruthy();
    await act(async () => tree.unmount());
  });

  test("persists a discovery-only row only when Settings is pressed", async () => {
    const discovered = discovery("transport-new");
    const harness = createRuntime({ discoveries: [discovered] });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => harness.runtime}>
          <NetworksDevicesScreen />
        </PansManagerProvider>,
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

  test("shows the idle and scanning empty states plus compact discovery errors", async () => {
    const harness = createRuntime();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => harness.runtime}>
          <NetworksDevicesScreen />
        </PansManagerProvider>,
      );
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
  let devices = [...(options.devices ?? [])];
  let discoveryListener: (items: DiscoveredDeviceSnapshot[]) => void = () => {};
  let errorListener: (error: ManagerError) => void = () => {};
  const repository = {
    listNetworks: jest.fn(async () => [...(options.networks ?? [])]),
    listDevices: jest.fn(async () => [...devices]),
    getSettings: jest.fn().mockResolvedValue(undefined),
    getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
    saveDevice: jest.fn(async (device: ManagedDevice) => {
      devices = [...devices.filter((item) => item.id !== device.id), device];
    }),
  } as unknown as jest.Mocked<PansManagerRepository>;
  const inspection = inspectionResult();
  const inspectAndCache = jest.fn().mockResolvedValue(inspection);
  const runtime: PansManagerRuntime = {
    repository,
    discovery: {
      isScanning: false,
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
    },
    commissioning: {
      assignDeviceToNetworkProfile: jest.fn(),
      unassignDeviceFromNetworkProfile: jest.fn(),
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

function discovery(transportDeviceId: string): DiscoveredDeviceSnapshot {
  return {
    transportDeviceId,
    name: "hardware-advertisement",
    rssi: -75,
    lastSeenAt: 10,
    compatibility: "compatible",
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

function pressTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = tree.root
    .findAllByProps({ testID })
    .find((node) => typeof node.props.onPress === "function");
  if (!target) throw new Error(`No pressable found for ${testID}`);
  target.props.onPress();
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

function countScanStopLabels(tree: TestRenderer.ReactTestRenderer): number {
  return tree.root
    .findAllByType("Text" as never)
    .filter(
      (node) =>
        node.props.children === "Scan" || node.props.children === "Stop",
    ).length;
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
