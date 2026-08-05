import {
  Activity,
  CircleDot,
  Flag,
  Music2,
  Shapes,
  Sparkles,
  Star,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react-native";

/**
 * Only icons in this explicit registry may be resolved from imported
 * metadata. Drill files are data, so their icon name must never be evaluated
 * as a component lookup at runtime.
 */
export const DRILL_ICON_REGISTRY = Object.freeze({
  activity: Activity,
  "circle-dot": CircleDot,
  flag: Flag,
  "music-2": Music2,
  shapes: Shapes,
  sparkles: Sparkles,
  star: Star,
  trophy: Trophy,
  zap: Zap,
} satisfies Readonly<Record<string, LucideIcon>>);

export type DrillIconName = keyof typeof DRILL_ICON_REGISTRY;

export const DRILL_ICON_NAMES = Object.freeze(
  Object.keys(DRILL_ICON_REGISTRY) as DrillIconName[],
);

export const FALLBACK_DRILL_ICON: LucideIcon = CircleDot;

export function resolveDrillIcon(iconName: string | undefined): LucideIcon {
  if (!iconName) return FALLBACK_DRILL_ICON;
  return DRILL_ICON_REGISTRY[iconName as DrillIconName] ?? FALLBACK_DRILL_ICON;
}

export function isSupportedDrillIcon(
  iconName: string | undefined,
): iconName is DrillIconName {
  return iconName !== undefined && iconName in DRILL_ICON_REGISTRY;
}
