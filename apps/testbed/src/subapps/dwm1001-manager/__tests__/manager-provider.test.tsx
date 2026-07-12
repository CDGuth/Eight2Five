import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Button, ButtonText } from "@eight2five/ui/button";
import { Text } from "@eight2five/ui/text";
import type { PansManagerRepository } from "@eight2five/mobile/pans-manager";

import {
  PansManagerProvider,
  type PansManagerRuntime,
  useManagerReadiness,
  usePansDiscovery,
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
    batch: {} as PansManagerRuntime["batch"],
    logs: { flush: jest.fn().mockResolvedValue(undefined) },
    networkExport: {
      exportNetworkJson: jest.fn(),
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
