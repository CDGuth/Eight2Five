import React from "react";
import { Text } from "@eight2five/ui/components/text";

import { renderWithAct } from "../../testUtils/renderWithAct";
import { TestbedShell } from "../TestbedShell";
import { useTestbedToolbarAction } from "../testbed-toolbar";

jest.mock("expo-router", () => {
  const MockReact = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      MockReact.useEffect(callback, [callback]),
  };
});

describe("TestbedShell", () => {
  test("renders the black system scrim, toolbar, content, and focused action", () => {
    const tree = renderWithAct(
      <TestbedShell>
        <Text testID="fixture-content">Content</Text>
        <ToolbarActionFixture />
      </TestbedShell>,
    );

    expect(
      tree.root.findByProps({ testID: "testbed-status-bar-scrim" }).props.style,
    ).toMatchObject({ backgroundColor: "#000000" });
    expect(
      tree.root.findByProps({ testID: "testbed-toolbar" }).props.style,
    ).toMatchObject({ backgroundColor: "#000000" });
    expect(tree.root.findByProps({ testID: "fixture-content" })).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: "fixture-toolbar-action" }),
    ).toBeTruthy();
  });

  test("does not render the removed subapp menu", () => {
    const tree = renderWithAct(
      <TestbedShell>
        <></>
      </TestbedShell>,
    );

    expect(() =>
      tree.root.findByProps({ testID: "testbed-menu-button" }),
    ).toThrow();
    expect(() => tree.root.findByProps({ testID: "mock-drawer" })).toThrow();
  });
});

function ToolbarActionFixture() {
  useTestbedToolbarAction(
    "fixture",
    <Text testID="fixture-toolbar-action">Action</Text>,
  );
  return null;
}
