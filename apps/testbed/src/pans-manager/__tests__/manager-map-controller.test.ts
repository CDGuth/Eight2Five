import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  type ManagedDevice,
  type ManagedNetwork,
  type PansPositionStreamCounters,
  type PansPositionStreamSample,
  type StartPansPositionStreamOptions,
} from "@eight2five/mobile/pans-manager";

import {
  buildVisibleAnchorNodes,
  buildVisibleTagNodes,
  cacheTagPosition,
  removeCachedTagPosition,
  resolveRangingEdges,
  retainOnlyLiveTag,
  usePansMapDataController,
  type PansMapDataController,
  type PansMapVisibilityOptions,
} from "../manager-map-controller";

let mockManager: unknown;

jest.mock("expo-pans-ble-api", () => ({}));
jest.mock("../manager-context", () => ({
  usePansManager: () => mockManager,
}));

const visibility: PansMapVisibilityOptions = {
  anchors: true,
  tags: true,
  initiators: true,
  offline: true,
  labels: true,
  panMismatchIndicators: true,
  rangingLines: true,
};

describe("manager map data helpers", () => {
  test("filters anchors to selected saved networks without synthetic coordinates", () => {
    const selected = network("selected", 0x1234);
    const other = network("other", 0x5678);
    const nodes = buildVisibleAnchorNodes({
      networks: [selected],
      devices: [
        anchor("visible", selected.id, { xMeters: 2, yMeters: 3 }),
        anchor("other", other.id, { xMeters: 8, yMeters: 9 }),
        anchor("unpositioned", selected.id),
        anchor("invalid", selected.id, {
          xMeters: Number.NaN,
          yMeters: 1,
        }),
      ],
      visibility,
      now: 1_000,
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: "visible",
      label: "Device node-visible",
      position: { xMeters: 2, yMeters: 3 },
    });
    expect(nodes.some((node) => node.position.xMeters === 0)).toBe(false);
  });

  test("marks PAN mismatch and offline state from saved facts", () => {
    const selected = network("selected", 0x1234);
    const mismatch = anchor("mismatch", selected.id, {
      xMeters: 1,
      yMeters: 1,
    });
    mismatch.lastKnownConfig = {
      ...mismatch.lastKnownConfig!,
      panId: 0x9999,
    };
    mismatch.lastSeenAt = 1;
    const [node] = buildVisibleAnchorNodes({
      networks: [selected],
      devices: [mismatch],
      visibility,
      now: 20_000,
    });
    expect(node).toMatchObject({ panMismatch: true, status: "offline" });
  });

  test("exposes exactly one live direct tag while retaining other cached tags", () => {
    const selected = network("selected", 0x1234);
    const livePosition = { value: { xMeters: 10, yMeters: 11 } } as never;
    const cache = {
      one: { position: { xMeters: 1, yMeters: 2 }, receivedAt: 900 },
      two: { position: { xMeters: 3, yMeters: 4 }, receivedAt: 900 },
    };
    const nodes = buildVisibleTagNodes({
      networks: [selected],
      devices: [tag("one", selected.id), tag("two", selected.id)],
      cache,
      visibility,
      activeTagId: "one",
      activeSampleTagId: "one",
      livePosition,
      now: 1_000,
    });

    expect(nodes).toHaveLength(2);
    expect(nodes.find((node) => node.id === "one")?.livePosition).toBe(
      livePosition,
    );
    expect(
      nodes.find((node) => node.id === "two")?.livePosition,
    ).toBeUndefined();
    expect(
      buildVisibleTagNodes({
        networks: [selected],
        devices: [tag("missing", selected.id)],
        cache,
        visibility,
      }),
    ).toEqual([]);
  });

  test("draws ranging edges only for real distances resolving to visible anchors", () => {
    const edges = resolveRangingEdges(
      "tag",
      [
        { nodeId: 0xab, anchorKey: "00AB", distanceMeters: 2, quality: 90 },
        { nodeId: 0xcd, anchorKey: "00CD", distanceMeters: 3, quality: 80 },
        { nodeId: 0xab, anchorKey: "00AB", distanceMeters: 2, quality: 90 },
        {
          nodeId: 0xef,
          anchorKey: "00EF",
          distanceMeters: Number.NaN,
          quality: 0,
        },
      ],
      [
        {
          id: "anchor-ab",
          nodeIdHex: "AB",
          role: "anchor",
          position: { xMeters: 1, yMeters: 1 },
        },
      ],
    );
    expect(edges).toEqual([
      {
        sourceId: "tag",
        targetId: "anchor-ab",
        distanceMeters: 2,
        quality: 90,
      },
    ]);
  });

  test("clears or retains cached positions without fabricating samples", () => {
    const first = cacheTagPosition({}, "one", { xMeters: 1, yMeters: 2 }, 10);
    const both = cacheTagPosition(first, "two", { xMeters: 3, yMeters: 4 }, 20);
    expect(removeCachedTagPosition(both, "one")).toEqual({ two: both.two });
    expect(retainOnlyLiveTag(both, "two")).toEqual({ two: both.two });
    expect(retainOnlyLiveTag(both)).toEqual({});
  });
});

describe("manager map tracking diagnostics", () => {
  test("keeps exact map totals in refs and publishes React snapshots only while visible", async () => {
    let controller!: PansMapDataController;
    let streamOptions!: StartPansPositionStreamOptions;
    const stream = {
      start: jest.fn(async (options: StartPansPositionStreamOptions) => {
        streamOptions = options;
        options.onCounters?.(streamCounters(0));
      }),
      stop: jest.fn(async () => undefined),
    };
    const selectedNetwork = network("selected", 0x1234);
    mockManager = {
      networks: [selectedNetwork],
      devices: [tag("tag", selectedNetwork.id)],
      createPositionStream: jest.fn(() => stream),
      saveNetwork: jest.fn(),
      applyDeviceConfiguration: jest.fn(),
      refreshTopology: jest.fn(),
    };
    const Harness = () => {
      controller = usePansMapDataController();
      return null;
    };
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(Harness));
    });
    act(() => controller.setSelectedDirectTagId("tag"));
    await act(async () => controller.startDirectTracking());

    act(() => {
      streamOptions.onSample(positionSample(1));
      streamOptions.onSample(positionSample(2));
    });
    expect(controller.trackingCounters).toBeUndefined();

    act(() => controller.setTrackingDiagnosticsVisible(true));
    expect(controller.trackingCounters).toMatchObject({
      notificationEvents: 0,
      mapPositionUpdates: 2,
    });

    act(() => {
      streamOptions.onSample(positionSample(3));
      streamOptions.onSample(positionSample(4));
      streamOptions.onSample(positionSample(5));
    });
    expect(controller.trackingCounters?.mapPositionUpdates).toBe(2);
    act(() => streamOptions.onCounters?.(streamCounters(5)));
    expect(controller.trackingCounters).toMatchObject({
      notificationEvents: 5,
      mapPositionUpdates: 5,
    });

    act(() => controller.setTrackingDiagnosticsVisible(false));
    act(() => {
      streamOptions.onSample(positionSample(6));
      streamOptions.onCounters?.(streamCounters(6));
    });
    expect(controller.trackingCounters).toMatchObject({
      notificationEvents: 5,
      mapPositionUpdates: 5,
    });
    act(() => controller.setTrackingDiagnosticsVisible(true));
    expect(controller.trackingCounters).toMatchObject({
      notificationEvents: 6,
      mapPositionUpdates: 6,
    });

    await act(async () => tree.unmount());
  });
});

function network(id: string, panId: number): ManagedNetwork {
  return {
    id,
    name: id,
    panId,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
    createdAt: 1,
    updatedAt: 1,
  };
}

function anchor(
  id: string,
  networkId: string,
  position?: { xMeters: number; yMeters: number },
): ManagedDevice {
  return {
    id,
    networkId,
    transportDeviceId: `transport-${id}`,
    nodeIdHex: `node-${id}`,
    role: "anchor",
    lastKnownConfig: {
      role: "anchor",
      panId: 0x1234,
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
      ...(position
        ? { position: { ...position, zMeters: 2, quality: 100 } }
        : {}),
    },
    lastSeenAt: 1_000,
    createdAt: 1,
    updatedAt: 1,
  } as ManagedDevice;
}

function tag(id: string, networkId: string): ManagedDevice {
  return {
    id,
    networkId,
    transportDeviceId: `transport-${id}`,
    role: "tag",
    createdAt: 1,
    updatedAt: 1,
  };
}

function streamCounters(total: number): PansPositionStreamCounters {
  return {
    notificationEvents: total,
    matchingDeviceNotifications: total,
    filteredDeviceNotifications: 0,
    decodedFrames: total,
    decodeFailures: 0,
    positionFrames: total,
    distanceFrames: 0,
    diagnosticFrames: 0,
    emittedSamples: total,
    nativeSequenceDiscontinuities: 0,
  };
}

function positionSample(sequence: number): PansPositionStreamSample {
  return {
    deviceId: "tag",
    transportDeviceId: "transport-tag",
    receivedAt: sequence,
    source: "notification",
    nativeSequence: sequence,
    position: {
      xMeters: sequence,
      yMeters: sequence,
      zMeters: 0,
      quality: 100,
    },
    distances: [],
    diagnostics: [],
    decoderDiagnostics: [],
  };
}
