import type { SQLiteDatabase } from "expo-sqlite";
import { SqliteSettingsRepository } from "../SqliteSettingsRepository";
import {
  DEFAULT_APP_SETTINGS,
  getEffectiveAppSettings,
  getEffectiveDeveloperOverlaySettings,
  normalizeAppSettings,
} from "../types";

describe("app settings", () => {
  test("loads defaults when the singleton row is absent", async () => {
    const fake = new SettingsFakeDatabase(null);
    const repository = new SqliteSettingsRepository(fake.database);

    await expect(repository.load()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    expect(fake.row).toMatchObject({
      drill_features_enabled: 1,
      drill_terminology: "sets",
      field_perspective: "director",
      transition_metric_mode: "step-size",
      guidance_enabled: 1,
      developer_mode_enabled: 0,
      comfortable_anchor_range_meters: 20,
      active_drill_id: null,
      selected_drill_page_id: null,
    });
  });

  test("normalizes invalid persisted values and pins legacy terminology to sets", async () => {
    const fake = new SettingsFakeDatabase({
      drill_features_enabled: 2,
      drill_terminology: "pages",
      field_perspective: "unknown",
      transition_metric_mode: "unknown",
      guidance_enabled: "yes",
      developer_mode_enabled: 0,
      show_cached_anchor_geometry: 1,
      show_comfortable_anchor_range: 1,
      comfortable_anchor_range_meters: Number.NaN,
      active_drill_id: 17,
      selected_drill_page_id: "",
    });
    const repository = new SqliteSettingsRepository(fake.database);

    const loaded = await repository.load();

    expect(loaded).toEqual({
      ...DEFAULT_APP_SETTINGS,
      showCachedAnchorGeometry: true,
      showComfortableAnchorRange: true,
    });
    expect(fake.row?.drill_terminology).toBe("sets");
    expect(fake.database.runAsync).toHaveBeenCalled();
    expect(getEffectiveAppSettings(loaded)).toMatchObject({
      developerModeEnabled: false,
      showCachedAnchorGeometry: false,
      showComfortableAnchorRange: false,
    });
  });

  test("updates supplied fields while preserving drill/set selection", async () => {
    const fake = new SettingsFakeDatabase({
      drill_features_enabled: 1,
      drill_terminology: "pages",
      field_perspective: "director",
      transition_metric_mode: "step-size",
      guidance_enabled: 1,
      developer_mode_enabled: 1,
      show_cached_anchor_geometry: 1,
      show_comfortable_anchor_range: 1,
      comfortable_anchor_range_meters: 30,
      active_drill_id: "drill-1",
      selected_drill_page_id: "set-1",
    });
    const repository = new SqliteSettingsRepository(fake.database);

    const updated = await repository.update({
      comfortableAnchorRangeMeters: -1,
    });

    expect(updated).toMatchObject({
      drillFeaturesEnabled: true,
      drillTerminology: "sets",
      comfortableAnchorRangeMeters: 20,
      activeDrillId: "drill-1",
      selectedDrillSetId: "set-1",
      selectedDrillPageId: "set-1",
    });
    expect(updated.developerModeEnabled).toBe(true);
    expect(updated.showCachedAnchorGeometry).toBe(true);
    expect(updated.showComfortableAnchorRange).toBe(true);
  });

  test("resetPreferences restores preference fields but preserves selection", async () => {
    const fake = new SettingsFakeDatabase({
      drill_features_enabled: 0,
      drill_terminology: "pages",
      field_perspective: "performer",
      transition_metric_mode: "crossing-counts",
      guidance_enabled: 0,
      developer_mode_enabled: 1,
      show_cached_anchor_geometry: 1,
      show_comfortable_anchor_range: 1,
      comfortable_anchor_range_meters: 7,
      active_drill_id: "drill-1",
      selected_drill_page_id: "set-2",
    });
    const repository = new SqliteSettingsRepository(fake.database);

    const reset = await repository.resetPreferences();

    expect(reset).toEqual({
      ...DEFAULT_APP_SETTINGS,
      activeDrillId: "drill-1",
      selectedDrillSetId: "set-2",
      selectedDrillPageId: "set-2",
    });
    expect(fake.row?.drill_terminology).toBe("sets");
  });

  test("the pure normalizer treats malformed input as defaults", () => {
    expect(
      normalizeAppSettings({
        drillFeaturesEnabled: "true",
        guidanceEnabled: null,
        comfortableAnchorRangeMeters: 0,
        activeDrillId: "  ",
      }),
    ).toEqual(DEFAULT_APP_SETTINGS);
  });

  test("clears an impossible selected set when no drill is active", () => {
    expect(
      normalizeAppSettings({
        activeDrillId: null,
        selectedDrillSetId: "set-1",
      }).selectedDrillSetId,
    ).toBeNull();
  });

  test("gates range behind geometry and rejects ranges over 200 meters", () => {
    expect(
      getEffectiveDeveloperOverlaySettings({
        ...DEFAULT_APP_SETTINGS,
        developerModeEnabled: true,
        showCachedAnchorGeometry: false,
        showComfortableAnchorRange: true,
      }),
    ).toMatchObject({ showComfortableAnchorRange: false });
    expect(
      normalizeAppSettings({ comfortableAnchorRangeMeters: 201 }),
    ).toMatchObject({ comfortableAnchorRangeMeters: 20 });
  });
});

class SettingsFakeDatabase {
  readonly database: SQLiteDatabase;
  row: Record<string, unknown> | null;

  constructor(row: Record<string, unknown> | null) {
    this.row = row;
    this.database = {
      getFirstAsync: jest.fn(async () => (this.row ? { ...this.row } : null)),
      runAsync: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes("UPDATE app_settings")) {
          this.row = {
            ...(this.row ?? {}),
            drill_features_enabled: params[0],
            drill_terminology: "sets",
            field_perspective: params[1],
            transition_metric_mode: params[2],
            guidance_enabled: params[3],
            developer_mode_enabled: params[4],
            show_cached_anchor_geometry: params[5],
            show_comfortable_anchor_range: params[6],
            comfortable_anchor_range_meters: params[7],
          };
        } else {
          this.row = {
            drill_features_enabled: params[1],
            drill_terminology: "sets",
            field_perspective: params[2],
            transition_metric_mode: params[3],
            guidance_enabled: params[4],
            developer_mode_enabled: params[5],
            show_cached_anchor_geometry: params[6],
            show_comfortable_anchor_range: params[7],
            comfortable_anchor_range_meters: params[8],
            active_drill_id: params[9],
            selected_drill_page_id: params[10],
          };
        }
        return { lastInsertRowId: 1, changes: 1 };
      }),
    } as unknown as SQLiteDatabase;
  }
}
