import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  DEFAULT_PANS_MANAGER_SETTINGS,
  type PansManagerSettings,
} from "@eight2five/mobile/pans-manager";

import { usePansManager } from "../manager-context";
import { ManagerSettingsScreen } from "../screens/manager-settings-screen";

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("../manager-context", () => ({
  usePansManager: jest.fn(),
}));

const mockUsePansManager = jest.mocked(usePansManager);
const saveManagerSettings = jest.fn().mockResolvedValue(undefined);

describe("ManagerSettingsScreen hydration", () => {
  beforeEach(() => {
    saveManagerSettings.mockClear();
    setManagerSettings(undefined);
  });

  test("shows canonical defaults in a disabled loading form before hydration", async () => {
    const tree = await renderScreen();

    expect(input(tree, "manager-settings-discovery-stale").props).toMatchObject(
      {
        value: String(DEFAULT_PANS_MANAGER_SETTINGS.discoveryStaleAfterMs),
        editable: false,
        accessibilityState: { disabled: true },
      },
    );
    expect(input(tree, "manager-settings-connection-timeout").props.value).toBe(
      String(DEFAULT_PANS_MANAGER_SETTINGS.connectionTimeoutMs),
    );
    expect(
      input(tree, "manager-settings-position-memory-cap").props.value,
    ).toBe(String(DEFAULT_PANS_MANAGER_SETTINGS.positionLogMemoryCap));
    expect(
      input(tree, "manager-settings-position-flush-size").props.value,
    ).toBe(String(DEFAULT_PANS_MANAGER_SETTINGS.positionLogFlushSize));
    expect(button(tree).props).toMatchObject({ isDisabled: true });
    expect(findText(tree, "Loading manager settings…")).toBeTruthy();

    await act(async () => tree.unmount());
  });

  test("hydrates a pristine form with asynchronously persisted settings", async () => {
    const tree = await renderScreen();
    const persisted = settings(23_000, 17_000, 2_000, 250);

    await refresh(tree, persisted);

    expect(values(tree)).toEqual(["23000", "17000", "2000", "250"]);
    expect(input(tree, "manager-settings-discovery-stale").props.editable).toBe(
      true,
    );
    expect(button(tree).props.isDisabled).toBe(false);
    expect(findText(tree, "Loading manager settings…")).toBeUndefined();

    await act(async () => {
      button(tree).props.onPress();
      await Promise.resolve();
    });
    expect(saveManagerSettings).toHaveBeenCalledWith(persisted);

    await act(async () => tree.unmount());
  });

  test("preserves user edits across later manager settings refreshes", async () => {
    setManagerSettings(settings(20_000, 15_000, 2_000, 200));
    const tree = await renderScreen();

    act(() => {
      input(tree, "manager-settings-connection-timeout").props.onChangeText(
        "33333",
      );
    });
    await refresh(tree, settings(40_000, 45_000, 4_000, 400));

    expect(values(tree)).toEqual(["20000", "33333", "2000", "200"]);

    await act(async () => tree.unmount());
  });
});

function setManagerSettings(managerSettings: PansManagerSettings | undefined) {
  mockUsePansManager.mockReturnValue({
    managerSettings,
    saveManagerSettings,
  } as unknown as ReturnType<typeof usePansManager>);
}

async function renderScreen() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<ManagerSettingsScreen />);
  });
  return tree;
}

async function refresh(
  tree: TestRenderer.ReactTestRenderer,
  managerSettings: PansManagerSettings,
) {
  setManagerSettings(managerSettings);
  await act(async () => {
    tree.update(<ManagerSettingsScreen />);
  });
}

function input(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root
    .findAllByProps({ testID })
    .find((node) => typeof node.props.onChangeText === "function")!;
}

function button(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByProps({ testID: "manager-settings-save" })
    .find((node) => typeof node.props.onPress === "function")!;
}

function values(tree: TestRenderer.ReactTestRenderer) {
  return [
    "manager-settings-discovery-stale",
    "manager-settings-connection-timeout",
    "manager-settings-position-memory-cap",
    "manager-settings-position-flush-size",
  ].map((testID) => input(tree, testID).props.value);
}

function findText(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root
    .findAllByType("Text" as never)
    .find((node) => node.props.children === text);
}

function settings(
  discoveryStaleAfterMs: number,
  connectionTimeoutMs: number,
  positionLogMemoryCap: number,
  positionLogFlushSize: number,
): PansManagerSettings {
  return {
    discoveryStaleAfterMs,
    connectionTimeoutMs,
    positionLogMemoryCap,
    positionLogFlushSize,
  };
}
