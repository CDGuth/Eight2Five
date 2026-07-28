import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import { DeviceSettingsModal } from "../device-settings-modal";
import { usePansManager } from "../manager-context";

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("@eight2five/ui/components/modal", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  const { View: MockView } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Wrapper = ({ children, ...props }: any) =>
    MockReact.createElement(MockView, props, children);
  return {
    Modal: ({ isOpen, children, ...props }: any) =>
      MockReact.createElement(MockView, props, isOpen ? children : null),
    ModalBackdrop: Wrapper,
    ModalBody: Wrapper,
    ModalCloseButton: Wrapper,
    ModalContent: Wrapper,
    ModalFooter: Wrapper,
    ModalHeader: Wrapper,
  };
});
jest.mock("../manager-context", () => ({
  usePansManager: jest.fn(),
}));

const mockUsePansManager = jest.mocked(usePansManager);
const inspectDevice = jest.fn(() => new Promise<never>(() => {}));

describe("DeviceSettingsModal lazy behavior", () => {
  beforeEach(() => {
    inspectDevice.mockClear();
    mockUsePansManager.mockReturnValue({
      networks: [],
      inspectDevice,
      applyDeviceConfiguration: jest.fn(),
      deleteOfflineDevice: jest.fn(),
      unassignOnlineDevice: jest.fn(),
    } as unknown as ReturnType<typeof usePansManager>);
  });

  test("defers and deduplicates online inspection until the first frame", async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    globalThis.requestAnimationFrame = (callback) => {
      const frame = nextFrame++;
      frames.set(frame, callback);
      return frame;
    };
    globalThis.cancelAnimationFrame = (frame) =>
      typeof frame === "number" && frames.delete(frame);

    let tree!: TestRenderer.ReactTestRenderer;
    try {
      await act(async () => {
        tree = TestRenderer.create(modal(true));
      });
      expect(inspectDevice).not.toHaveBeenCalled();
      expect(frames.size).toBe(1);

      await act(async () => {
        const pendingFrames = [...frames.values()];
        frames.clear();
        pendingFrames.forEach((callback) => callback(0));
      });
      expect(inspectDevice).toHaveBeenCalledTimes(1);
      expect(inspectDevice).toHaveBeenCalledWith("device-1");

      await act(async () => tree.update(modal(true)));
      expect(inspectDevice).toHaveBeenCalledTimes(1);
    } finally {
      if (tree) await act(async () => tree.unmount());
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  test("keeps advanced settings mounted through collapse and then unmounts them", async () => {
    jest.useFakeTimers();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(modal(false));
    });
    expect(findText(tree, "Transport ID")).toBe(false);

    act(() => advancedButton(tree).props.onPress());
    expect(findText(tree, "Transport ID")).toBe(true);

    act(() => advancedButton(tree).props.onPress());
    expect(findText(tree, "Transport ID")).toBe(true);
    act(() => jest.advanceTimersByTime(200));
    expect(findText(tree, "Transport ID")).toBe(false);

    await act(async () => tree.unmount());
  });
});

function modal(available: boolean) {
  return (
    <DeviceSettingsModal
      device={device}
      isOpen
      available={available}
      onClose={jest.fn()}
    />
  );
}

function findText(tree: TestRenderer.ReactTestRenderer, text: string) {
  return tree.root
    .findAllByType("Text" as never)
    .some((node) => node.props.children === text);
}

function advancedButton(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByProps({ testID: "toggle-device-advanced" })
    .find((node) => typeof node.props.onPress === "function")!;
}

const device = {
  id: "device-1",
  transportDeviceId: "transport-1",
  label: "Test device",
  lastKnownConfig: {
    label: "Test device",
    panId: 1,
    role: "tag",
    uwbMode: "active",
    selectedFirmware: 1,
    ledEnabled: true,
    firmwareUpdateEnabled: false,
    locationEngineEnabled: true,
    lowPowerModeEnabled: false,
    stationaryDetectionEnabled: true,
  },
} as ManagedDevice;
