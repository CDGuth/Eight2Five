import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import { getDeveloperAnchorDisplayName } from "../anchor-display";

const anchor = (overrides: Partial<ManagedDevice> = {}): ManagedDevice => ({
  id: "anchor-id",
  transportDeviceId: "transport-id",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("developer anchor display names", () => {
  test("prefers the local name and falls back to hardware identifiers", () => {
    expect(
      getDeveloperAnchorDisplayName(
        anchor({ nickname: "  Front 50  ", nodeIdHex: "A001", label: "HW" }),
      ),
    ).toBe("Front 50");
    expect(getDeveloperAnchorDisplayName(anchor({ nodeIdHex: "A001" }))).toBe(
      "A001",
    );
    expect(getDeveloperAnchorDisplayName(anchor({ label: "HW" }))).toBe("HW");
    expect(getDeveloperAnchorDisplayName(anchor())).toBe("anchor-id");
  });
});
