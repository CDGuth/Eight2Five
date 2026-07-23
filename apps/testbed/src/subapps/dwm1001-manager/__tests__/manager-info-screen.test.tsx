import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import * as Clipboard from "expo-clipboard";
import type { PansManagerRepository } from "@eight2five/mobile/pans-manager";

import expoPackage from "expo/package.json";
import reactNativePackage from "react-native/package.json";
import pansBleApiPackage from "../../../../../../modules/expo-pans-ble-api/package.json";
import mobilePackage from "../../../../../../packages/mobile/package.json";
import uiPackage from "../../../../../../packages/ui/package.json";

import {
  PansManagerProvider,
  type PansManagerRuntime,
} from "../manager-context";
import { ManagerInfoScreen } from "../screens/manager-info-screen";

const BUILD_ID = "0123456789abcdef0123456789abcdef01234567";

const mockExpoConfig: {
  name?: string;
  version?: string;
  ios?: { buildNumber?: string };
  android?: { versionCode?: number };
  runtimeVersion?: string;
  extra?: { buildId?: string };
} = {};

jest.mock("expo-constants", () => ({
  __esModule: true,
  get default() {
    return { expoConfig: mockExpoConfig };
  },
}));

jest.mock("expo-updates", () => ({
  updateId: "update-123",
  channel: "preview",
  isEmbeddedLaunch: false,
}));

jest.mock("expo-pans-ble-api", () => ({}));

describe("ManagerInfoScreen", () => {
  beforeEach(() => {
    mockExpoConfig.name = "Eight2Five Testbed";
    mockExpoConfig.version = "1.2.3";
    mockExpoConfig.ios = { buildNumber: "42" };
    mockExpoConfig.android = { versionCode: 7 };
    mockExpoConfig.runtimeVersion = "1.2.3";
    mockExpoConfig.extra = { buildId: BUILD_ID };
  });

  test("renders build, runtime, and package rows from constants and context", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={readyRuntime}>
          <ManagerInfoScreen />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    // Build information
    expect(findText(tree, "App name")).toBeTruthy();
    expect(findText(tree, "Eight2Five Testbed")).toBeTruthy();
    expect(findText(tree, "App version")).toBeTruthy();
    expect(findText(tree, "1.2.3")).toBeTruthy();
    expect(findText(tree, "iOS build number")).toBeTruthy();
    expect(findText(tree, "42")).toBeTruthy();
    expect(findText(tree, "Build ID")).toBeTruthy();
    expect(findText(tree, BUILD_ID)).toBeTruthy();
    expect(findText(tree, "Git commit")).toBeTruthy();
    expect(findText(tree, "EAS update ID")).toBeTruthy();
    expect(findText(tree, "update-123")).toBeTruthy();
    expect(findText(tree, "Update channel")).toBeTruthy();
    expect(findText(tree, "preview")).toBeTruthy();
    expect(findText(tree, "Environment")).toBeTruthy();
    expect(findText(tree, "development")).toBeTruthy();

    // Runtime information
    expect(findText(tree, "Expo SDK")).toBeTruthy();
    expect(findText(tree, expoPackage.version)).toBeTruthy();
    expect(findText(tree, "React Native")).toBeTruthy();
    expect(findText(tree, reactNativePackage.version)).toBeTruthy();
    expect(findText(tree, "PANS module build ID")).toBeTruthy();
    expect(findText(tree, "test-build")).toBeTruthy();
    expect(findText(tree, "Native module status")).toBeTruthy();
    expect(findText(tree, "ready")).toBeTruthy();
    expect(findText(tree, "Bluetooth permission")).toBeTruthy();
    expect(findText(tree, "granted")).toBeTruthy();
    expect(findText(tree, "Bluetooth adapter")).toBeTruthy();
    expect(findText(tree, "idle")).toBeTruthy();
    expect(findText(tree, "Storage status")).toBeTruthy();

    // Package information
    expect(findText(tree, "expo-pans-ble-api")).toBeTruthy();
    expect(findText(tree, pansBleApiPackage.version)).toBeTruthy();
    expect(findText(tree, "@eight2five/mobile")).toBeTruthy();
    expect(findText(tree, mobilePackage.version)).toBeTruthy();
    expect(findText(tree, "@eight2five/ui")).toBeTruthy();
    expect(findText(tree, uiPackage.version)).toBeTruthy();

    // Nothing is fabricated: every row resolved to a real value.
    expect(findText(tree, "Unavailable")).toBeUndefined();

    await act(async () => tree.unmount());
  });

  test("copies a complete plain-text diagnostic summary", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={readyRuntime}>
          <ManagerInfoScreen />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    await act(async () => {
      pressTestId(tree, "copy-diagnostic-summary");
      await flushPromises();
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    const summary = jest.mocked(Clipboard.setStringAsync).mock.calls[0][0];
    expect(summary).toContain("Build information:");
    expect(summary).toContain("Runtime information:");
    expect(summary).toContain("Package information:");
    expect(summary).toContain(`Build ID: ${BUILD_ID}`);
    expect(summary).toContain(`Git commit: ${BUILD_ID}`);
    expect(summary).toContain("App version: 1.2.3");
    expect(summary).toContain("EAS update ID: update-123");
    expect(summary).toContain("Update channel: preview");
    expect(summary).toContain(`Expo SDK: ${expoPackage.version}`);
    expect(summary).toContain(`React Native: ${reactNativePackage.version}`);
    expect(summary).toContain("PANS module build ID: test-build");
    expect(summary).toContain(
      `expo-pans-ble-api: ${pansBleApiPackage.version}`,
    );
    expect(summary).toContain(`@eight2five/mobile: ${mobilePackage.version}`);
    expect(summary).toContain(`@eight2five/ui: ${uiPackage.version}`);
    expect(findText(tree, "Diagnostic summary copied.")).toBeTruthy();

    await act(async () => tree.unmount());
  });

  test("reports a local build honestly instead of fabricating a git commit", async () => {
    mockExpoConfig.extra = { buildId: "local" };
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansManagerProvider createRuntime={readyRuntime}>
          <ManagerInfoScreen />
        </PansManagerProvider>,
      );
      await flushPromises();
    });

    expect(findText(tree, "local")).toBeTruthy();
    expect(findText(tree, "Unavailable (local build)")).toBeTruthy();

    await act(async () => {
      pressTestId(tree, "copy-diagnostic-summary");
      await flushPromises();
    });
    const summary = jest.mocked(Clipboard.setStringAsync).mock.calls[0][0];
    expect(summary).toContain("Git commit: Unavailable (local build)");

    await act(async () => tree.unmount());
  });
});

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

function readyRuntime(
  reporter: Parameters<
    NonNullable<
      React.ComponentProps<typeof PansManagerProvider>["createRuntime"]
    >
  >[0],
): Promise<PansManagerRuntime> {
  reporter.module("ready");
  reporter.storage("ready");
  const repository = {
    listNetworks: jest.fn().mockResolvedValue([]),
    listDevices: jest.fn().mockResolvedValue([]),
    getSettings: jest.fn().mockResolvedValue(undefined),
    getLatestDeviceSnapshot: jest.fn().mockResolvedValue(undefined),
  } as unknown as PansManagerRepository;
  return Promise.resolve({
    repository,
    discovery: {
      isScanning: false,
      state: "idle",
      desiredScanning: false,
      getPermissionStatus: jest.fn(() => ({
        bluetooth: "granted" as const,
        bluetoothState: "enabled" as const,
      })),
      requestPermissions: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      clear: jest.fn(),
      subscribe: jest.fn((listener: (items: never[]) => void) => {
        listener([]);
        return { remove: jest.fn() };
      }),
      subscribeErrors: jest.fn(() => ({ remove: jest.fn() })),
      subscribeDiagnostics: jest.fn(() => ({ remove: jest.fn() })),
      subscribeState: jest.fn((listener) => {
        listener("idle");
        return { remove: jest.fn() };
      }),
      getDiagnostics: jest.fn(() => scanDiagnostics()),
    },
    sessions: { closeDevice: jest.fn(), closeAll: jest.fn() },
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
  });
}

function pressTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = tree.root
    .findAllByProps({ testID })
    .find((node) => typeof node.props.onPress === "function");
  if (!target) throw new Error(`No pressable found for ${testID}`);
  target.props.onPress();
}

function findText(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root
    .findAllByType("Text" as never)
    .find((node) => node.props.children === text);
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
