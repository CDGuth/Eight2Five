import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
} from "@eight2five/mobile/pans-manager";

import {
  anchorInitiatorLabel,
  commissioningWarningText,
  selectAssociatedCachedAnchors,
  selectNetworkAnchorDiscoveries,
} from "../network-ui";

describe("mobile network commissioning presentation", () => {
  test("keeps associated cached anchors and presents initiator state", () => {
    const associated = anchor("one", "network-a", true);
    const unrelated = anchor("two", "network-b", false);

    expect(
      selectAssociatedCachedAnchors("network-a", [associated, unrelated]),
    ).toEqual([associated]);
    expect(anchorInitiatorLabel(associated)).toBe("Yes");
    expect(anchorInitiatorLabel(anchor("unknown", undefined, false))).toBe(
      "No",
    );
    expect(
      anchorInitiatorLabel({ ...associated, lastKnownConfig: undefined }),
    ).toBe("Unknown");
  });

  test("starts with current compatible discoveries and keeps uncached anchors", () => {
    const cached = anchor("cached", "network-a", false);
    const rows = selectNetworkAnchorDiscoveries(
      [
        discovery("uncached", "anchor", -50),
        discovery("cached", "anchor", -60),
        discovery("tag", "tag", -55),
        { ...discovery("stale", "anchor", -40), stale: true },
        { ...discovery("weak", "anchor", -90) },
        { ...discovery("bad", "anchor", -45), compatibility: "incompatible" },
      ],
      [cached],
      -75,
    );

    expect(rows.map((row) => row.discovery.transportDeviceId)).toEqual([
      "uncached",
      "tag",
      "cached",
    ]);
    expect(rows[0].cachedAnchor).toBeUndefined();
    expect(rows[1].requiresRoleChangeConfirmation).toBe(true);
    expect(rows[2].cachedAnchor).toBe(cached);
    expect(rows[2].requiresRoleChangeConfirmation).toBe(false);
  });

  test("does not invent a success message when verification is incomplete", () => {
    const warning = "Initiator set, but one prior anchor was unreachable.";
    expect(commissioningWarningText(warning)).toBe(warning);
    expect(commissioningWarningText("  ")).toBeUndefined();
    expect(commissioningWarningText(undefined)).toBeUndefined();
  });
});

function discovery(
  transportDeviceId: string,
  role: "tag" | "anchor",
  rssi: number,
): DiscoveredDeviceSnapshot {
  return {
    transportDeviceId,
    name: transportDeviceId,
    rssi,
    lastSeenAt: 1,
    compatibility: "compatible",
    presence: { role } as never,
  };
}

function anchor(
  id: string,
  networkId: string | undefined,
  initiatorEnabled: boolean,
): ManagedDevice {
  return {
    id,
    networkId,
    transportDeviceId: id,
    role: "anchor",
    lastKnownConfig: {
      role: "anchor",
      uwbMode: "active",
      initiatorEnabled,
      ledEnabled: true,
      firmwareUpdateEnabled: true,
    },
    createdAt: 1,
    updatedAt: 1,
  };
}
