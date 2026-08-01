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

/**
 * SQLite implementation for the singleton app settings row.
 *
 * Parameterized `runAsync` calls are intentionally used directly. Expo SQLite
 * documents `runAsync` as a prepare/execute/finalize convenience wrapper, so
 * an explicit prepared-statement loop would add complexity without changing
 * the safety or performance contract needed by these small writes.
 */
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
    // Deliberately omit both selection columns: resetPreferences must not
    // overwrite activeDrillId or selectedDrillPageId, even if another caller
    // changes a selection between the initial load and this write.
    await this.db.runAsync(
      `UPDATE ${APP_SETTINGS_TABLE}
       SET drill_features_enabled = ?,
           drill_terminology = ?,
           field_perspective = ?,
           transition_metric_mode = ?,
           guidance_enabled = ?,
           developer_mode_enabled = ?,
           show_cached_anchor_geometry = ?,
           show_comfortable_anchor_range = ?,
           comfortable_anchor_range_meters = ?
       WHERE singleton_id = ?`,
      [
        boolToSql(DEFAULT_APP_SETTINGS.drillFeaturesEnabled),
        DEFAULT_APP_SETTINGS.drillTerminology,
        DEFAULT_APP_SETTINGS.fieldPerspective,
        DEFAULT_APP_SETTINGS.transitionMetricMode,
        boolToSql(DEFAULT_APP_SETTINGS.guidanceEnabled),
        boolToSql(DEFAULT_APP_SETTINGS.developerModeEnabled),
        boolToSql(DEFAULT_APP_SETTINGS.showCachedAnchorGeometry),
        boolToSql(DEFAULT_APP_SETTINGS.showComfortableAnchorRange),
        DEFAULT_APP_SETTINGS.comfortableAnchorRangeMeters,
        1,
      ],
    );
    return await this.load();
  }

  private async readRow(): Promise<AppSettingsRow | null> {
    return await this.db.getFirstAsync<AppSettingsRow>(
      `SELECT
         drill_features_enabled,
         drill_terminology,
         field_perspective,
         transition_metric_mode,
         guidance_enabled,
         developer_mode_enabled,
         show_cached_anchor_geometry,
         show_comfortable_anchor_range,
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
         drill_features_enabled,
         drill_terminology,
         field_perspective,
         transition_metric_mode,
         guidance_enabled,
         developer_mode_enabled,
         show_cached_anchor_geometry,
         show_comfortable_anchor_range,
         comfortable_anchor_range_meters,
         active_drill_id,
         selected_drill_page_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(singleton_id) DO UPDATE SET
         drill_features_enabled = excluded.drill_features_enabled,
         drill_terminology = excluded.drill_terminology,
         field_perspective = excluded.field_perspective,
         transition_metric_mode = excluded.transition_metric_mode,
         guidance_enabled = excluded.guidance_enabled,
         developer_mode_enabled = excluded.developer_mode_enabled,
         show_cached_anchor_geometry = excluded.show_cached_anchor_geometry,
         show_comfortable_anchor_range = excluded.show_comfortable_anchor_range,
         comfortable_anchor_range_meters = excluded.comfortable_anchor_range_meters,
         active_drill_id = excluded.active_drill_id,
         selected_drill_page_id = excluded.selected_drill_page_id`,
      [
        1,
        boolToSql(normalized.drillFeaturesEnabled),
        normalized.drillTerminology,
        normalized.fieldPerspective,
        normalized.transitionMetricMode,
        boolToSql(normalized.guidanceEnabled),
        boolToSql(normalized.developerModeEnabled),
        boolToSql(normalized.showCachedAnchorGeometry),
        boolToSql(normalized.showComfortableAnchorRange),
        normalized.comfortableAnchorRangeMeters,
        normalized.activeDrillId,
        normalized.selectedDrillPageId,
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
    drillFeaturesEnabled: sqliteBoolean(row.drill_features_enabled),
    drillTerminology: row.drill_terminology,
    fieldPerspective: row.field_perspective,
    transitionMetricMode: row.transition_metric_mode,
    guidanceEnabled: sqliteBoolean(row.guidance_enabled),
    developerModeEnabled: sqliteBoolean(row.developer_mode_enabled),
    showCachedAnchorGeometry: sqliteBoolean(row.show_cached_anchor_geometry),
    showComfortableAnchorRange: sqliteBoolean(
      row.show_comfortable_anchor_range,
    ),
    comfortableAnchorRangeMeters: row.comfortable_anchor_range_meters,
    activeDrillId: row.active_drill_id,
    selectedDrillPageId: row.selected_drill_page_id,
  });
}

function isCanonicalRow(row: AppSettingsRow, settings: AppSettings): boolean {
  return (
    row.drill_features_enabled === boolToSql(settings.drillFeaturesEnabled) &&
    row.drill_terminology === settings.drillTerminology &&
    row.field_perspective === settings.fieldPerspective &&
    row.transition_metric_mode === settings.transitionMetricMode &&
    row.guidance_enabled === boolToSql(settings.guidanceEnabled) &&
    row.developer_mode_enabled === boolToSql(settings.developerModeEnabled) &&
    row.show_cached_anchor_geometry ===
      boolToSql(settings.showCachedAnchorGeometry) &&
    row.show_comfortable_anchor_range ===
      boolToSql(settings.showComfortableAnchorRange) &&
    row.comfortable_anchor_range_meters ===
      settings.comfortableAnchorRangeMeters &&
    row.active_drill_id === settings.activeDrillId &&
    row.selected_drill_page_id === settings.selectedDrillPageId
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
