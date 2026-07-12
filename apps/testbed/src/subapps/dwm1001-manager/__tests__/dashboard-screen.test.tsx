import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { PansManagerRepository } from "@eight2five/mobile/pans-manager";

import {
  PansManagerProvider,
  type PansManagerRuntime,
} from "../manager-context";
import { DashboardScreen } from "../screens/dashboard-screen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

describe("DashboardScreen", () => {
  it("shows readiness, explicit discovery, and the empty profile state", async () => {
    const runtime = dashboardRuntime();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider
          createRuntime={async (reporter) => {
            reporter.module("ready");
            reporter.storage("ready");
            return runtime;
          }}
        >
          <DashboardScreen />
        </PansManagerProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ testID: "manager-readiness" })).toBeTruthy();
    expect(
      tree.root.findByProps({ children: "No saved profiles" }),
    ).toBeTruthy();
    expect(runtime.discovery.requestPermissions).not.toHaveBeenCalled();
    expect(runtime.discovery.start).not.toHaveBeenCalled();

    act(() =>
      tree.root.findByProps({ testID: "discover-devices" }).props.onPress(),
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/(subapps)/dwm1001-manager/discovery",
    );
    await act(async () => tree.unmount());
  });
});

function dashboardRuntime(): PansManagerRuntime {
  const repository = {
    listNetworks: jest.fn().mockResolvedValue([]),
    listDevices: jest.fn().mockResolvedValue([]),
    getSettings: jest.fn().mockResolvedValue(undefined),
  } as unknown as PansManagerRepository;
  return {
    repository,
    discovery: {
      isScanning: false,
      getPermissionStatus: jest.fn(() => ({ bluetooth: "undetermined" })),
      requestPermissions: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      clear: jest.fn(),
      subscribe: jest.fn((listener) => {
        listener([]);
        return { remove: jest.fn() };
      }),
    },
    sessions: { closeDevice: jest.fn(), closeAll: jest.fn() },
    configuration: {
      inspect: jest.fn(),
      configureDevice: jest.fn(),
      assignPanId: jest.fn(),
    },
    diagnostics: { inspect: jest.fn() },
    batch: {} as PansManagerRuntime["batch"],
    logs: { flush: jest.fn() } as unknown as PansManagerRuntime["logs"],
    topology: {} as PansManagerRuntime["topology"],
    createPositionStream: jest.fn(),
    networkExport: {
      exportNetworkJson: jest.fn(),
      exportNetworkCsv: jest.fn(),
      validateImport: jest.fn(),
      importNetwork: jest.fn(),
    },
    closeStorage: jest.fn(),
  };
}
