/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { CoordinateLinesView } from "../coordinate-lines-view";

jest.mock("@eight2five/ui/components/hstack", () => {
  const ReactModule = require("react") as typeof React;
  const { View } = require("react-native") as typeof import("react-native");
  return {
    HStack: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(View, props, children),
  };
});
jest.mock("@eight2five/ui/components/vstack", () => {
  const ReactModule = require("react") as typeof React;
  const { View } = require("react-native") as typeof import("react-native");
  return {
    VStack: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(View, props, children),
  };
});
jest.mock("@eight2five/ui/components/text", () => {
  const ReactModule = require("react") as typeof React;
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    Text: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(Text, props, children),
  };
});
jest.mock("@eight2five/ui/components/icon", () => ({ Icon: () => null }));

describe("CoordinateLinesView", () => {
  test("allows each coordinate row to wrap to two lines without auto-scaling", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CoordinateLinesView
          coordinate={{
            side: "Side 1: 12.75 steps outside the 5-yard line",
            frontBack: "24.5 steps behind the back hash",
          }}
          color="#000"
          mutedColor="#666"
        />,
      );
    });

    const coordinateText = renderer.root.findAll(
      (node) => node.props.numberOfLines === 2,
    );
    expect(coordinateText.length).toBeGreaterThanOrEqual(2);
    for (const node of coordinateText) {
      expect(node.props.adjustsFontSizeToFit).toBeUndefined();
      expect(node.props.minimumFontScale).toBeUndefined();
      expect(node.props.style).toEqual(
        expect.objectContaining({ flexShrink: 1 }),
      );
    }

    await act(async () => renderer.unmount());
  });

  test("supports a three-line limit for compact live coordinates", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <CoordinateLinesView
          coordinate={{
            side: "Side 1: 12.75 steps outside the 5-yard line",
            frontBack: "24.5 steps behind the back hash",
          }}
          color="#000"
          mutedColor="#666"
          maxLinesPerAxis={3}
        />,
      );
    });

    const coordinateText = renderer.root.findAll(
      (node) => node.props.numberOfLines === 3,
    );
    expect(coordinateText.length).toBeGreaterThanOrEqual(2);

    await act(async () => renderer.unmount());
  });
});
