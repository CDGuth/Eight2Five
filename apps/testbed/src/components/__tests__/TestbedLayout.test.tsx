import React from "react";
import { act } from "react-test-renderer";
import { TestbedLayout } from "../TestbedLayout";
import { renderWithAct } from "../../testUtils/renderWithAct";

describe("TestbedLayout", () => {
  it("renders header and home button", () => {
    const onBack = jest.fn();
    const tree = renderWithAct(
      <TestbedLayout title="Title" subtitle="Subtitle" onBack={onBack}>
        <></>
      </TestbedLayout>,
    );

    const homeButton = tree.root.findByProps({ testID: "testbed-home-button" });
    act(() => homeButton.props.onPress());
    expect(onBack).toHaveBeenCalled();
    expect(tree.root.findByProps({ children: "Title" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Subtitle" })).toBeTruthy();
  });

  it("renders sub-back button when provided", () => {
    const onSubBack = jest.fn();
    const tree = renderWithAct(
      <TestbedLayout title="Title" onSubBack={onSubBack}>
        <></>
      </TestbedLayout>,
    );

    const subBackButton = tree.root.findByProps({
      testID: "testbed-sub-back-button",
    });
    act(() => subBackButton.props.onPress());
    expect(onSubBack).toHaveBeenCalled();
  });

  it("can render non-scrolling static content", () => {
    const tree = renderWithAct(
      <TestbedLayout title="Title" contentMode="static">
        <></>
      </TestbedLayout>,
    );

    expect(tree.root.findByProps({ children: "Title" })).toBeTruthy();
  });
});
