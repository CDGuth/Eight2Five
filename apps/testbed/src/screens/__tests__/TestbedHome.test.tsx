import React from "react";
import type { Href } from "expo-router";
import { act } from "react-test-renderer";
import { TestbedHome } from "../TestbedHome";
import { TestbedSubapp } from "../../subapps";
import { renderWithAct } from "../../testUtils/renderWithAct";

const fakeSubapps: TestbedSubapp[] = [
  {
    id: "optimization",
    title: "optimization playground",
    description: "Run localization scenarios",
    routeName: "(subapps)/optimization",
    href: "/(subapps)/optimization" as Href,
  },
];

describe("TestbedHome", () => {
  it("lists subapps and triggers selection", () => {
    const onSelect = jest.fn();
    const tree = renderWithAct(
      <TestbedHome subapps={fakeSubapps} onSelect={onSelect} />,
    );

    const card = tree.root.findByProps({
      testID: "subapp-card-optimization playground",
    });
    act(() => card.props.onPress());
    expect(onSelect).toHaveBeenCalledWith("optimization");
  });
});
