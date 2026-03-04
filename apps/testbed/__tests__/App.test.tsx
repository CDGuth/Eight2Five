import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import App from "../App";

jest.mock("../src/subapps", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const StubSubapp = ({ onExit }: { onExit?: () => void }) => (
    <Text testID="stub-subapp" onPress={onExit}>
      Stub Subapp
    </Text>
  );

  return {
    __esModule: true,
    SUBAPPS: [
      {
        id: "optimization",
        title: "Stub App",
        description: "A placeholder subapp used in tests",
        Component: StubSubapp,
      },
    ],
  };
});

describe("App (testbed)", () => {
  it("navigates between home and selected subapp", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<App />);
    });

    const card = tree.root.findByProps({ testID: "subapp-card-Stub App" });
    act(() => card.props.onPress());
    expect(tree.root.findByProps({ testID: "stub-subapp" })).toBeTruthy();

    const stub = tree.root.findByProps({ testID: "stub-subapp" });
    act(() => stub.props.onPress?.());
    expect(tree.root.findByProps({ testID: "subapp-card-Stub App" })).toBeTruthy();
  });
});
