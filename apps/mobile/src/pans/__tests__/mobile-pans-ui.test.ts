import type { DiscoveredDeviceSnapshot } from "@eight2five/mobile/pans-manager";
import {
  connectionStatusViewModel,
  selectVisibleDiscoveries,
  signalStrengthForRssi,
} from "../mobile-pans-ui";

const tag = discovery("tag", "tag", -60);
const anchor = discovery("anchor", "anchor", -55);

describe("mobile PANS UI selectors", () => {
  test.each([
    ["connected", "Connected", "connected", false],
    ["scanning", "Searching", "searching", true],
    ["connecting", "Connecting", "connecting", false],
    ["reconnecting", "Reconnecting", "connecting", false],
    ["disconnected", "Disconnected", "disconnected", false],
    ["error", "Connection error", "error", false],
  ] as const)("maps %s status", (state, label, icon, animated) => {
    expect(connectionStatusViewModel(state)).toMatchObject({
      label,
      icon,
      animated,
    });
  });

  test("ordinary mode filters anchors and weak advertisements", () => {
    expect(
      selectVisibleDiscoveries(
        [tag, anchor, { ...tag, transportDeviceId: "weak", rssi: -80 }],
        {
          developerMode: false,
          cutoff: -75,
        },
      ).map((item) => item.transportDeviceId),
    ).toEqual(["tag"]);
  });

  test("developer mode includes anchors and sorts by raw RSSI", () => {
    expect(
      selectVisibleDiscoveries([tag, anchor], {
        developerMode: true,
        cutoff: -75,
      }).map((item) => item.transportDeviceId),
    ).toEqual(["anchor", "tag"]);
  });

  test("derives signal bands relative to cutoff", () => {
    expect(signalStrengthForRssi(-75, -75)).toBe("low");
    expect(signalStrengthForRssi(-65, -75)).toBe("medium");
    expect(signalStrengthForRssi(-50, -75)).toBe("high");
    expect(signalStrengthForRssi(-35, -75)).toBe("full");
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
