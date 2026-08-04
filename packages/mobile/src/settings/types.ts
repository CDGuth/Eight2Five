import { isFieldPresetId, type FieldPresetId } from "@eight2five/drill-schema";

export type FieldPerspective = "director" | "performer";
export type TransitionMetricMode = "step-size" | "crossing-counts";

export const DEFAULT_COMFORTABLE_ANCHOR_RANGE_METERS = 20;
export const MAX_COMFORTABLE_ANCHOR_RANGE_METERS = 200;

/** App preferences plus persisted drill/set selection pointers. */
export interface AppSettings {
  readonly drillFeaturesEnabled: boolean;
  /** @deprecated Drill terminology is fixed to Sets. */
  readonly drillTerminology: "sets";
  readonly fieldPerspective: FieldPerspective;
  readonly defaultFieldPreset: FieldPresetId;
  readonly transitionMetricMode: TransitionMetricMode;
  readonly guidanceEnabled: boolean;
  readonly developerModeEnabled: boolean;
  readonly showCachedAnchorGeometry: boolean;
  readonly showComfortableAnchorRange: boolean;
  readonly showPerimeterStepGrid: boolean;
  readonly comfortableAnchorRangeMeters: number;
  readonly activeDrillId: string | null;
  readonly selectedDrillSetId: string | null;
  /** @deprecated Use selectedDrillSetId. */
  readonly selectedDrillPageId: string | null;
}

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  drillFeaturesEnabled: true,
  drillTerminology: "sets",
  fieldPerspective: "director",
  defaultFieldPreset: "football-nfhs",
  transitionMetricMode: "step-size",
  guidanceEnabled: true,
  developerModeEnabled: false,
  showCachedAnchorGeometry: false,
  showComfortableAnchorRange: false,
  showPerimeterStepGrid: false,
  comfortableAnchorRangeMeters: DEFAULT_COMFORTABLE_ANCHOR_RANGE_METERS,
  activeDrillId: null,
  selectedDrillSetId: null,
  selectedDrillPageId: null,
});

export const APP_PREFERENCE_KEYS = Object.freeze([
  "drillFeaturesEnabled",
  "fieldPerspective",
  "defaultFieldPreset",
  "transitionMetricMode",
  "guidanceEnabled",
  "developerModeEnabled",
  "showCachedAnchorGeometry",
  "showComfortableAnchorRange",
  "showPerimeterStepGrid",
  "comfortableAnchorRangeMeters",
] as const satisfies readonly (keyof AppSettings)[]);

export type AppPreferenceKey = (typeof APP_PREFERENCE_KEYS)[number];
export type AppSettingsUpdate = Partial<Pick<AppSettings, AppPreferenceKey>>;

export interface AppSettingsRepository {
  load(): Promise<AppSettings>;
  update(partial: AppSettingsUpdate): Promise<AppSettings>;
  resetPreferences(): Promise<AppSettings>;
}

/** Normalize untrusted persisted settings at the storage boundary. */
export function normalizeAppSettings(value?: unknown): AppSettings {
  const candidate = isRecord(value) ? value : {};
  const activeDrillId = nullableIdOrNull(candidate.activeDrillId);
  return {
    drillFeaturesEnabled: booleanOrDefault(
      candidate.drillFeaturesEnabled,
      DEFAULT_APP_SETTINGS.drillFeaturesEnabled,
    ),
    drillTerminology: "sets",
    fieldPerspective:
      candidate.fieldPerspective === "director" ||
      candidate.fieldPerspective === "performer"
        ? candidate.fieldPerspective
        : DEFAULT_APP_SETTINGS.fieldPerspective,
    defaultFieldPreset: isFieldPresetId(candidate.defaultFieldPreset)
      ? candidate.defaultFieldPreset
      : DEFAULT_APP_SETTINGS.defaultFieldPreset,
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
    showPerimeterStepGrid: booleanOrDefault(
      candidate.showPerimeterStepGrid,
      DEFAULT_APP_SETTINGS.showPerimeterStepGrid,
    ),
    comfortableAnchorRangeMeters: positiveFiniteOrDefault(
      candidate.comfortableAnchorRangeMeters,
      DEFAULT_APP_SETTINGS.comfortableAnchorRangeMeters,
    ),
    activeDrillId,
    selectedDrillSetId:
      activeDrillId === null
        ? null
        : nullableIdOrNull(
            candidate.selectedDrillSetId ?? candidate.selectedDrillPageId,
          ),
    selectedDrillPageId:
      activeDrillId === null
        ? null
        : nullableIdOrNull(
            candidate.selectedDrillSetId ?? candidate.selectedDrillPageId,
          ),
  };
}

export function getEffectiveAppSettings(value: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(value);
  if (normalized.developerModeEnabled) return normalized;
  return {
    ...normalized,
    showCachedAnchorGeometry: false,
    showComfortableAnchorRange: false,
    showPerimeterStepGrid: false,
  };
}

export const selectEffectiveSettings = getEffectiveAppSettings;
export const getEffectiveSettings = getEffectiveAppSettings;
export const selectEffectiveAppSettings = getEffectiveAppSettings;

export interface EffectiveDeveloperOverlaySettings {
  readonly showCachedAnchorGeometry: boolean;
  readonly showComfortableAnchorRange: boolean;
  readonly showPerimeterStepGrid: boolean;
}

export function getEffectiveDeveloperOverlaySettings(
  value: AppSettings,
): EffectiveDeveloperOverlaySettings {
  const settings = getEffectiveAppSettings(value);
  return {
    showCachedAnchorGeometry: settings.showCachedAnchorGeometry,
    showComfortableAnchorRange:
      settings.showCachedAnchorGeometry && settings.showComfortableAnchorRange,
    showPerimeterStepGrid: settings.showPerimeterStepGrid,
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

export function selectShowPerimeterStepGrid(value: AppSettings): boolean {
  return getEffectiveAppSettings(value).showPerimeterStepGrid;
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
    value <= MAX_COMFORTABLE_ANCHOR_RANGE_METERS
    ? value
    : fallback;
}

function nullableIdOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
