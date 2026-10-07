import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { selectNetworkDeviceSections } from "../../../../../../packages/mobile/src/pans-manager/device-sections";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  type ManagedNetwork,
} from "../../../../../../packages/mobile/src/pans-manager/types";

import { NetworkDeviceHierarchy } from "../network-device-hierarchy";

jest.mock("@eight2five/ui/components/hstack", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    HStack: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(View, props, children),
  };
});
jest.mock("@eight2five/ui/components/vstack", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    VStack: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(View, props, children),
  };
});
jest.mock("@eight2five/ui/components/icon", () => ({ Icon: () => null }));
jest.mock("@eight2five/ui/components/text", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Text: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(Text, props, children),
  };
});
jest.mock("@eight2five/ui/components/pressable", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { Pressable } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Pressable: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(Pressable, props, children),
  };
});
jest.mock("@eight2five/ui/components/button", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { Pressable, Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Button: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(Pressable, props, children),
    ButtonText: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(Text, props, children),
  };
});

describe("NetworkDeviceHierarchy", () => {
  test("renders network and unassigned groups and exposes tag connection actions", async () => {
    const network: ManagedNetwork = {
      id: "field",
      name: "Main Field",
      panId: 42,
      settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
      createdAt: 1,
      updatedAt: 1,
    };
    const tag: ManagedDevice = {
      id: "tag-1",
      transportDeviceId: "transport-tag-1",
      role: "tag",
      lastKnownConfig: {
        role: "tag",
        panId: 42,
        uwbMode: "active",
        ledEnabled: true,
        firmwareUpdateEnabled: true,
        locationEngineEnabled: true,
        lowPowerModeEnabled: false,
        stationaryDetectionEnabled: false,
        locationDataMode: 2,
      },
      createdAt: 1,
      updatedAt: 1,
    };
    const discovery: DiscoveredDeviceSnapshot = {
      transportDeviceId: tag.transportDeviceId,
      name: "Performer Tag",
      rssi: -48,
      lastSeenAt: 2,
      stale: false,
      compatibility: "compatible",
      presence: { role: "tag" } as never,
    };
    const unassigned: DiscoveredDeviceSnapshot = {
      ...discovery,
      transportDeviceId: "new-anchor",
      name: "New Anchor",
      presence: { role: "anchor" } as never,
    };
    const sections = selectNetworkDeviceSections(
      [network],
      [tag],
      [discovery, unassigned],
    );
    const onOpenDevice = jest.fn();
    const onConnectTag = jest.fn();

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NetworkDeviceHierarchy
          sections={sections}
          onOpenDevice={onOpenDevice}
          onConnectTag={onConnectTag}
        />,
      );
    });

    expect(
      renderer.root.findByProps({
        testID: "network-device-section-unassigned",
      }),
    ).toBeDefined();
    expect(
      renderer.root.findByProps({
        testID: "network-device-section-network:field",
      }),
    ).toBeDefined();

    const connect = renderer.root.findByProps({
      testID: "connect-network-device-device:tag-1",
    });
    await act(async () => connect.props.onPress());
    expect(onConnectTag).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tag-1", networkId: "field" }),
    );

    const newAnchor = renderer.root.findByProps({
      testID: "network-device-discovery:new-anchor",
    });
    await act(async () => newAnchor.props.onPress());
    expect(onOpenDevice).toHaveBeenCalledWith(
      expect.objectContaining({ transportDeviceId: "new-anchor" }),
    );

    await act(async () => renderer.unmount());
  });
});
