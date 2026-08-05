import { FIELD_PRESET_IDS } from "@eight2five/drill-schema";
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
      appearance_mode: "system",
      drill_features_enabled: 1,
      drill_terminology: "sets",
      field_perspective: "performer",
      default_field_preset: "football-nfhs",
      transition_metric_mode: "step-size",
      guidance_enabled: 1,
      developer_mode_enabled: 0,
      show_cached_anchor_geometry: 0,
      show_comfortable_anchor_range: 0,
      show_perimeter_step_grid: 0,
      show_auxiliary_field_marks: 1,
      show_performer_labels: 1,
      show_performer_names: 0,
      show_prop_labels: 1,
      show_prop_names: 0,
      show_transition_markers: 1,
      show_all_transition_sets: 0,
      previous_transition_set_count: 1,
      next_transition_set_count: 1,
      distance_green_threshold_steps: 0.5,
      distance_yellow_threshold_steps: 1,
      motion_interpolation_enabled: 1,
      comfortable_anchor_range_meters: 20,
      active_drill_id: null,
      selected_drill_page_id: null,
    });
  });

  test("normalizes invalid persisted values and rewrites a canonical row", async () => {
    const fake = new SettingsFakeDatabase({
      appearance_mode: "sepia",
      drill_features_enabled: 2,
      drill_terminology: "legacy",
      field_perspective: "unknown",
      default_field_preset: "unknown",
      transition_metric_mode: "unknown",
      guidance_enabled: "yes",
      developer_mode_enabled: 0,
      show_cached_anchor_geometry: 1,
      show_comfortable_anchor_range: 1,
      show_perimeter_step_grid: 1,
      show_auxiliary_field_marks: "yes",
      show_performer_labels: "yes",
      show_performer_names: "yes",
      show_prop_labels: "yes",
      show_prop_names: "yes",
      show_transition_markers: "yes",
      show_all_transition_sets: "yes",
      previous_transition_set_count: 1.5,
      next_transition_set_count: Number.NaN,
      distance_green_threshold_steps: Number.NaN,
      distance_yellow_threshold_steps: 1,
      motion_interpolation_enabled: "yes",
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
      showPerimeterStepGrid: true,
    });
    expect(fake.row).toMatchObject({
      appearance_mode: "system",
      drill_terminology: "sets",
      field_perspective: "performer",
      previous_transition_set_count: 1,
      next_transition_set_count: 1,
      distance_green_threshold_steps: 0.5,
      distance_yellow_threshold_steps: 1,
    });
    expect(fake.database.runAsync).toHaveBeenCalled();
    expect(getEffectiveAppSettings(loaded)).toMatchObject({
      developerModeEnabled: false,
      showCachedAnchorGeometry: false,
      showComfortableAnchorRange: false,
      showPerimeterStepGrid: false,
    });
  });

  test("updates supplied fields while preserving drill/set selection", async () => {
    const fake = new SettingsFakeDatabase({
      appearance_mode: "system",
      drill_features_enabled: 1,
      drill_terminology: "sets",
      field_perspective: "director",
      default_field_preset: "football-ncaa",
      transition_metric_mode: "step-size",
      guidance_enabled: 1,
      developer_mode_enabled: 1,
      show_cached_anchor_geometry: 1,
      show_comfortable_anchor_range: 1,
      show_perimeter_step_grid: 1,
      show_auxiliary_field_marks: 0,
      show_performer_labels: 0,
      show_performer_names: 1,
      show_prop_labels: 0,
      show_prop_names: 1,
      show_transition_markers: 0,
      show_all_transition_sets: 1,
      previous_transition_set_count: 2,
      next_transition_set_count: 3,
      distance_green_threshold_steps: 0.25,
      distance_yellow_threshold_steps: 1.25,
      motion_interpolation_enabled: 0,
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
      defaultFieldPreset: "football-ncaa",
      comfortableAnchorRangeMeters: 20,
      activeDrillId: "drill-1",
      selectedDrillSetId: "set-1",
      selectedDrillPageId: "set-1",
    });
    expect(updated.developerModeEnabled).toBe(true);
    expect(updated.showCachedAnchorGeometry).toBe(true);
    expect(updated.showComfortableAnchorRange).toBe(true);
    expect(updated.showPerimeterStepGrid).toBe(true);
  });

  test("round trips every persisted preference field", async () => {
    const fake = new SettingsFakeDatabase(
      settingsRow({
        active_drill_id: "drill-1",
        selected_drill_page_id: "set-1",
      }),
    );
    const repository = new SqliteSettingsRepository(fake.database);

    const updated = await repository.update({
      appearanceMode: "dark",
      drillFeaturesEnabled: false,
      drillTerminology: "pages",
      fieldPerspective: "director",
      defaultFieldPreset: "football-ncaa",
      transitionMetricMode: "crossing-counts",
      guidanceEnabled: false,
      developerModeEnabled: true,
      showCachedAnchorGeometry: true,
      showComfortableAnchorRange: true,
      showPerimeterStepGrid: true,
      showAuxiliaryFieldMarks: false,
      showPerformerLabels: false,
      showPerformerNames: true,
      showPropLabels: false,
      showPropNames: true,
      showTransitionMarkers: false,
      showAllTransitionSets: true,
      previousTransitionSetCount: 0,
      nextTransitionSetCount: 50,
      distanceGreenThresholdSteps: 0.75,
      distanceYellowThresholdSteps: 1.5,
      motionInterpolationEnabled: false,
      comfortableAnchorRangeMeters: 30,
    });

    await expect(repository.load()).resolves.toEqual(updated);
    expect(updated).toMatchObject({
      appearanceMode: "dark",
      drillTerminology: "pages",
      previousTransitionSetCount: 0,
      nextTransitionSetCount: 50,
      distanceGreenThresholdSteps: 0.75,
      distanceYellowThresholdSteps: 1.5,
      activeDrillId: "drill-1",
      selectedDrillSetId: "set-1",
      selectedDrillPageId: "set-1",
    });
  });

  test("resetPreferences restores preference fields but preserves selection", async () => {
    const fake = new SettingsFakeDatabase({
      appearance_mode: "dark",
      drill_features_enabled: 0,
      drill_terminology: "pages",
      field_perspective: "performer",
      default_field_preset: "football-nfl",
      transition_metric_mode: "crossing-counts",
      guidance_enabled: 0,
      developer_mode_enabled: 1,
      show_cached_anchor_geometry: 1,
      show_comfortable_anchor_range: 1,
      show_perimeter_step_grid: 1,
      show_auxiliary_field_marks: 0,
      show_performer_labels: 0,
      show_performer_names: 1,
      show_prop_labels: 0,
      show_prop_names: 1,
      show_transition_markers: 0,
      show_all_transition_sets: 1,
      previous_transition_set_count: 5,
      next_transition_set_count: 6,
      distance_green_threshold_steps: 0.75,
      distance_yellow_threshold_steps: 1.5,
      motion_interpolation_enabled: 0,
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

  test("normalizes appearance modes and accepts both terminology values", () => {
    expect(normalizeAppSettings({ appearanceMode: "light" })).toMatchObject({
      appearanceMode: "light",
    });
    expect(normalizeAppSettings({ appearanceMode: "unknown" })).toMatchObject({
      appearanceMode: "system",
    });
    expect(
      normalizeAppSettings({ drillTerminology: "sets" }).drillTerminology,
    ).toBe("sets");
    expect(
      normalizeAppSettings({ drillTerminology: "pages" }).drillTerminology,
    ).toBe("pages");
    expect(normalizeAppSettings({}).fieldPerspective).toBe("performer");
  });

  test("bounds transition counts and preserves threshold invariants", () => {
    expect(
      normalizeAppSettings({
        previousTransitionSetCount: -1,
        nextTransitionSetCount: 51,
      }),
    ).toMatchObject({
      previousTransitionSetCount: 0,
      nextTransitionSetCount: 50,
    });
    expect(
      normalizeAppSettings({
        previousTransitionSetCount: 1.5,
        nextTransitionSetCount: Number.NaN,
      }),
    ).toMatchObject({
      previousTransitionSetCount: 1,
      nextTransitionSetCount: 1,
    });

    const normalized = normalizeAppSettings({
      distanceGreenThresholdSteps: 2,
      distanceYellowThresholdSteps: 1,
    });
    expect(normalized.distanceGreenThresholdSteps).toBeLessThanOrEqual(
      normalized.distanceYellowThresholdSteps,
    );
    expect(normalized.distanceGreenThresholdSteps).toBeGreaterThanOrEqual(0);
    expect(
      normalizeAppSettings({
        distanceGreenThresholdSteps: Number.NaN,
        distanceYellowThresholdSteps: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({
      distanceGreenThresholdSteps: 0.5,
      distanceYellowThresholdSteps: 1,
    });
  });

  test("the pure normalizer treats malformed input as defaults", () => {
    expect(
      normalizeAppSettings({
        drillFeaturesEnabled: "true",
        defaultFieldPreset: "football-made-up",
        guidanceEnabled: null,
        comfortableAnchorRangeMeters: 0,
        activeDrillId: "  ",
      }),
    ).toEqual(DEFAULT_APP_SETTINGS);
  });

  test.each(FIELD_PRESET_IDS)(
    "accepts %s as the default marching field",
    (defaultFieldPreset) => {
      expect(
        normalizeAppSettings({ defaultFieldPreset }).defaultFieldPreset,
      ).toBe(defaultFieldPreset);
    },
  );

  test("clears an impossible selected set when no drill is active", () => {
    expect(
      normalizeAppSettings({
        activeDrillId: null,
        selectedDrillSetId: "set-1",
      }).selectedDrillSetId,
    ).toBeNull();
  });

  test("gates developer overlays and rejects ranges over 200 meters", () => {
    expect(
      getEffectiveDeveloperOverlaySettings({
        ...DEFAULT_APP_SETTINGS,
        developerModeEnabled: true,
        showCachedAnchorGeometry: false,
        showComfortableAnchorRange: true,
        showPerimeterStepGrid: true,
      }),
    ).toMatchObject({
      showComfortableAnchorRange: false,
      showPerimeterStepGrid: true,
    });
    expect(
      getEffectiveDeveloperOverlaySettings({
        ...DEFAULT_APP_SETTINGS,
        developerModeEnabled: false,
        showPerimeterStepGrid: true,
      }),
    ).toMatchObject({ showPerimeterStepGrid: false });
    expect(
      normalizeAppSettings({ comfortableAnchorRangeMeters: 201 }),
    ).toMatchObject({ comfortableAnchorRangeMeters: 20 });
  });
});

class SettingsFakeDatabase {
  readonly database: SQLiteDatabase;
  row: Record<string, unknown> | null;

  constructor(row: Record<string, unknown> | null) {
    this.row = row ? settingsRow(row) : null;
    this.database = {
      getFirstAsync: jest.fn(async () => (this.row ? { ...this.row } : null)),
      runAsync: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes("UPDATE app_settings")) {
          this.row = {
            ...(this.row ?? {}),
            appearance_mode: params[0],
            drill_features_enabled: params[1],
            drill_terminology: params[2],
            field_perspective: params[3],
            default_field_preset: params[4],
            transition_metric_mode: params[5],
            guidance_enabled: params[6],
            developer_mode_enabled: params[7],
            show_cached_anchor_geometry: params[8],
            show_comfortable_anchor_range: params[9],
            show_perimeter_step_grid: params[10],
            show_auxiliary_field_marks: params[11],
            show_performer_labels: params[12],
            show_performer_names: params[13],
            show_prop_labels: params[14],
            show_prop_names: params[15],
            show_transition_markers: params[16],
            show_all_transition_sets: params[17],
            previous_transition_set_count: params[18],
            next_transition_set_count: params[19],
            distance_green_threshold_steps: params[20],
            distance_yellow_threshold_steps: params[21],
            motion_interpolation_enabled: params[22],
            comfortable_anchor_range_meters: params[23],
          };
        } else {
          this.row = {
            appearance_mode: params[1],
            drill_features_enabled: params[2],
            drill_terminology: params[3],
            field_perspective: params[4],
            default_field_preset: params[5],
            transition_metric_mode: params[6],
            guidance_enabled: params[7],
            developer_mode_enabled: params[8],
            show_cached_anchor_geometry: params[9],
            show_comfortable_anchor_range: params[10],
            show_perimeter_step_grid: params[11],
            show_auxiliary_field_marks: params[12],
            show_performer_labels: params[13],
            show_performer_names: params[14],
            show_prop_labels: params[15],
            show_prop_names: params[16],
            show_transition_markers: params[17],
            show_all_transition_sets: params[18],
            previous_transition_set_count: params[19],
            next_transition_set_count: params[20],
            distance_green_threshold_steps: params[21],
            distance_yellow_threshold_steps: params[22],
            motion_interpolation_enabled: params[23],
            comfortable_anchor_range_meters: params[24],
            active_drill_id: params[25],
            selected_drill_page_id: params[26],
          };
        }
        return { lastInsertRowId: 1, changes: 1 };
      }),
    } as unknown as SQLiteDatabase;
  }
}

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    appearance_mode: "system",
    drill_features_enabled: 1,
    drill_terminology: "sets",
    field_perspective: "performer",
    default_field_preset: "football-nfhs",
    transition_metric_mode: "step-size",
    guidance_enabled: 1,
    developer_mode_enabled: 0,
    show_cached_anchor_geometry: 0,
    show_comfortable_anchor_range: 0,
    show_perimeter_step_grid: 0,
    show_auxiliary_field_marks: 1,
    show_performer_labels: 1,
    show_performer_names: 0,
    show_prop_labels: 1,
    show_prop_names: 0,
    show_transition_markers: 1,
    show_all_transition_sets: 0,
    previous_transition_set_count: 1,
    next_transition_set_count: 1,
    distance_green_threshold_steps: 0.5,
    distance_yellow_threshold_steps: 1,
    motion_interpolation_enabled: 1,
    comfortable_anchor_range_meters: 20,
    active_drill_id: null,
    selected_drill_page_id: null,
    ...overrides,
  };
}
