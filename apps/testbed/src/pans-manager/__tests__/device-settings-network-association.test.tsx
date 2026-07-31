import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type {
  ManagedDevice,
  ManagedNetwork,
} from "@eight2five/mobile/pans-manager";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "@eight2five/mobile/pans-manager";

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
    SettingHelp: ({ title, children }: any) =>
      MockReact.createElement(
        MockView,
        null,
        MockReact.createElement(MockText, null, title),
        children,
      ),
    SettingInfoCard: ({ children, ...props }: any) =>
      MockReact.createElement(MockView, props, children),
  };
});

const mockUseManagedNetworks = jest.mocked(useManagedNetworks);
const mockUsePansActions = jest.mocked(
  jest.requireMock("../manager-context").usePansActions,
);

describe("device settings saved network association", () => {
  const assignDeviceToNetworkProfile = jest.fn();

  beforeEach(() => {
    assignDeviceToNetworkProfile.mockReset();
    assignDeviceToNetworkProfile.mockResolvedValue({
      deviceId: "device-1",
      targetNetworkId: "network-field",
      stage: "complete",
      outcome: "assigned",
      configuration: {
        deviceId: "device-1",
        outcome: "success",
        writes: [],
        inspected: {
          deviceId: "device-1",
          panId: 0x1234,
          operationMode: {
            role: "tag",
            uwbMode: "active",
            selectedFirmware: 1,
            ledEnabled: true,
            firmwareUpdateEnabled: false,
            locationEngineEnabled: true,
            lowPowerModeEnabled: false,
            accelerometerEnabled: true,
          },
        },
      },
    });
    mockUseManagedNetworks.mockReturnValue([fieldNetwork()]);
    mockUsePansActions.mockReturnValue({
      inspectDevice: jest.fn().mockResolvedValue(undefined),
      applyDeviceConfiguration: jest.fn(),
      assignDeviceToNetworkProfile,
      deleteOfflineDevice: jest.fn(),
      unassignOnlineDevice: jest.fn(),
    });
  });

  test("renders the saved network association selector", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <DeviceSettingsModal
          device={tagDevice()}
          isOpen
          available
          onClose={jest.fn()}
        />,
      );
    });

    const select = tree.root
      .findAllByProps({ testID: "device-profile-select" })
      .find((node) => typeof node.props.onChange === "function");
    expect(select).toBeTruthy();
    expect(select!.props.value).toBe("unassigned");
    expect(select!.props.choices).toEqual(
      expect.arrayContaining([
        { label: "Unassigned", value: "unassigned" },
        expect.objectContaining({
          value: "network-field",
          label: expect.stringContaining("Field"),
        }),
      ]),
    );

    await act(async () => tree.unmount());
  });

  test("assigns the selected saved network on save", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <DeviceSettingsModal
          device={tagDevice()}
          isOpen
          available
          onClose={jest.fn()}
        />,
      );
    });

    const select = tree.root
      .findAllByProps({ testID: "device-profile-select" })
      .find((node) => typeof node.props.onChange === "function")!;
    act(() => select.props.onChange("network-field"));

    const save = tree.root
      .findAllByProps({ testID: "save-device-settings" })
      .find((node) => typeof node.props.onPress === "function")!;
    await act(async () => {
      await save.props.onPress();
    });

    expect(assignDeviceToNetworkProfile).toHaveBeenCalledWith({
      deviceId: "device-1",
      targetNetworkId: "network-field",
    });

    await act(async () => tree.unmount());
  });

  test("shows the matched network as the current association", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <DeviceSettingsModal
          device={tagDevice({ panId: 0x1234, networkId: "network-field" })}
          isOpen
          available
          onClose={jest.fn()}
        />,
      );
    });

    const select = tree.root
      .findAllByProps({ testID: "device-profile-select" })
      .find((node) => typeof node.props.onChange === "function")!;
    expect(select.props.value).toBe("network-field");

    await act(async () => tree.unmount());
  });
});

function fieldNetwork(): ManagedNetwork {
  return {
    id: "network-field",
    name: "Field",
    panId: 0x1234,
    createdAt: 1,
    updatedAt: 1,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
  };
}

function tagDevice(options?: {
  panId?: number;
  networkId?: string;
}): ManagedDevice {
  return {
    id: "device-1",
    transportDeviceId: "transport-1",
    label: "Tag",
    createdAt: 1,
    updatedAt: 1,
    ...(options?.networkId ? { networkId: options.networkId } : {}),
    lastKnownConfig: {
      role: "tag",
      label: "Tag",
      panId: options?.panId ?? 0,
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
