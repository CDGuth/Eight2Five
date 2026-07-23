import {
  reconcileDeviceCachedProfileMatch,
  resolveCachedProfileMatch,
} from "../profile-matching";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  type ManagedDevice,
  type ManagedNetwork,
} from "../types";

describe("cached PANS profile matching", () => {
  const alpha = network("alpha", 0x1234);
  const beta = network("beta", 0x5678);

  test("distinguishes unverified, unassigned, and unique hardware PAN matches", () => {
    expect(resolveCachedProfileMatch([alpha, beta], undefined)).toEqual({
      status: "unverified",
      matchingNetworkIds: [],
    });
    expect(resolveCachedProfileMatch([alpha, beta], 0xabcd)).toEqual({
      status: "unassigned",
      panId: 0xabcd,
      matchingNetworkIds: [],
    });
    expect(resolveCachedProfileMatch([alpha, beta], 0x5678)).toEqual({
      status: "matched",
      panId: 0x5678,
      networkId: "beta",
      matchingNetworkIds: ["beta"],
    });
  });

  test("reports every duplicate-PAN profile as a deterministic conflict", () => {
    const duplicate = network("aardvark", 0x1234);
    expect(resolveCachedProfileMatch([alpha, beta, duplicate], 0x1234)).toEqual(
      {
        status: "conflict",
        panId: 0x1234,
        matchingNetworkIds: ["aardvark", "alpha"],
      },
    );
  });

  test("reconciles and clears only stale cached profile IDs", () => {
    const device = savedDevice("stale", 0x5678);
    expect(
      reconcileDeviceCachedProfileMatch(device, [alpha, beta], 10),
    ).toEqual({
      ...device,
      networkId: "beta",
      updatedAt: 10,
    });

    const matched = { ...device, networkId: "beta" };
    expect(reconcileDeviceCachedProfileMatch(matched, [alpha, beta], 20)).toBe(
      matched,
    );

    const conflicted = reconcileDeviceCachedProfileMatch(
      { ...device, networkId: "alpha" },
      [alpha, network("duplicate", 0x5678), beta],
      30,
    );
    expect(conflicted).toMatchObject({ id: "device", updatedAt: 30 });
    expect(conflicted).not.toHaveProperty("networkId");
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

function savedDevice(networkId: string, panId: number): ManagedDevice {
  return {
    id: "device",
    networkId,
    transportDeviceId: "transport",
    lastKnownConfig: {
      role: "anchor",
      panId,
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
    },
    createdAt: 1,
    updatedAt: 1,
  };
}
