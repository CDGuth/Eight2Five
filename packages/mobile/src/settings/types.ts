import { isFieldPresetId, type FieldPresetId } from "@eight2five/drill-schema";
import type { DrillTerminology } from "../drill/terminology";

export type FieldPerspective = "director" | "performer";
export type AppearanceMode = "system" | "light" | "dark";
export type TransitionMetricMode = "step-size" | "crossing-counts";

export const DEFAULT_COMFORTABLE_ANCHOR_RANGE_METERS = 20;
export const MAX_COMFORTABLE_ANCHOR_RANGE_METERS = 200;
export const MIN_TRANSITION_SET_COUNT = 0;
export const MAX_TRANSITION_SET_COUNT = 50;
export const DEFAULT_DISTANCE_GREEN_THRESHOLD_STEPS = 0.5;
export const DEFAULT_DISTANCE_YELLOW_THRESHOLD_STEPS = 1;

/** App preferences plus persisted drill/set selection pointers. */
export interface AppSettings {
  readonly appearanceMode: AppearanceMode;
  readonly drillFeaturesEnabled: boolean;
  readonly drillTerminology: DrillTerminology;
  readonly fieldPerspective: FieldPerspective;
  readonly defaultFieldPreset: FieldPresetId;
  readonly transitionMetricMode: TransitionMetricMode;
  readonly guidanceEnabled: boolean;
  readonly developerModeEnabled: boolean;
  readonly showCachedAnchorGeometry: boolean;
  readonly showComfortableAnchorRange: boolean;
  readonly showPerimeterStepGrid: boolean;
  readonly showAuxiliaryFieldMarks: boolean;
  readonly showPerformerLabels: boolean;
  readonly showPerformerNames: boolean;
  readonly showPropLabels: boolean;
  readonly showPropNames: boolean;
  readonly showTransitionMarkers: boolean;
  readonly showAllTransitionSets: boolean;
  readonly previousTransitionSetCount: number;
  readonly nextTransitionSetCount: number;
  readonly distanceGreenThresholdSteps: number;
  readonly distanceYellowThresholdSteps: number;
  readonly motionInterpolationEnabled: boolean;
  readonly comfortableAnchorRangeMeters: number;
  readonly activeDrillId: string | null;
  readonly selectedDrillSetId: string | null;
  /** @deprecated Use selectedDrillSetId. */
  readonly selectedDrillPageId: string | null;
}

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  appearanceMode: "system",
  drillFeaturesEnabled: true,
  drillTerminology: "sets",
  fieldPerspective: "performer",
  defaultFieldPreset: "football-nfhs",
  transitionMetricMode: "step-size",
  guidanceEnabled: true,
  developerModeEnabled: false,
  showCachedAnchorGeometry: false,
  showComfortableAnchorRange: false,
  showPerimeterStepGrid: false,
  showAuxiliaryFieldMarks: true,
  showPerformerLabels: true,
  showPerformerNames: false,
  showPropLabels: true,
  showPropNames: false,
  showTransitionMarkers: true,
  showAllTransitionSets: false,
  previousTransitionSetCount: 1,
  nextTransitionSetCount: 1,
  distanceGreenThresholdSteps: DEFAULT_DISTANCE_GREEN_THRESHOLD_STEPS,
  distanceYellowThresholdSteps: DEFAULT_DISTANCE_YELLOW_THRESHOLD_STEPS,
  motionInterpolationEnabled: true,
  comfortableAnchorRangeMeters: DEFAULT_COMFORTABLE_ANCHOR_RANGE_METERS,
  activeDrillId: null,
  selectedDrillSetId: null,
  selectedDrillPageId: null,
});

export const APP_PREFERENCE_KEYS = Object.freeze([
  "appearanceMode",
  "drillFeaturesEnabled",
  "drillTerminology",
  "fieldPerspective",
  "defaultFieldPreset",
  "transitionMetricMode",
  "guidanceEnabled",
  "developerModeEnabled",
  "showCachedAnchorGeometry",
  "showComfortableAnchorRange",
  "showPerimeterStepGrid",
  "showAuxiliaryFieldMarks",
  "showPerformerLabels",
  "showPerformerNames",
  "showPropLabels",
  "showPropNames",
  "showTransitionMarkers",
  "showAllTransitionSets",
  "previousTransitionSetCount",
  "nextTransitionSetCount",
  "distanceGreenThresholdSteps",
  "distanceYellowThresholdSteps",
  "motionInterpolationEnabled",
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
  const distanceThresholds = normalizeDistanceThresholds(
    candidate.distanceGreenThresholdSteps,
    candidate.distanceYellowThresholdSteps,
  );
  return {
    appearanceMode:
      candidate.appearanceMode === "system" ||
      candidate.appearanceMode === "light" ||
      candidate.appearanceMode === "dark"
        ? candidate.appearanceMode
        : DEFAULT_APP_SETTINGS.appearanceMode,
    drillFeaturesEnabled: booleanOrDefault(
      candidate.drillFeaturesEnabled,
      DEFAULT_APP_SETTINGS.drillFeaturesEnabled,
    ),
    drillTerminology:
      candidate.drillTerminology === "sets" ||
      candidate.drillTerminology === "pages"
        ? candidate.drillTerminology
        : DEFAULT_APP_SETTINGS.drillTerminology,
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
    showAuxiliaryFieldMarks: booleanOrDefault(
      candidate.showAuxiliaryFieldMarks,
      DEFAULT_APP_SETTINGS.showAuxiliaryFieldMarks,
    ),
    showPerformerLabels: booleanOrDefault(
      candidate.showPerformerLabels,
      DEFAULT_APP_SETTINGS.showPerformerLabels,
    ),
    showPerformerNames: booleanOrDefault(
      candidate.showPerformerNames,
      DEFAULT_APP_SETTINGS.showPerformerNames,
    ),
    showPropLabels: booleanOrDefault(
      candidate.showPropLabels,
      DEFAULT_APP_SETTINGS.showPropLabels,
    ),
    showPropNames: booleanOrDefault(
      candidate.showPropNames,
      DEFAULT_APP_SETTINGS.showPropNames,
    ),
    showTransitionMarkers: booleanOrDefault(
      candidate.showTransitionMarkers,
      DEFAULT_APP_SETTINGS.showTransitionMarkers,
    ),
    showAllTransitionSets: booleanOrDefault(
      candidate.showAllTransitionSets,
      DEFAULT_APP_SETTINGS.showAllTransitionSets,
    ),
    previousTransitionSetCount: boundedIntegerOrDefault(
      candidate.previousTransitionSetCount,
      DEFAULT_APP_SETTINGS.previousTransitionSetCount,
      MIN_TRANSITION_SET_COUNT,
      MAX_TRANSITION_SET_COUNT,
    ),
    nextTransitionSetCount: boundedIntegerOrDefault(
      candidate.nextTransitionSetCount,
      DEFAULT_APP_SETTINGS.nextTransitionSetCount,
      MIN_TRANSITION_SET_COUNT,
      MAX_TRANSITION_SET_COUNT,
    ),
    distanceGreenThresholdSteps: distanceThresholds.green,
    distanceYellowThresholdSteps: distanceThresholds.yellow,
    motionInterpolationEnabled: booleanOrDefault(
      candidate.motionInterpolationEnabled,
      DEFAULT_APP_SETTINGS.motionInterpolationEnabled,
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

function boundedIntegerOrDefault(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeDistanceThresholds(
  greenValue: unknown,
  yellowValue: unknown,
): { green: number; yellow: number } {
  const green = nonNegativeFiniteOrDefault(
    greenValue,
    DEFAULT_APP_SETTINGS.distanceGreenThresholdSteps,
  );
  const yellow = nonNegativeFiniteOrDefault(
    yellowValue,
    DEFAULT_APP_SETTINGS.distanceYellowThresholdSteps,
  );
  return { green: Math.min(green, yellow), yellow };
}

function nonNegativeFiniteOrDefault(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

function nullableIdOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
