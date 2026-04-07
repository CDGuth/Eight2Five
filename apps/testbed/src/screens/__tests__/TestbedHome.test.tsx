import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { TestbedHome } from "../TestbedHome";
import { TestbedSubapp } from "../../subapps";

const fakeSubapps: TestbedSubapp[] = [
  {
    id: "optimization",
    title: "optimization playground",
    description: "Run localization scenarios",
    href: "/(subapps)/optimization",
  },
];

describe("TestbedHome", () => {
  it("lists subapps and triggers selection", () => {
    const onSelect = jest.fn();
    const tree = TestRenderer.create(
      <TestbedHome subapps={fakeSubapps} onSelect={onSelect} />,
    );

    const card = tree.root.findByProps({
      testID: "subapp-card-optimization playground",
    });
    act(() => card.props.onPress());
    expect(onSelect).toHaveBeenCalledWith("optimization");
  });
});
