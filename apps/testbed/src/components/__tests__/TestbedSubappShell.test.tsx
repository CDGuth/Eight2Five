import React from "react";
import { act } from "react-test-renderer";
import { Text } from "@eight2five/ui/components/text";

import { renderWithAct } from "../../testUtils/renderWithAct";
import { TestbedSubappShell } from "../TestbedSubappShell";
import { useTestbedToolbarAction } from "../testbed-toolbar";

const mockPush = jest.fn();
let mockPathname = "/dwm1001-manager/networks-devices";

jest.mock("expo-router", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      MockReact.useEffect(callback, [callback]),
    usePathname: () => mockPathname,
    useRouter: () => ({ push: mockPush }),
  };
});

jest.mock("@eight2five/ui/components/drawer", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  const { ScrollView, View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const Wrapper = ({ children, ...props }: any) =>
    MockReact.createElement(View, props, children);
  return {
    Drawer: ({ children, ...props }: any) =>
      MockReact.createElement(
        View,
        { testID: "mock-drawer", ...props },
        children,
      ),
    DrawerBackdrop: Wrapper,
    DrawerBody: ({ children, ...props }: any) =>
      MockReact.createElement(ScrollView, props, children),
    DrawerContent: Wrapper,
  };
});

describe("TestbedSubappShell", () => {
  beforeEach(() => {
    mockPathname = "/dwm1001-manager/networks-devices";
  });

  test("renders the black system scrim, empty toolbar center, and focused action", () => {
    const tree = renderWithAct(
      <TestbedSubappShell>
        <ToolbarActionFixture />
      </TestbedSubappShell>,
    );

    expect(
      tree.root.findByProps({ testID: "testbed-status-bar-scrim" }).props.style,
    ).toMatchObject({ backgroundColor: "#000000" });
    expect(
      tree.root.findByProps({ testID: "testbed-subapp-toolbar" }).props.style,
    ).toMatchObject({ backgroundColor: "#000000" });
    expect(
      tree.root.findByProps({ testID: "fixture-toolbar-action" }),
    ).toBeTruthy();
  });

  test("opens the drawer and closes it after Home or subapp navigation", () => {
    const tree = renderWithAct(
      <TestbedSubappShell>
        <></>
      </TestbedSubappShell>,
    );
    const drawer = () => tree.root.findByProps({ testID: "mock-drawer" });

    expect(drawer().props.isOpen).toBe(false);
    act(() =>
      tree.root.findByProps({ testID: "testbed-menu-button" }).props.onPress(),
    );
    expect(drawer().props.isOpen).toBe(true);
    act(() =>
      tree.root.findByProps({ testID: "testbed-drawer-home" }).props.onPress(),
    );
    expect(mockPush).toHaveBeenLastCalledWith("/");
    expect(drawer().props.isOpen).toBe(false);

    act(() =>
      tree.root.findByProps({ testID: "testbed-menu-button" }).props.onPress(),
    );
    const managerRow = tree.root.findByProps({
      testID: "testbed-drawer-pans-network-manager",
    });
    expect(managerRow.props.accessibilityState).toEqual({ selected: true });
    act(() => managerRow.props.onPress());
    expect(mockPush).toHaveBeenLastCalledWith(
      "/(subapps)/dwm1001-manager/(tabs)/networks-devices",
    );
    expect(drawer().props.isOpen).toBe(false);
  });
});

function ToolbarActionFixture() {
  const action = React.useMemo(
    () => <Text testID="fixture-toolbar-action">Action</Text>,
    [],
  );
  useTestbedToolbarAction("fixture", action);
  return null;
}
