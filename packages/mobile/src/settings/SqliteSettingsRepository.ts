import type { SQLiteDatabase } from "expo-sqlite";
import { APP_SETTINGS_TABLE } from "../storage/mobileDatabase";
import type {
  AppSettings,
  AppSettingsRepository,
  AppSettingsUpdate,
} from "./types";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "./types";

type SqlValue = string | number | null;
type AppSettingsRow = Record<string, SqlValue | undefined>;

/** SQLite implementation for the singleton app settings row. */
export class SqliteSettingsRepository implements AppSettingsRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async load(): Promise<AppSettings> {
    const row = await this.readRow();
    if (!row) {
      await this.write(DEFAULT_APP_SETTINGS);
      return normalizeAppSettings(DEFAULT_APP_SETTINGS);
    }

    const settings = fromRow(row);
    if (!isCanonicalRow(row, settings)) await this.write(settings);
    return settings;
  }

  async update(partial: AppSettingsUpdate): Promise<AppSettings> {
    const current = await this.load();
    const next = normalizeAppSettings({
      ...current,
      ...(isRecord(partial) ? partial : {}),
    });
    await this.write(next);
    return next;
  }

  async resetPreferences(): Promise<AppSettings> {
    await this.load();
    // Deliberately omit both selection columns so resetPreferences preserves
    // the user's active drill and selected set.
    await this.db.runAsync(
      `UPDATE ${APP_SETTINGS_TABLE}
       SET appearance_mode = ?,
           drill_features_enabled = ?,
           drill_terminology = ?,
           field_perspective = ?,
           default_field_preset = ?,
           transition_metric_mode = ?,
           guidance_enabled = ?,
           developer_mode_enabled = ?,
           show_cached_anchor_geometry = ?,
           show_comfortable_anchor_range = ?,
           show_perimeter_step_grid = ?,
           show_auxiliary_field_marks = ?,
           show_performer_labels = ?,
           show_performer_names = ?,
           show_prop_labels = ?,
           show_prop_names = ?,
           show_transition_markers = ?,
           show_all_transition_sets = ?,
           previous_transition_set_count = ?,
           next_transition_set_count = ?,
           distance_green_threshold_steps = ?,
           distance_yellow_threshold_steps = ?,
           motion_interpolation_enabled = ?,
           comfortable_anchor_range_meters = ?
       WHERE singleton_id = ?`,
      [
        DEFAULT_APP_SETTINGS.appearanceMode,
        boolToSql(DEFAULT_APP_SETTINGS.drillFeaturesEnabled),
        DEFAULT_APP_SETTINGS.drillTerminology,
        DEFAULT_APP_SETTINGS.fieldPerspective,
        DEFAULT_APP_SETTINGS.defaultFieldPreset,
        DEFAULT_APP_SETTINGS.transitionMetricMode,
        boolToSql(DEFAULT_APP_SETTINGS.guidanceEnabled),
        boolToSql(DEFAULT_APP_SETTINGS.developerModeEnabled),
        boolToSql(DEFAULT_APP_SETTINGS.showCachedAnchorGeometry),
        boolToSql(DEFAULT_APP_SETTINGS.showComfortableAnchorRange),
        boolToSql(DEFAULT_APP_SETTINGS.showPerimeterStepGrid),
        boolToSql(DEFAULT_APP_SETTINGS.showAuxiliaryFieldMarks),
        boolToSql(DEFAULT_APP_SETTINGS.showPerformerLabels),
        boolToSql(DEFAULT_APP_SETTINGS.showPerformerNames),
        boolToSql(DEFAULT_APP_SETTINGS.showPropLabels),
        boolToSql(DEFAULT_APP_SETTINGS.showPropNames),
        boolToSql(DEFAULT_APP_SETTINGS.showTransitionMarkers),
        boolToSql(DEFAULT_APP_SETTINGS.showAllTransitionSets),
        DEFAULT_APP_SETTINGS.previousTransitionSetCount,
        DEFAULT_APP_SETTINGS.nextTransitionSetCount,
        DEFAULT_APP_SETTINGS.distanceGreenThresholdSteps,
        DEFAULT_APP_SETTINGS.distanceYellowThresholdSteps,
        boolToSql(DEFAULT_APP_SETTINGS.motionInterpolationEnabled),
        DEFAULT_APP_SETTINGS.comfortableAnchorRangeMeters,
        1,
      ],
    );
    return await this.load();
  }

  private async readRow(): Promise<AppSettingsRow | null> {
    return await this.db.getFirstAsync<AppSettingsRow>(
      `SELECT
         appearance_mode,
         drill_features_enabled,
         drill_terminology,
         field_perspective,
         default_field_preset,
         transition_metric_mode,
         guidance_enabled,
         developer_mode_enabled,
         show_cached_anchor_geometry,
         show_comfortable_anchor_range,
         show_perimeter_step_grid,
         show_auxiliary_field_marks,
         show_performer_labels,
         show_performer_names,
         show_prop_labels,
         show_prop_names,
         show_transition_markers,
         show_all_transition_sets,
         previous_transition_set_count,
         next_transition_set_count,
         distance_green_threshold_steps,
         distance_yellow_threshold_steps,
         motion_interpolation_enabled,
         comfortable_anchor_range_meters,
         active_drill_id,
         selected_drill_page_id
       FROM ${APP_SETTINGS_TABLE}
       WHERE singleton_id = ?`,
      [1],
    );
  }

  private async write(settings: AppSettings): Promise<void> {
    const normalized = normalizeAppSettings(settings);
    await this.db.runAsync(
      `INSERT INTO ${APP_SETTINGS_TABLE} (
         singleton_id,
         appearance_mode,
         drill_features_enabled,
         drill_terminology,
         field_perspective,
         default_field_preset,
         transition_metric_mode,
         guidance_enabled,
         developer_mode_enabled,
         show_cached_anchor_geometry,
         show_comfortable_anchor_range,
         show_perimeter_step_grid,
         show_auxiliary_field_marks,
         show_performer_labels,
         show_performer_names,
         show_prop_labels,
         show_prop_names,
         show_transition_markers,
         show_all_transition_sets,
         previous_transition_set_count,
         next_transition_set_count,
         distance_green_threshold_steps,
         distance_yellow_threshold_steps,
         motion_interpolation_enabled,
         comfortable_anchor_range_meters,
         active_drill_id,
         selected_drill_page_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(singleton_id) DO UPDATE SET
         appearance_mode = excluded.appearance_mode,
         drill_features_enabled = excluded.drill_features_enabled,
         drill_terminology = excluded.drill_terminology,
         field_perspective = excluded.field_perspective,
         default_field_preset = excluded.default_field_preset,
         transition_metric_mode = excluded.transition_metric_mode,
         guidance_enabled = excluded.guidance_enabled,
         developer_mode_enabled = excluded.developer_mode_enabled,
         show_cached_anchor_geometry = excluded.show_cached_anchor_geometry,
         show_comfortable_anchor_range = excluded.show_comfortable_anchor_range,
         show_perimeter_step_grid = excluded.show_perimeter_step_grid,
         show_auxiliary_field_marks = excluded.show_auxiliary_field_marks,
         show_performer_labels = excluded.show_performer_labels,
         show_performer_names = excluded.show_performer_names,
         show_prop_labels = excluded.show_prop_labels,
         show_prop_names = excluded.show_prop_names,
         show_transition_markers = excluded.show_transition_markers,
         show_all_transition_sets = excluded.show_all_transition_sets,
         previous_transition_set_count = excluded.previous_transition_set_count,
         next_transition_set_count = excluded.next_transition_set_count,
         distance_green_threshold_steps = excluded.distance_green_threshold_steps,
         distance_yellow_threshold_steps = excluded.distance_yellow_threshold_steps,
         motion_interpolation_enabled = excluded.motion_interpolation_enabled,
         comfortable_anchor_range_meters = excluded.comfortable_anchor_range_meters,
         active_drill_id = excluded.active_drill_id,
         selected_drill_page_id = excluded.selected_drill_page_id`,
      [
        1,
        normalized.appearanceMode,
        boolToSql(normalized.drillFeaturesEnabled),
        normalized.drillTerminology,
        normalized.fieldPerspective,
        normalized.defaultFieldPreset,
        normalized.transitionMetricMode,
        boolToSql(normalized.guidanceEnabled),
        boolToSql(normalized.developerModeEnabled),
        boolToSql(normalized.showCachedAnchorGeometry),
        boolToSql(normalized.showComfortableAnchorRange),
        boolToSql(normalized.showPerimeterStepGrid),
        boolToSql(normalized.showAuxiliaryFieldMarks),
        boolToSql(normalized.showPerformerLabels),
        boolToSql(normalized.showPerformerNames),
        boolToSql(normalized.showPropLabels),
        boolToSql(normalized.showPropNames),
        boolToSql(normalized.showTransitionMarkers),
        boolToSql(normalized.showAllTransitionSets),
        normalized.previousTransitionSetCount,
        normalized.nextTransitionSetCount,
        normalized.distanceGreenThresholdSteps,
        normalized.distanceYellowThresholdSteps,
        boolToSql(normalized.motionInterpolationEnabled),
        normalized.comfortableAnchorRangeMeters,
        normalized.activeDrillId,
        normalized.selectedDrillSetId,
      ],
    );
  }
}

/** Useful when a caller has a raw SQLite settings row outside the repository. */
export function normalizeAppSettingsRow(row: unknown): AppSettings {
  return fromRow(isRecord(row) ? (row as AppSettingsRow) : {});
}

function fromRow(row: AppSettingsRow): AppSettings {
  return normalizeAppSettings({
    appearanceMode: row.appearance_mode,
    drillFeaturesEnabled: sqliteBoolean(row.drill_features_enabled),
    drillTerminology: row.drill_terminology,
    fieldPerspective: row.field_perspective,
    defaultFieldPreset: row.default_field_preset,
    transitionMetricMode: row.transition_metric_mode,
    guidanceEnabled: sqliteBoolean(row.guidance_enabled),
    developerModeEnabled: sqliteBoolean(row.developer_mode_enabled),
    showCachedAnchorGeometry: sqliteBoolean(row.show_cached_anchor_geometry),
    showComfortableAnchorRange: sqliteBoolean(
      row.show_comfortable_anchor_range,
    ),
    showPerimeterStepGrid: sqliteBoolean(row.show_perimeter_step_grid),
    showAuxiliaryFieldMarks: sqliteBoolean(row.show_auxiliary_field_marks),
    showPerformerLabels: sqliteBoolean(row.show_performer_labels),
    showPerformerNames: sqliteBoolean(row.show_performer_names),
    showPropLabels: sqliteBoolean(row.show_prop_labels),
    showPropNames: sqliteBoolean(row.show_prop_names),
    showTransitionMarkers: sqliteBoolean(row.show_transition_markers),
    showAllTransitionSets: sqliteBoolean(row.show_all_transition_sets),
    previousTransitionSetCount: row.previous_transition_set_count,
    nextTransitionSetCount: row.next_transition_set_count,
    distanceGreenThresholdSteps: row.distance_green_threshold_steps,
    distanceYellowThresholdSteps: row.distance_yellow_threshold_steps,
    motionInterpolationEnabled: sqliteBoolean(row.motion_interpolation_enabled),
    comfortableAnchorRangeMeters: row.comfortable_anchor_range_meters,
    activeDrillId: row.active_drill_id,
    selectedDrillSetId: row.selected_drill_page_id,
  });
}

function isCanonicalRow(row: AppSettingsRow, settings: AppSettings): boolean {
  return (
    row.appearance_mode === settings.appearanceMode &&
    row.drill_features_enabled === boolToSql(settings.drillFeaturesEnabled) &&
    row.drill_terminology === settings.drillTerminology &&
    row.field_perspective === settings.fieldPerspective &&
    row.default_field_preset === settings.defaultFieldPreset &&
    row.transition_metric_mode === settings.transitionMetricMode &&
    row.guidance_enabled === boolToSql(settings.guidanceEnabled) &&
    row.developer_mode_enabled === boolToSql(settings.developerModeEnabled) &&
    row.show_cached_anchor_geometry ===
      boolToSql(settings.showCachedAnchorGeometry) &&
    row.show_comfortable_anchor_range ===
      boolToSql(settings.showComfortableAnchorRange) &&
    row.show_perimeter_step_grid ===
      boolToSql(settings.showPerimeterStepGrid) &&
    row.show_auxiliary_field_marks ===
      boolToSql(settings.showAuxiliaryFieldMarks) &&
    row.show_performer_labels === boolToSql(settings.showPerformerLabels) &&
    row.show_performer_names === boolToSql(settings.showPerformerNames) &&
    row.show_prop_labels === boolToSql(settings.showPropLabels) &&
    row.show_prop_names === boolToSql(settings.showPropNames) &&
    row.show_transition_markers === boolToSql(settings.showTransitionMarkers) &&
    row.show_all_transition_sets ===
      boolToSql(settings.showAllTransitionSets) &&
    row.previous_transition_set_count === settings.previousTransitionSetCount &&
    row.next_transition_set_count === settings.nextTransitionSetCount &&
    row.distance_green_threshold_steps ===
      settings.distanceGreenThresholdSteps &&
    row.distance_yellow_threshold_steps ===
      settings.distanceYellowThresholdSteps &&
    row.motion_interpolation_enabled ===
      boolToSql(settings.motionInterpolationEnabled) &&
    row.comfortable_anchor_range_meters ===
      settings.comfortableAnchorRangeMeters &&
    row.active_drill_id === settings.activeDrillId &&
    row.selected_drill_page_id === settings.selectedDrillSetId
  );
}

function sqliteBoolean(value: SqlValue | undefined): unknown {
  if (value === 1) return true;
  if (value === 0) return false;
  return value;
}

function boolToSql(value: boolean): number {
  return value ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
