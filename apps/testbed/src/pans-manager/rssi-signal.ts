import {
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  type LucideIcon,
} from "lucide-react-native";

/** Selects the Lucide signal glyph for a discovery RSSI reading. */
export function getRssiSignalIcon(
  rssi: number | undefined,
  stale = false,
): LucideIcon {
  if (stale || rssi === undefined || !Number.isFinite(rssi)) return SignalZero;
  if (rssi <= -95) return SignalZero;
  if (rssi <= -85) return SignalLow;
  if (rssi <= -75) return SignalMedium;
  if (rssi <= -65) return SignalHigh;
  return Signal;
}
