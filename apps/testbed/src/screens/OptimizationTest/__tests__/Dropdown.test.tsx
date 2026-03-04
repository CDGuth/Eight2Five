import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dropdown } from "../components/Dropdown";

const render = (element: React.ReactElement) => {
  return TestRenderer.create(element);
};

describe("Dropdown", () => {
  it("toggles open state and forwards selection", () => {
    const onSelect = jest.fn();
    const onToggle = jest.fn();
    const tree = render(
      <Dropdown
        label="Mode"
        value="a"
        options={[
          { label: "Alpha", value: "a" },
          { label: "Beta", value: "b" },
        ]}
        onSelect={onSelect}
        onToggle={onToggle}
      />,
    );

    const dropdown = tree.root.findByType(Dropdown);
    const button = tree.root.findByProps({ testID: "dropdown-button" });

    act(() => button.props.onPress());
    act(() => dropdown.props.onSelect("b"));

    expect(onToggle).toHaveBeenCalledWith(true);
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
