import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Button, ButtonText } from "@eight2five/ui/components/button";
import { Text } from "@eight2five/ui/components/text";
import type {
  ManagedDevice,
  PansManagerRepository,
} from "@eight2five/mobile/pans-manager";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "@eight2five/mobile/pans-manager/types";

import {
  PansManagerProvider,
  type PansManagerRuntime,
  useManagerReadiness,
  usePansDiscovery,
  usePansManager,
} from "../manager-context";

describe("PansManagerProvider", () => {
  it("requests permission once, auto-starts, and allows immediate stop/start", async () => {
    let permissionGranted = false;
    const requestPermissions = jest.fn().mockImplementation(async () => {
      permissionGranted = true;
      return { bluetooth: "granted" };
    });
    const start = jest.fn().mockResolvedValue(undefined);
    const runtime = makeRuntime({
      getPermissionStatus: jest.fn(() => ({
        bluetooth: permissionGranted ? "granted" : "undetermined",
      })),
      requestPermissions,
      start,
    });
    const createRuntime = jest.fn(async (reporter) => {
      reporter.module("ready");
      reporter.storage("ready");
      return runtime;
    });
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={createRuntime}>
          <ProviderHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    expect(createRuntime).toHaveBeenCalledTimes(1);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ children: "ready" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "scanning" })).toBeTruthy();

    await act(async () => {
      await tree.root.findByProps({ testID: "stop-discovery" }).props.onPress();
    });
    expect(runtime.discovery.stop).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ children: "idle" })).toBeTruthy();

    await act(async () => {
      await tree.root
        .findByProps({ testID: "start-discovery" })
        .props.onPress();
    });
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(2);
    expect(tree.root.findByProps({ children: "scanning" })).toBeTruthy();

    await act(async () => tree.unmount());
    expect(runtime.discovery.stop).toHaveBeenCalled();
    expect(runtime.sessions.closeAll).toHaveBeenCalled();
    expect(runtime.closeStorage).toHaveBeenCalled();
  });

  it("preserves desired scanning across background and restarts on foreground", async () => {
    const appState = createAppState("active");
    const start = jest.fn().mockResolvedValue(undefined);
    const runtime = makeRuntime({
      getPermissionStatus: jest.fn(() => ({ bluetooth: "granted" })),
      start,
    });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider
          createRuntime={async () => runtime}
          appState={appState.adapter}
        >
          <ProviderHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });
    expect(start).toHaveBeenCalledTimes(1);

    await act(async () => {
      appState.emit("background");
      await flushPromises();
    });
    expect(runtime.discovery.stop).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ children: "desired" })).toBeTruthy();

    await act(async () => {
      appState.emit("active");
      await flushPromises();
    });
    expect(start).toHaveBeenCalledTimes(2);
    expect(runtime.discovery.requestPermissions).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it("does not loop permission prompts after denial", async () => {
    const appState = createAppState("active");
    const requestPermissions = jest.fn().mockResolvedValue({
      bluetooth: "denied",
      canAskAgain: false,
    });
    const runtime = makeRuntime({ requestPermissions });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider
          createRuntime={async () => runtime}
          appState={appState.adapter}
        >
          <ProviderHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(runtime.discovery.start).not.toHaveBeenCalled();

    await act(async () => {
      appState.emit("background");
      appState.emit("active");
      await flushPromises();
    });
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(runtime.discovery.start).not.toHaveBeenCalled();
    expect(
      tree.root.findByProps({
        children:
          "Nearby Devices permission is required to discover PANS devices.",
      }),
    ).toBeTruthy();
    await act(async () => tree.unmount());
  });

  it("recovers after a native scan start failure", async () => {
    const start = jest
      .fn()
      .mockRejectedValueOnce(new Error("Native scan failed"))
      .mockResolvedValueOnce(undefined);
    const runtime = makeRuntime({
      getPermissionStatus: jest.fn(() => ({ bluetooth: "granted" })),
      start,
    });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <ProviderHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });
    expect(
      tree.root.findByProps({ children: "Native scan failed" }),
    ).toBeTruthy();

    await act(async () => {
      await tree.root
        .findByProps({ testID: "start-discovery" })
        .props.onPress();
    });
    expect(start).toHaveBeenCalledTimes(2);
    expect(tree.root.findByProps({ children: "scanning" })).toBeTruthy();
    await act(async () => tree.unmount());
  });

  it("surfaces initialization failures and supports retry", async () => {
    const createRuntime = jest
      .fn()
      .mockRejectedValueOnce(new Error("SQLite could not be opened"))
      .mockImplementationOnce(async (reporter) => {
        reporter.module("ready");
        reporter.storage("ready");
        return createRuntimeValue();
      });
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={createRuntime}>
          <ProviderHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    expect(
      tree.root.findByProps({ children: "SQLite could not be opened" }),
    ).toBeTruthy();

    await act(async () => {
      tree.root.findByProps({ testID: "retry-manager" }).props.onPress();
      await flushPromises();
    });

    expect(createRuntime).toHaveBeenCalledTimes(2);
    expect(tree.root.findByProps({ children: "ready" })).toBeTruthy();
    await act(async () => tree.unmount());
  });

  it("closes a runtime that resolves after the provider unmounts", async () => {
    const deferred = createDeferred<PansManagerRuntime>();
    const runtime = createRuntimeValue();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={() => deferred.promise}>
          <ProviderHarness />
        </PansManagerProvider>,
      );
    });
    await act(async () => tree.unmount());

    await act(async () => {
      deferred.resolve(runtime);
      await flushPromises();
    });

    expect(runtime.discovery.stop).toHaveBeenCalledTimes(1);
    expect(runtime.sessions.closeAll).toHaveBeenCalledTimes(1);
    expect(runtime.closeStorage).toHaveBeenCalledTimes(1);
  });

  it("resolves a managed device ID before requesting diagnostics", async () => {
    const inspect = jest.fn().mockResolvedValue({ capturedAt: 1 });
    const runtime = createRuntimeValue({
      repository: {
        listNetworks: jest.fn().mockResolvedValue([]),
        listDevices: jest.fn().mockResolvedValue([
          {
            id: "managed-1",
            transportDeviceId: "transport-1",
            createdAt: 1,
            updatedAt: 1,
          },
        ]),
        getSettings: jest.fn().mockResolvedValue(undefined),
        getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
      } as unknown as PansManagerRepository,
      diagnostics: { inspect },
    });
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <DiagnosticsHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });
    await act(async () => {
      await tree.root
        .findByProps({ testID: "inspect-diagnostics" })
        .props.onPress();
    });

    expect(inspect).toHaveBeenCalledWith("managed-1", "transport-1");
    await act(async () => tree.unmount());
  });

  it("uses inspectAndCache and refreshes devices and snapshots after success", async () => {
    const inspectAndCache = jest.fn().mockResolvedValue({
      deviceId: "managed-1",
      transportDeviceId: "transport-1",
      inspectedAt: 10,
      operationMode: { role: "anchor" },
      warnings: [],
    });
    const repository = {
      listNetworks: jest.fn().mockResolvedValue([]),
      listDevices: jest.fn().mockResolvedValue([
        {
          id: "managed-1",
          transportDeviceId: "transport-1",
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
      getSettings: jest.fn().mockResolvedValue(undefined),
      getLatestDeviceSnapshot: jest.fn().mockResolvedValue({
        deviceId: "managed-1",
        capturedAt: 10,
        config: {
          role: "anchor",
          uwbMode: "active",
          ledEnabled: true,
          firmwareUpdateEnabled: false,
          initiatorEnabled: false,
        },
      }),
    } as unknown as PansManagerRepository;
    const runtime = createRuntimeValue({
      repository,
      configuration: {
        inspect: jest.fn(),
        inspectAndCache,
        configureDevice: jest.fn(),
        applyConfigurationDiff: jest.fn(),
        assignPanId: jest.fn(),
        unassignDeviceHardware: jest.fn(),
      },
    });
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <InspectionHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });
    await act(async () => {
      await tree.root.findByProps({ testID: "inspect-device" }).props.onPress();
    });

    expect(inspectAndCache).toHaveBeenCalledWith("managed-1");
    expect(runtime.configuration.inspect).not.toHaveBeenCalled();
    expect(runtime.repository.listDevices).toHaveBeenCalledTimes(2);
    expect(runtime.repository.getLatestDeviceSnapshot).toHaveBeenCalledTimes(2);
    await act(async () => tree.unmount());
  });

  it("auto-inspects an available saved device and caches its hardware PAN match", async () => {
    const network = {
      id: "profile",
      name: "Field",
      panId: 7,
      settings: {
        coordinateBounds: {
          minXMeters: -1,
          maxXMeters: 1,
          minYMeters: -1,
          maxYMeters: 1,
          minZMeters: -1,
          maxZMeters: 1,
        },
        defaultAnchorHeightMeters: 1,
        staleDeviceTimeoutMs: 1000,
        defaultTagMode: {
          locationEngineEnabled: true,
          lowPowerModeEnabled: false,
          stationaryDetectionEnabled: true,
          locationDataMode: 0 as const,
          movingUpdateRateMs: 100,
          stationaryUpdateRateMs: 1000,
        },
        autoConnect: false,
        positionLogRetentionDays: 1,
        positionLogMaxSamples: 100,
      },
      createdAt: 1,
      updatedAt: 1,
    };
    let storedDevice: ManagedDevice = {
      id: "managed-1",
      transportDeviceId: "transport-1",
      createdAt: 1,
      updatedAt: 1,
    };
    const repository = {
      listNetworks: jest.fn(async () => [network]),
      listDevices: jest.fn(async () => [storedDevice]),
      saveDevice: jest.fn(async (device) => {
        storedDevice = device;
      }),
      associateDevice: jest.fn(
        async (
          association: Parameters<PansManagerRepository["associateDevice"]>[0],
        ) => {
          storedDevice = {
            ...storedDevice,
            networkId: association.networkId,
            updatedAt: association.associatedAt,
          };
        },
      ),
      getSettings: jest.fn().mockResolvedValue(undefined),
      getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as PansManagerRepository;
    const inspectAndCache = jest.fn(async () => {
      storedDevice = {
        ...storedDevice,
        lastKnownConfig: {
          role: "anchor" as const,
          panId: 7,
          uwbMode: "active" as const,
          ledEnabled: true,
          firmwareUpdateEnabled: false,
          initiatorEnabled: false,
        },
      };
      return {
        deviceId: "managed-1",
        transportDeviceId: "transport-1",
        inspectedAt: 10,
        panId: 7,
        operationMode: {
          role: "anchor" as const,
          uwbMode: "active" as const,
          selectedFirmware: 1 as const,
          accelerometerEnabled: false,
          ledEnabled: true,
          firmwareUpdateEnabled: false,
          initiatorEnabled: false,
          lowPowerModeEnabled: false,
          locationEngineEnabled: false,
          raw: [0, 0] as [number, number],
        },
        warnings: [],
      };
    });
    const runtime = createRuntimeValue({
      repository,
      configuration: {
        inspect: jest.fn(),
        inspectAndCache,
        configureDevice: jest.fn(),
        applyConfigurationDiff: jest.fn(),
        assignPanId: jest.fn(),
        unassignDeviceHardware: jest.fn(),
      },
    });
    runtime.discovery.subscribe = jest.fn((listener) => {
      listener([
        {
          transportDeviceId: "transport-1",
          rssi: -50,
          lastSeenAt: 10,
          compatibility: "compatible",
        },
      ]);
      return { remove: jest.fn() };
    });
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <ProviderHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
      await flushPromises();
    });

    expect(inspectAndCache).toHaveBeenCalledTimes(1);
    expect(storedDevice).toMatchObject({ networkId: "profile" });
    expect(repository.associateDevice).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "managed-1", networkId: "profile" }),
    );
    await act(async () => tree.unmount());
  });

  it("exposes commissioning operations and refreshes persisted state", async () => {
    const assignDeviceToNetworkProfile = jest.fn().mockResolvedValue({
      deviceId: "device",
      targetNetworkId: "profile",
      stage: "complete",
      outcome: "assigned",
    });
    const migrateNetworkProfilePan = jest.fn().mockResolvedValue({
      operationId: "migration",
      networkId: "profile",
      targetPanId: 2,
      outcome: "migrated",
      profileUpdated: true,
      membershipChanged: false,
      deviceResults: [],
    });
    const runtime = createRuntimeValue({
      commissioning: {
        assignDeviceToNetworkProfile,
        migrateNetworkProfilePan,
      },
    });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <CommissioningHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    await act(async () => {
      await tree.root.findByProps({ testID: "assign-profile" }).props.onPress();
      await tree.root.findByProps({ testID: "migrate-pan" }).props.onPress();
    });

    expect(assignDeviceToNetworkProfile).toHaveBeenCalledWith({
      deviceId: "device",
      targetNetworkId: "profile",
    });
    expect(migrateNetworkProfilePan).toHaveBeenCalledWith({
      networkId: "profile",
      targetPanId: 2,
      operationId: "migration",
    });
    expect(runtime.repository.listNetworks).toHaveBeenCalledTimes(3);
    expect(runtime.repository.listDevices).toHaveBeenCalledTimes(3);
    await act(async () => tree.unmount());
  });

  it("saves trimmed network-local details with no BLE or commissioning call", async () => {
    let savedNetwork = {
      id: "profile",
      name: "Old name",
      panId: 7,
      settings: {
        coordinateBounds: {
          minXMeters: -1,
          maxXMeters: 1,
          minYMeters: -1,
          maxYMeters: 1,
          minZMeters: -1,
          maxZMeters: 1,
        },
        defaultAnchorHeightMeters: 1,
        staleDeviceTimeoutMs: 1000,
        defaultTagMode: {
          locationEngineEnabled: true,
          lowPowerModeEnabled: false,
          stationaryDetectionEnabled: true,
          locationDataMode: 0 as const,
          movingUpdateRateMs: 100,
          stationaryUpdateRateMs: 1000,
        },
        autoConnect: false,
        positionLogRetentionDays: 1,
        positionLogMaxSamples: 100,
      },
      notes: "Old notes",
      createdAt: 1,
      updatedAt: 1,
    };
    const repository = {
      listNetworks: jest.fn(async () => [savedNetwork]),
      getNetwork: jest.fn(async () => savedNetwork),
      saveNetwork: jest.fn(async (network) => {
        savedNetwork = network;
      }),
      listDevices: jest.fn().mockResolvedValue([]),
      getSettings: jest.fn().mockResolvedValue(undefined),
      getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as PansManagerRepository;
    const runtime = createRuntimeValue({ repository });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <NetworkLocalDetailsHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    await act(async () => {
      await tree.root
        .findByProps({ testID: "save-network-local" })
        .props.onPress();
    });

    expect(savedNetwork).toMatchObject({
      name: "New name",
      notes: "User notes",
      panId: 7,
    });
    expect(runtime.configuration.inspectAndCache).not.toHaveBeenCalled();
    expect(runtime.configuration.applyConfigurationDiff).not.toHaveBeenCalled();
    expect(
      runtime.commissioning.migrateNetworkProfilePan,
    ).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it("deletes an offline device record without a hardware call", async () => {
    let storedDevice: ManagedDevice | undefined = {
      id: "device",
      transportDeviceId: "transport-device",
      createdAt: 1,
      updatedAt: 1,
    };
    const deleteDevice = jest.fn(async () => {
      storedDevice = undefined;
    });
    const unassignDeviceHardware = jest.fn();
    const repository = {
      listNetworks: jest.fn().mockResolvedValue([]),
      listDevices: jest.fn(async () => (storedDevice ? [storedDevice] : [])),
      getDevice: jest.fn(async () => storedDevice),
      deleteDevice,
      getSettings: jest.fn().mockResolvedValue(undefined),
      getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
    } as unknown as PansManagerRepository;
    const runtime = createRuntimeValue({
      repository,
      configuration: {
        inspect: jest.fn(),
        inspectAndCache: jest.fn(),
        configureDevice: jest.fn(),
        applyConfigurationDiff: jest.fn(),
        assignPanId: jest.fn(),
        unassignDeviceHardware,
      },
    });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <DeviceDeletionHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    await act(async () => {
      await tree.root.findByProps({ testID: "delete-offline" }).props.onPress();
    });

    expect(deleteDevice).toHaveBeenCalledWith("device");
    expect(unassignDeviceHardware).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it("runs verified hardware unassignment for an available device", async () => {
    let storedDevice: ManagedDevice = {
      id: "device",
      networkId: "profile",
      transportDeviceId: "transport-device",
      lastKnownConfig: {
        role: "anchor",
        panId: 7,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: false,
        initiatorEnabled: false,
      },
      createdAt: 1,
      updatedAt: 1,
    };
    const deleteDevice = jest.fn();
    const repository = {
      listNetworks: jest.fn().mockResolvedValue([
        {
          id: "profile",
          name: "Profile",
          panId: 7,
          settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
      listDevices: jest.fn(async () => [storedDevice]),
      getDevice: jest.fn(async () => storedDevice),
      deleteDevice,
      getSettings: jest.fn().mockResolvedValue(undefined),
      getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
      dissociateDevice: jest.fn(async () => {
        const updated = { ...storedDevice };
        delete updated.networkId;
        storedDevice = updated;
      }),
    } as unknown as PansManagerRepository;
    const unassignDeviceHardware = jest.fn(async () => {
      storedDevice = {
        ...storedDevice,
        lastKnownConfig: {
          ...storedDevice.lastKnownConfig!,
          panId: 0,
          uwbMode: "passive",
        },
      };
      return {
        deviceId: "device",
        transportDeviceId: "transport-device",
        outcome: "verified" as const,
        writes: [
          { field: "uwbMode", status: "verified" as const },
          { field: "panId", status: "verified" as const },
        ],
        warnings: [],
      };
    });
    const runtime = createRuntimeValue({
      repository,
      discovery: {
        ...createRuntimeValue().discovery,
        subscribe: jest.fn((listener) => {
          listener([
            {
              transportDeviceId: "transport-device",
              rssi: -50,
              lastSeenAt: 1,
              compatibility: "malformed",
            },
          ]);
          return { remove: jest.fn() };
        }),
      },
      configuration: {
        inspect: jest.fn(),
        inspectAndCache: jest.fn(),
        configureDevice: jest.fn(),
        applyConfigurationDiff: jest.fn(),
        assignPanId: jest.fn(),
        unassignDeviceHardware,
      },
    });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={async () => runtime}>
          <DeviceDeletionHarness />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    await act(async () => {
      await tree.root
        .findByProps({ testID: "unassign-online" })
        .props.onPress();
    });

    expect(unassignDeviceHardware).toHaveBeenCalledWith("device");
    expect(storedDevice).toMatchObject({
      lastKnownConfig: { panId: 0, uwbMode: "passive" },
    });
    expect(storedDevice.networkId).toBeUndefined();
    expect(repository.dissociateDevice).toHaveBeenCalledWith(
      "profile",
      "device",
      expect.any(Number),
    );
    expect(deleteDevice).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
});

function ProviderHarness() {
  const readiness = useManagerReadiness();
  const discovery = usePansDiscovery();
  return (
    <>
      <Text>{readiness.initialization}</Text>
      <Text>{readiness.error}</Text>
      <Text>{discovery.isScanning ? "scanning" : "idle"}</Text>
      <Text>{discovery.desiredScanning ? "desired" : "not desired"}</Text>
      <Text>{discovery.error}</Text>
      <Button testID="start-discovery" onPress={() => discovery.start()}>
        <ButtonText>Start</ButtonText>
      </Button>
      <Button testID="stop-discovery" onPress={() => discovery.stop()}>
        <ButtonText>Stop</ButtonText>
      </Button>
      <Button testID="retry-manager" onPress={readiness.retry}>
        <ButtonText>Retry</ButtonText>
      </Button>
    </>
  );
}

function DiagnosticsHarness() {
  const manager = usePansManager();
  return (
    <Button
      testID="inspect-diagnostics"
      onPress={() => manager.inspectDiagnostics("managed-1")}
    >
      <ButtonText>Inspect diagnostics</ButtonText>
    </Button>
  );
}

function InspectionHarness() {
  const manager = usePansManager();
  return (
    <Button
      testID="inspect-device"
      onPress={() => manager.inspectDevice("managed-1")}
    >
      <ButtonText>Inspect device</ButtonText>
    </Button>
  );
}

function CommissioningHarness() {
  const manager = usePansManager();
  return (
    <>
      <Button
        testID="assign-profile"
        onPress={() =>
          manager.assignDeviceToNetworkProfile({
            deviceId: "device",
            targetNetworkId: "profile",
          })
        }
      >
        <ButtonText>Assign</ButtonText>
      </Button>
      <Button
        testID="migrate-pan"
        onPress={() =>
          manager.migrateNetworkProfilePan({
            networkId: "profile",
            targetPanId: 2,
            operationId: "migration",
          })
        }
      >
        <ButtonText>Migrate</ButtonText>
      </Button>
    </>
  );
}

function NetworkLocalDetailsHarness() {
  const manager = usePansManager();
  return (
    <Button
      testID="save-network-local"
      onPress={() =>
        manager.saveNetworkLocalDetails({
          networkId: "profile",
          name: "  New name  ",
          notes: "  User notes  ",
        })
      }
    >
      <ButtonText>Save local network details</ButtonText>
    </Button>
  );
}

function DeviceDeletionHarness() {
  const manager = usePansManager();
  return (
    <>
      <Button
        testID="delete-offline"
        onPress={() => manager.deleteOfflineDevice("device")}
      >
        <ButtonText>Delete offline</ButtonText>
      </Button>
      <Button
        testID="unassign-online"
        onPress={() => manager.unassignOnlineDevice("device")}
      >
        <ButtonText>Unassign online</ButtonText>
      </Button>
    </>
  );
}

function makeRuntime(overrides: Record<string, jest.Mock> = {}) {
  return createRuntimeValue({
    discovery: {
      state: "idle",
      desiredScanning: false,
      getPermissionStatus: jest.fn(() => ({ bluetooth: "undetermined" })),
      requestPermissions: jest.fn().mockResolvedValue({ bluetooth: "granted" }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      clear: jest.fn(),
      subscribe: jest.fn((listener) => {
        listener([]);
        return { remove: jest.fn() };
      }),
      subscribeErrors: jest.fn(() => ({ remove: jest.fn() })),
      subscribeDiagnostics: jest.fn((listener) => {
        listener(scanDiagnostics());
        return { remove: jest.fn() };
      }),
      subscribeState: jest.fn((listener) => {
        listener("idle");
        return { remove: jest.fn() };
      }),
      getDiagnostics: jest.fn(() => scanDiagnostics()),
      get isScanning() {
        return false;
      },
      ...overrides,
    },
  });
}

function createRuntimeValue(
  overrides: Partial<PansManagerRuntime> = {},
): PansManagerRuntime {
  const repository = {
    listNetworks: jest.fn().mockResolvedValue([]),
    listDevices: jest.fn().mockResolvedValue([]),
    getSettings: jest.fn().mockResolvedValue(undefined),
    getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
    saveSettings: jest.fn().mockResolvedValue(undefined),
  } as unknown as PansManagerRepository;
  return {
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
        listener([]);
        return { remove: jest.fn() };
      }),
      subscribeErrors: jest.fn(() => ({ remove: jest.fn() })),
      subscribeDiagnostics: jest.fn((listener) => {
        listener(scanDiagnostics());
        return { remove: jest.fn() };
      }),
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
      inspectAndCache: jest.fn(),
      configureDevice: jest.fn(),
      applyConfigurationDiff: jest.fn(),
      assignPanId: jest.fn(),
      unassignDeviceHardware: jest.fn(),
    },
    commissioning: {
      assignDeviceToNetworkProfile: jest.fn(),
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
    ...overrides,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
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

function createAppState(initialState: "active" | "background") {
  const listeners = new Set<(state: "active" | "background") => void>();
  return {
    adapter: {
      currentState: initialState,
      addEventListener: (
        _type: "change",
        listener: (state: "active" | "background") => void,
      ) => {
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    },
    emit(state: "active" | "background") {
      listeners.forEach((listener) => listener(state));
    },
  };
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
