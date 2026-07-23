import React from "react";
import type { Href } from "expo-router";
import { act } from "react-test-renderer";
import { TestbedHome } from "../TestbedHome";
import { TestbedSubapp } from "../../subapps";
import { renderWithAct } from "../../testUtils/renderWithAct";

const fakeSubapps: TestbedSubapp[] = [
  {
    id: "demo",
    title: "demo playground",
    description: "Run a demo scenario",
    routeName: "(subapps)/demo",
    href: "/(subapps)/demo" as Href,
  },
];

describe("TestbedHome", () => {
  it("lists subapps and triggers selection", () => {
    const onSelect = jest.fn();
    const tree = renderWithAct(
      <TestbedHome subapps={fakeSubapps} onSelect={onSelect} />,
    );

    const card = tree.root.findByProps({
      testID: "subapp-card-demo playground",
    });
    act(() => card.props.onPress());
    expect(onSelect).toHaveBeenCalledWith("demo");
    expect(
      tree.root.findByProps({ children: "Eight2Five Testbed App" }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ children: "Select a subapp to run." }),
    ).toBeTruthy();
  });
});
