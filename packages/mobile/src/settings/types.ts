import type { DrillTerminology } from "../drill/terminology";

export type FieldPerspective = "director" | "performer";
export type TransitionMetricMode = "step-size" | "crossing-counts";

/**
 * App preferences and the two persisted selection pointers.
 *
 * The selection pointers live in the same singleton row as preferences so a
 * drill screen can restore its place without introducing another storage
 * mechanism. They are intentionally not part of resetPreferences().
 */
export interface AppSettings {
  readonly drillFeaturesEnabled: boolean;
  readonly drillTerminology: DrillTerminology;
  readonly fieldPerspective: FieldPerspective;
  readonly transitionMetricMode: TransitionMetricMode;
  readonly guidanceEnabled: boolean;
  readonly developerModeEnabled: boolean;
  readonly showCachedAnchorGeometry: boolean;
  readonly showComfortableAnchorRange: boolean;
  readonly comfortableAnchorRangeMeters: number;
  readonly activeDrillId: string | null;
  readonly selectedDrillPageId: string | null;
}

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  drillFeaturesEnabled: true,
  drillTerminology: "pages",
  fieldPerspective: "director",
  transitionMetricMode: "step-size",
  guidanceEnabled: true,
  developerModeEnabled: false,
  showCachedAnchorGeometry: false,
  showComfortableAnchorRange: false,
  comfortableAnchorRangeMeters: 20,
  activeDrillId: null,
  selectedDrillPageId: null,
});

/** The preferences reset by resetPreferences, in their public contract order. */
export const APP_PREFERENCE_KEYS = Object.freeze([
  "drillFeaturesEnabled",
  "drillTerminology",
  "fieldPerspective",
  "transitionMetricMode",
  "guidanceEnabled",
  "developerModeEnabled",
  "showCachedAnchorGeometry",
  "showComfortableAnchorRange",
  "comfortableAnchorRangeMeters",
] as const satisfies readonly (keyof AppSettings)[]);

export type AppPreferenceKey = (typeof APP_PREFERENCE_KEYS)[number];
export type AppSettingsUpdate = Partial<Pick<AppSettings, AppPreferenceKey>>;

export interface AppSettingsRepository {
  load(): Promise<AppSettings>;
  update(partial: AppSettingsUpdate): Promise<AppSettings>;
  resetPreferences(): Promise<AppSettings>;
}

/**
 * Normalize values at every storage boundary. Invalid values fall back to the
 * field default rather than leaking malformed persisted data to a caller.
 */
export function normalizeAppSettings(value?: unknown): AppSettings {
  const candidate = isRecord(value) ? value : {};
  const activeDrillId = nullableIdOrNull(candidate.activeDrillId);
  return {
    drillFeaturesEnabled: booleanOrDefault(
      candidate.drillFeaturesEnabled,
      DEFAULT_APP_SETTINGS.drillFeaturesEnabled,
    ),
    drillTerminology:
      candidate.drillTerminology === "pages" ||
      candidate.drillTerminology === "sets"
        ? candidate.drillTerminology
        : DEFAULT_APP_SETTINGS.drillTerminology,
    fieldPerspective:
      candidate.fieldPerspective === "director" ||
      candidate.fieldPerspective === "performer"
        ? candidate.fieldPerspective
        : DEFAULT_APP_SETTINGS.fieldPerspective,
    transitionMetricMode:
      candidate.transitionMetricMode === "step-size" ||
      candidate.transitionMetricMode === "crossing-counts"
        ? candidate.transitionMetricMode
        : DEFAULT_APP_SETTINGS.transitionMetricMode,
    guidanceEnabled: booleanOrDefault(
      candidate.guidanceEnabled,
      DEFAULT_APP_SETTINGS.guidanceEnabled,
    ),
    developerModeEnabled: booleanOrDefault(
      candidate.developerModeEnabled,
      DEFAULT_APP_SETTINGS.developerModeEnabled,
    ),
    showCachedAnchorGeometry: booleanOrDefault(
      candidate.showCachedAnchorGeometry,
      DEFAULT_APP_SETTINGS.showCachedAnchorGeometry,
    ),
    showComfortableAnchorRange: booleanOrDefault(
      candidate.showComfortableAnchorRange,
      DEFAULT_APP_SETTINGS.showComfortableAnchorRange,
    ),
    comfortableAnchorRangeMeters: positiveFiniteOrDefault(
      candidate.comfortableAnchorRangeMeters,
      DEFAULT_APP_SETTINGS.comfortableAnchorRangeMeters,
    ),
    activeDrillId,
    selectedDrillPageId:
      activeDrillId === null
        ? null
        : nullableIdOrNull(candidate.selectedDrillPageId),
  };
}

/**
 * Return settings as they may be used by UI. Developer overlay preferences
 * remain persisted separately, but are ineffective while developer mode is
 * disabled.
 */
export function getEffectiveAppSettings(value: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(value);
  if (normalized.developerModeEnabled) return normalized;
  return {
    ...normalized,
    showCachedAnchorGeometry: false,
    showComfortableAnchorRange: false,
  };
}

/** Alias with selector-oriented naming for store consumers. */
export const selectEffectiveSettings = getEffectiveAppSettings;
export const getEffectiveSettings = getEffectiveAppSettings;
export const selectEffectiveAppSettings = getEffectiveAppSettings;

export interface EffectiveDeveloperOverlaySettings {
  readonly showCachedAnchorGeometry: boolean;
  readonly showComfortableAnchorRange: boolean;
}

export function getEffectiveDeveloperOverlaySettings(
  value: AppSettings,
): EffectiveDeveloperOverlaySettings {
  const settings = getEffectiveAppSettings(value);
  return {
    showCachedAnchorGeometry: settings.showCachedAnchorGeometry,
    showComfortableAnchorRange:
      settings.showCachedAnchorGeometry && settings.showComfortableAnchorRange,
  };
}

export const selectEffectiveDeveloperOverlaySettings =
  getEffectiveDeveloperOverlaySettings;

export function selectShowCachedAnchorGeometry(value: AppSettings): boolean {
  return getEffectiveAppSettings(value).showCachedAnchorGeometry;
}

export function selectShowComfortableAnchorRange(value: AppSettings): boolean {
  return getEffectiveAppSettings(value).showComfortableAnchorRange;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function positiveFiniteOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 200
    ? value
    : fallback;
}

function nullableIdOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
