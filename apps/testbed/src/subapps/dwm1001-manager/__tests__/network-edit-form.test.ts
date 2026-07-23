import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  type ManagedNetwork,
} from "@eight2five/mobile/pans-manager/types";

import {
  reviewNetworkEdit,
  stablePanMigrationOperationId,
} from "../network-edit-form";

describe("network edit review", () => {
  test("parses hexadecimal PAN and creates the required confirmation summary", () => {
    expect(reviewNetworkEdit(network("one", 1), "0x00A0", [], 5, 3)).toEqual({
      targetPanId: 160,
      confirmation: {
        oldPanId: 1,
        newPanId: 160,
        affectedMemberCount: 5,
        availableMemberCount: 3,
      },
    });
  });

  test("rejects duplicate profile PAN before migration review", () => {
    expect(() =>
      reviewNetworkEdit(
        network("one", 1),
        "2",
        [network("one", 1), network("two", 2)],
        1,
        1,
      ),
    ).toThrow("already uses that PAN ID");
  });

  test("rejects the PANS default PAN 0 from saved network profiles", () => {
    expect(() =>
      reviewNetworkEdit(network("one", 1), "0", [network("one", 1)], 1, 1),
    ).toThrow("PAN 0 is the PANS default used for unassigned devices");
  });

  test("reuses one stable operation ID for partial/cancelled retries", () => {
    const createId = jest.fn(() => "stable-operation");
    const first = stablePanMigrationOperationId(undefined, createId);
    const retry = stablePanMigrationOperationId(first, createId);
    expect(first).toBe("stable-operation");
    expect(retry).toBe(first);
    expect(createId).toHaveBeenCalledTimes(1);
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
