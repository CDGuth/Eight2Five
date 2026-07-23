import {
  getCanonicalDeviceIdentifier,
  getDeviceDisplayName,
  getNetworkDisplayName,
} from "../display";
import { selectNetworkDeviceSections } from "../device-sections";
import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  ManagedNetwork,
} from "../types";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "../types";

describe("PANS manager display helpers", () => {
  test("computes canonical identifiers and hardware-derived display names", () => {
    const device = savedDevice("local", "transport", {
      nodeIdHex: " 00AF ",
      nickname: "  Drum Major  ",
      label: "hardware-label",
    });
    expect(getCanonicalDeviceIdentifier(device)).toBe("00AF");
    expect(getDeviceDisplayName(device)).toBe("hardware-label");
    expect(
      getDeviceDisplayName({
        ...device,
        lastKnownConfig: { ...anchorConfig(1), label: "  Cached label  " },
      }),
    ).toBe("Cached label");
    expect(
      getDeviceDisplayName({
        ...device,
        nodeIdHex: " ",
        label: " ",
        lastKnownConfig: undefined,
      }),
    ).toBe("Device transport");
    expect(
      getCanonicalDeviceIdentifier({
        ...device,
        id: " local-fallback ",
        nodeIdHex: " ",
        transportDeviceId: " ",
      }),
    ).toBe("local-fallback");
    expect(getNetworkDisplayName(savedNetwork("network", "  ", 0x2a))).toBe(
      "Network 0x002A",
    );
  });
});

describe("selectNetworkDeviceSections", () => {
  test("joins discoveries once, keeps all profiles, and derives cached PAN statuses", () => {
    const alpha = savedNetwork("alpha", " Alpha ", 1);
    const unnamed = savedNetwork("unnamed", "", 2);
    const empty = savedNetwork("z-empty", "Zulu", 3);
    const devices = [
      savedDevice("matching", "transport-matching", {
        networkId: unnamed.id,
        lastKnownConfig: { ...anchorConfig(1), label: "Bravo" },
      }),
      savedDevice("unverified", "transport-unverified", {
        networkId: alpha.id,
        label: "Alpha",
        lastKnownConfig: anchorConfig(undefined),
      }),
      savedDevice("mismatch", "transport-mismatch", {
        networkId: alpha.id,
        lastKnownConfig: anchorConfig(9),
      }),
      savedDevice("offline", "transport-offline", {
        networkId: unnamed.id,
        lastKnownConfig: anchorConfig(2),
      }),
      savedDevice("missing-profile", "transport-orphan", {
        networkId: "deleted-profile",
      }),
    ];
    const discoveries = [
      discovery("transport-matching", -80, 10),
      discovery("transport-matching", -40, 20),
      discovery("transport-unverified", -50, 20),
      discovery("transport-mismatch", -60, 20),
      discovery("transport-offline", -30, 20, true),
      discovery("transport-orphan", -70, 20),
      discovery("transport-new", -20, 20),
    ];

    const sections = selectNetworkDeviceSections(
      [empty, unnamed, alpha],
      devices,
      discoveries,
    );

    expect(sections.map((section) => section.key)).toEqual([
      "unassigned",
      "network:alpha",
      "network:unnamed",
      "network:z-empty",
    ]);
    expect(sections[3].devices).toEqual([]);
    expect(
      sections.flatMap((section) => section.devices).map((device) => device.id),
    ).toEqual(
      expect.arrayContaining([
        "matching",
        "unverified",
        "mismatch",
        "offline",
        "missing-profile",
        "transport-new",
      ]),
    );
    expect(sections.flatMap((section) => section.devices)).toHaveLength(6);

    const byId = new Map(
      sections
        .flatMap((section) => section.devices)
        .map((device) => [device.id, device]),
    );
    expect(byId.get("matching")).toMatchObject({
      status: "assigned-matching",
      cachedProfileMatchStatus: "matched",
      networkId: "alpha",
      available: true,
      rssi: -40,
    });
    expect(byId.get("unverified")).toMatchObject({
      status: "pan-unverified",
      cachedProfileMatchStatus: "unverified",
    });
    expect(byId.get("unverified")).not.toHaveProperty("networkId");
    expect(byId.get("mismatch")).toMatchObject({
      status: "unassigned",
      cachedProfileMatchStatus: "unassigned",
      cachedPanId: 9,
    });
    expect(byId.get("offline")).toMatchObject({
      status: "assigned-matching",
      available: false,
      networkId: "unnamed",
    });
    expect(byId.get("offline")).not.toHaveProperty("rssi");
    expect(byId.get("missing-profile")?.status).toBe("pan-unverified");
    expect(byId.get("transport-new")).toMatchObject({
      status: "unassigned",
      displayName: "Device transport-new",
      rssi: -20,
    });
    expect(sections[1].devices.map((device) => device.id)).toEqual([
      "matching",
    ]);
    expect(sections[0].devices.map((device) => device.id)).toEqual(
      expect.arrayContaining(["unverified", "mismatch", "missing-profile"]),
    );
  });

  test("keeps cached profile state separate from discovery availability", () => {
    const network = savedNetwork("network", "Network", 7);
    const sections = selectNetworkDeviceSections(
      [network],
      [
        savedDevice("device", "transport", {
          networkId: "stale-profile",
          lastKnownConfig: anchorConfig(99),
        }),
      ],
      [],
    );
    expect(sections[0].devices[0]).toMatchObject({
      status: "unassigned",
      available: false,
      cachedPanId: 99,
    });
  });

  test("places duplicate-PAN devices in unassigned with conflict metadata", () => {
    const alpha = savedNetwork("alpha", "Alpha", 7);
    const beta = savedNetwork("beta", "Beta", 7);
    const sections = selectNetworkDeviceSections(
      [beta, alpha],
      [
        savedDevice("device", "transport", {
          networkId: alpha.id,
          lastKnownConfig: anchorConfig(7),
        }),
      ],
      [discovery("transport", -45, 10)],
    );
    expect(sections[0].devices[0]).toMatchObject({
      status: "pan-conflict",
      cachedProfileMatchStatus: "conflict",
      cachedPanId: 7,
      matchingNetworkIds: ["alpha", "beta"],
    });
    expect(sections[0].devices[0]).not.toHaveProperty("networkId");
  });
});

function savedNetwork(id: string, name: string, panId: number): ManagedNetwork {
  return {
    id,
    name,
    panId,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
    createdAt: 1,
    updatedAt: 1,
  };
}

function savedDevice(
  id: string,
  transportDeviceId: string,
  patch: Partial<ManagedDevice> = {},
): ManagedDevice {
  return {
    id,
    transportDeviceId,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

function discovery(
  transportDeviceId: string,
  rssi: number,
  lastSeenAt: number,
  stale = false,
): DiscoveredDeviceSnapshot {
  return {
    transportDeviceId,
    rssi,
    lastSeenAt,
    stale,
    compatibility: "compatible",
  };
}

function anchorConfig(panId: number | undefined) {
  return {
    role: "anchor" as const,
    ...(panId !== undefined ? { panId } : {}),
    uwbMode: "active" as const,
    ledEnabled: true,
    firmwareUpdateEnabled: false,
    initiatorEnabled: false,
  };
}
