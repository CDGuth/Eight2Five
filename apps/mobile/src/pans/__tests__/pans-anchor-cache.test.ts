import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import {
  areDevicesNetworkAssociated,
  cachedAnchorGeometry,
  selectNetworkAnchors,
} from "../pans-anchor-cache";

const base = {
  transportDeviceId: "transport",
  createdAt: 1,
  updatedAt: 1,
};

describe("network-associated anchor cache", () => {
  test("never mixes geometry from another saved network", () => {
    const tag = {
      ...base,
      id: "tag",
      role: "tag" as const,
      networkId: "network-a",
    };
    const anchors = [
      anchor("a", "network-a", 1),
      anchor("b", "network-b", 2),
      anchor("unassociated", undefined, 3),
    ];

    expect(selectNetworkAnchors(tag, anchors).map((item) => item.id)).toEqual([
      "a",
    ]);
    expect(cachedAnchorGeometry(tag, anchors)).toEqual([
      {
        id: "a",
        position: { xMeters: 1, yMeters: 2, zMeters: 3 },
      },
    ]);
    expect(areDevicesNetworkAssociated(tag, anchors[0])).toBe(true);
    expect(areDevicesNetworkAssociated(tag, anchors[1])).toBe(false);
  });

  test("falls back to equal verified PAN IDs and otherwise hides geometry", () => {
    const tag = {
      ...base,
      id: "tag",
      role: "tag" as const,
      lastKnownConfig: tagConfig(44),
    };
    const anchors = [
      anchor("same", undefined, 1, 44),
      anchor("other", undefined, 2, 45),
    ];
    expect(selectNetworkAnchors(tag, anchors).map((item) => item.id)).toEqual([
      "same",
    ]);
    expect(
      selectNetworkAnchors({ ...tag, lastKnownConfig: tagConfig() }, anchors),
    ).toEqual([]);
  });
});

function anchor(
  id: string,
  networkId: string | undefined,
  xMeters: number,
  panId = 44,
): ManagedDevice {
  return {
    ...base,
    id,
    ...(networkId ? { networkId } : {}),
    role: "anchor",
    lastKnownConfig: {
      role: "anchor",
      panId,
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
      position: { xMeters, yMeters: 2, zMeters: 3, quality: 100 },
    },
  };
}

function tagConfig(panId?: number) {
  return {
    role: "tag" as const,
    ...(panId === undefined ? {} : { panId }),
    uwbMode: "active" as const,
    ledEnabled: true,
    firmwareUpdateEnabled: false,
    locationEngineEnabled: true,
    lowPowerModeEnabled: false,
    stationaryDetectionEnabled: true,
  };
}
