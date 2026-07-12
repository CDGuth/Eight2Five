import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PansNetworkGrid } from "@eight2five/mobile/pans-manager/PansNetworkGrid";

import { BatchResults } from "../components/batch-results";
import { isDwm1001FirmwareRouteEnabled } from "../manager-flags";

jest.mock("expo-pans-ble-api", () => ({}));

describe("advanced DWM1001 manager UI", () => {
  test("renders batch success, cancellation, and retry states", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <BatchResults
          items={[
            {
              batchId: "b",
              deviceId: "a",
              index: 0,
              status: "succeeded",
              attempts: 1,
            },
            {
              batchId: "b",
              deviceId: "b",
              index: 1,
              status: "skipped",
              attempts: 0,
              error: { code: "OPERATION_CANCELLED", message: "cancelled" },
            },
            {
              batchId: "b",
              deviceId: "c",
              index: 2,
              status: "failed",
              attempts: 2,
              error: { code: "GATT_FAILURE", message: "retry available" },
            },
          ]}
        />,
      );
    });
    const text = tree.root
      .findAllByType("Text" as never)
      .map((node) => node.props.children)
      .flat(Infinity)
      .join(" ");
    expect(text).toContain("succeeded");
    expect(text).toContain("skipped");
    expect(text).toContain("2 attempts");
    await act(async () => tree.unmount());
  });

  test("smoke renders the Skia network grid", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PansNetworkGrid
          nodes={[
            {
              id: "anchor",
              role: "anchor",
              position: { xMeters: 0, yMeters: 0 },
              initiator: true,
            },
            { id: "tag", role: "tag", position: { xMeters: 2, yMeters: 3 } },
          ]}
        />,
      );
    });
    const grid = tree.root.findByProps({ testID: "pans-network-grid" });
    await act(async () => {
      grid.props.onLayout({
        nativeEvent: { layout: { width: 320, height: 420 } },
      });
    });
    expect(
      tree.root.findByProps({ testID: "pans-network-grid-canvas" }),
    ).toBeTruthy();
    await act(async () => tree.unmount());
  });

  test("keeps firmware execution hidden behind the disabled flag", () => {
    expect(isDwm1001FirmwareRouteEnabled).toBe(false);
  });
});
