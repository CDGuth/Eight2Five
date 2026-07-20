import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Button, ButtonText } from "@eight2five/ui/components/button";
import { Text } from "@eight2five/ui/components/text";
import type { PansManagerRepository } from "@eight2five/mobile/pans-manager";

import {
  PansManagerProvider,
  type PansManagerRuntime,
  useManagerReadiness,
  usePansDiscovery,
  usePansManager,
} from "../manager-context";

describe("PansManagerProvider", () => {
  it("initializes storage without prompting or scanning, then starts explicitly", async () => {
    const requestPermissions = jest
      .fn()
      .mockResolvedValue({ bluetooth: "granted" });
    const start = jest.fn().mockResolvedValue(undefined);
    const runtime = makeRuntime({ requestPermissions, start });
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
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ children: "ready" })).toBeTruthy();

    await act(async () => {
      await tree.root
        .findByProps({ testID: "start-discovery" })
        .props.onPress();
    });

    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ children: "scanning" })).toBeTruthy();

    await act(async () => tree.unmount());
    expect(runtime.discovery.stop).toHaveBeenCalled();
    expect(runtime.sessions.closeAll).toHaveBeenCalled();
    expect(runtime.closeStorage).toHaveBeenCalled();
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
});

function ProviderHarness() {
  const readiness = useManagerReadiness();
  const discovery = usePansDiscovery();
  return (
    <>
      <Text>{readiness.initialization}</Text>
      <Text>{readiness.error}</Text>
      <Text>{discovery.isScanning ? "scanning" : "idle"}</Text>
      <Button testID="start-discovery" onPress={() => discovery.start()}>
        <ButtonText>Start</ButtonText>
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

function makeRuntime(overrides: Record<string, jest.Mock> = {}) {
  return createRuntimeValue({
    discovery: {
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
      getDiagnostics: jest.fn(() => scanDiagnostics()),
    },
    sessions: {
      closeDevice: jest.fn().mockResolvedValue(undefined),
      closeAll: jest.fn().mockResolvedValue(undefined),
    },
    configuration: {
      inspect: jest.fn(),
      configureDevice: jest.fn(),
      assignPanId: jest.fn(),
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
