import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import { DeviceSettingsModal } from "../device-settings-modal";
import { useManagedNetworks } from "../manager-context";

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
  useManagedNetworks: jest.fn(),
  usePansActions: jest.fn(),
}));
jest.mock("../components/setting-help", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  const { Text: MockText, View: MockView } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SettingHelp: jest.fn(({ title, children }) =>
      MockReact.createElement(
        MockView,
        null,
        MockReact.createElement(MockText, null, title),
        children,
      ),
    ),
    SettingInfoCard: ({ children, ...props }: any) =>
      MockReact.createElement(MockView, props, children),
  };
});

const mockUseManagedNetworks = jest.mocked(useManagedNetworks);
const mockUsePansActions = jest.mocked(
  jest.requireMock("../manager-context").usePansActions,
);
const settingHelp = jest.mocked(
  jest.requireMock("../components/setting-help").SettingHelp,
);

describe("device settings section render isolation", () => {
  beforeEach(() => {
    mockUseManagedNetworks.mockReturnValue([]);
    mockUsePansActions.mockReturnValue({
      inspectDevice: jest.fn(),
      applyDeviceConfiguration: jest.fn(),
      deleteOfflineDevice: jest.fn(),
      unassignOnlineDevice: jest.fn(),
    });
    settingHelp.mockClear();
  });

  test.each([
    ["anchor", "Initiator and coordinates"],
    ["tag", "Tag update behavior"],
  ] as const)(
    "identity typing does not rerender the %s or firmware section",
    async (role, roleHelpTitle) => {
      jest.useFakeTimers();
      let tree!: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <DeviceSettingsModal
            device={makeDevice(role)}
            isOpen
            available={false}
            onClose={jest.fn()}
          />,
        );
      });
      act(() =>
        tree.root
          .findAllByProps({ testID: "toggle-device-advanced" })
          .find((node) => typeof node.props.onPress === "function")!
          .props.onPress(),
      );
      expect(helpTitles()).toContain(roleHelpTitle);
      expect(helpTitles()).toContain("Firmware slot");

      settingHelp.mockClear();
      const labelInput = tree.root
        .findAllByProps({ testID: "device-hardware-label-input" })
        .find((node) => typeof node.props.onChangeText === "function")!;
      act(() => labelInput.props.onChangeText("Changed label"));

      expect(helpTitles()).not.toContain(roleHelpTitle);
      expect(helpTitles()).not.toContain("Firmware slot");
      await act(async () => tree.unmount());
      jest.useRealTimers();
    },
  );
});

function helpTitles(): string[] {
  return settingHelp.mock.calls.map(
    (call: unknown[]) => (call[0] as { title: string }).title,
  );
}

function makeDevice(role: "anchor" | "tag"): ManagedDevice {
  return {
    id: `${role}-device`,
    transportDeviceId: `${role}-transport`,
    label: "Original label",
    createdAt: 1,
    updatedAt: 1,
    lastKnownConfig:
      role === "anchor"
        ? {
            role,
            label: "Original label",
            panId: 1,
            uwbMode: "active",
            selectedFirmware: 1,
            ledEnabled: true,
            firmwareUpdateEnabled: false,
            initiatorEnabled: false,
            position: { xMeters: 1, yMeters: 2, zMeters: 3, quality: 100 },
          }
        : {
            role,
            label: "Original label",
            panId: 1,
            uwbMode: "active",
            selectedFirmware: 1,
            ledEnabled: true,
            firmwareUpdateEnabled: false,
            locationEngineEnabled: true,
            lowPowerModeEnabled: false,
            stationaryDetectionEnabled: true,
          },
  };
}
