import {
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
} from "lucide-react-native";

import { getRssiSignalIcon } from "../rssi-signal";

describe("getRssiSignalIcon", () => {
  test.each([
    [undefined, false, SignalZero],
    [Number.NaN, false, SignalZero],
    [Number.POSITIVE_INFINITY, false, SignalZero],
    [-64, true, SignalZero],
    [-96, false, SignalZero],
    [-95, false, SignalZero],
    [-94, false, SignalLow],
    [-85, false, SignalLow],
    [-84, false, SignalMedium],
    [-75, false, SignalMedium],
    [-74, false, SignalHigh],
    [-65, false, SignalHigh],
    [-64, false, Signal],
  ])(
    "maps RSSI %p (stale %p) to the exact signal icon",
    (rssi, stale, icon) => {
      expect(getRssiSignalIcon(rssi, stale)).toBe(icon);
    },
  );
});
