import { FIELD_PRESET_IDS } from "@eight2five/drill-schema";
import type { SQLiteDatabase } from "expo-sqlite";

/** The app database is deliberately separate from the PANS manager database. */
export const MOBILE_DB_NAME = "eight2five-mobile.db";
export const MOBILE_DATABASE_NAME = MOBILE_DB_NAME;

/**
 * The app-side schema is still under active development. Until it is declared
 * stable, a version mismatch intentionally rebuilds this disposable database
 * rather than carrying migration code for development-only layouts.
 */
export const MOBILE_SCHEMA_VERSION = 6;

export const DRILLS_TABLE = "drills";
export const DRILL_SETS_TABLE = "drill_sets";
export const APP_SETTINGS_TABLE = "app_settings";

const FIELD_PRESET_SQL_LIST = FIELD_PRESET_IDS.map((id) => `'${id}'`).join(
  ", ",
);

export class MobileStorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "MobileStorageError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * Prepare the app-side database for use.
 *
 * During active schema development, any older local layout is discarded and
 * recreated from the current definition. The separate PANS manager database is
 * not touched by this routine.
 */
export async function prepareMobileDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number | string }>(
    "PRAGMA user_version",
  );
  const currentVersion = parseSchemaVersion(row?.user_version);
  if (currentVersion > MOBILE_SCHEMA_VERSION) {
    throw new MobileStorageError(
      `Unsupported mobile database version ${currentVersion}.`,
    );
  }

  if (currentVersion !== MOBILE_SCHEMA_VERSION) {
    await rebuildMobileDatabase(db);
  }

  // Foreign-key enforcement is connection-local, so enable it on every open.
  await db.execAsync("PRAGMA foreign_keys = ON;");
}

async function rebuildMobileDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = OFF;");
  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DROP TABLE IF EXISTS ${APP_SETTINGS_TABLE};
        DROP TABLE IF EXISTS drill_pages;
        DROP TABLE IF EXISTS ${DRILL_SETS_TABLE};
        DROP TABLE IF EXISTS ${DRILLS_TABLE};
        DROP TABLE IF EXISTS mobile_schema_migrations;
      `);
      await createCurrentSchema(db);
    });
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON;");
  }
}

async function createCurrentSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE ${DRILLS_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      field_preset TEXT NOT NULL DEFAULT 'football-nfhs'
        CHECK (field_preset IN (${FIELD_PRESET_SQL_LIST})),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata_title TEXT NOT NULL CHECK (length(trim(metadata_title)) > 0),
      metadata_created_at TEXT NOT NULL,
      metadata_drill_writer TEXT,
      metadata_ensemble TEXT,
      metadata_description TEXT,
      metadata_lucide_icon TEXT,
      source_document_json TEXT,
      selected_performer_entity_id INTEGER
        CHECK (
          selected_performer_entity_id IS NULL OR
          (selected_performer_entity_id >= 0 AND
           selected_performer_entity_id = CAST(selected_performer_entity_id AS INTEGER))
        )
    );

    CREATE INDEX idx_drills_created_at
      ON ${DRILLS_TABLE}(created_at, id);

    CREATE TABLE ${DRILL_SETS_TABLE} (
      id TEXT PRIMARY KEY NOT NULL,
      drill_id TEXT NOT NULL
        REFERENCES ${DRILLS_TABLE}(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL
        CHECK (ordinal >= 0 AND ordinal = CAST(ordinal AS INTEGER)),
      set_number INTEGER NOT NULL CHECK (set_number >= 0),
      set_suffix TEXT,
      set_kind TEXT NOT NULL CHECK (set_kind IN ('set', 'subset')),
      counts_from_previous INTEGER NOT NULL
        CHECK (
          counts_from_previous >= 0 AND
          counts_from_previous = CAST(counts_from_previous AS INTEGER)
        ),
      measure_start INTEGER,
      measure_end INTEGER,
      x_steps REAL NOT NULL CHECK (x_steps = x_steps),
      y_steps REAL NOT NULL CHECK (y_steps = y_steps),
      facing_degrees REAL
        CHECK (facing_degrees IS NULL OR (facing_degrees >= 0 AND facing_degrees < 360)),
      source_set_id INTEGER
        CHECK (source_set_id IS NULL OR (source_set_id >= 0 AND source_set_id = CAST(source_set_id AS INTEGER))),
      CHECK (
        (set_kind = 'set' AND set_suffix IS NULL) OR
        (set_kind = 'subset' AND set_suffix IS NOT NULL)
      ),
      CHECK (
        (measure_start IS NULL AND measure_end IS NULL) OR
        (measure_start IS NOT NULL AND measure_end IS NOT NULL AND
         measure_start >= 0 AND measure_end >= measure_start)
      ),
      UNIQUE (drill_id, ordinal),
      UNIQUE (drill_id, set_number, set_suffix)
    );

    CREATE INDEX idx_drill_sets_drill
      ON ${DRILL_SETS_TABLE}(drill_id, ordinal, id);

    CREATE INDEX idx_drill_sets_source
      ON ${DRILL_SETS_TABLE}(drill_id, source_set_id);

    CREATE TABLE ${APP_SETTINGS_TABLE} (
      singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
      appearance_mode TEXT NOT NULL DEFAULT 'system'
        CHECK (appearance_mode IN ('system', 'light', 'dark')),
      drill_features_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (drill_features_enabled IN (0, 1)),
      drill_terminology TEXT NOT NULL DEFAULT 'sets'
        CHECK (drill_terminology IN ('sets', 'pages')),
      field_perspective TEXT NOT NULL DEFAULT 'performer'
        CHECK (field_perspective IN ('director', 'performer')),
      default_field_preset TEXT NOT NULL DEFAULT 'football-nfhs'
        CHECK (default_field_preset IN (${FIELD_PRESET_SQL_LIST})),
      transition_metric_mode TEXT NOT NULL DEFAULT 'step-size'
        CHECK (transition_metric_mode IN ('step-size', 'crossing-counts')),
      guidance_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (guidance_enabled IN (0, 1)),
      developer_mode_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (developer_mode_enabled IN (0, 1)),
      show_cached_anchor_geometry INTEGER NOT NULL DEFAULT 0
        CHECK (show_cached_anchor_geometry IN (0, 1)),
      show_comfortable_anchor_range INTEGER NOT NULL DEFAULT 0
        CHECK (show_comfortable_anchor_range IN (0, 1)),
      show_perimeter_step_grid INTEGER NOT NULL DEFAULT 0
        CHECK (show_perimeter_step_grid IN (0, 1)),
      show_auxiliary_field_marks INTEGER NOT NULL DEFAULT 1
        CHECK (show_auxiliary_field_marks IN (0, 1)),
      show_performer_labels INTEGER NOT NULL DEFAULT 1
        CHECK (show_performer_labels IN (0, 1)),
      show_performer_names INTEGER NOT NULL DEFAULT 0
        CHECK (show_performer_names IN (0, 1)),
      show_prop_labels INTEGER NOT NULL DEFAULT 1
        CHECK (show_prop_labels IN (0, 1)),
      show_prop_names INTEGER NOT NULL DEFAULT 0
        CHECK (show_prop_names IN (0, 1)),
      show_transition_markers INTEGER NOT NULL DEFAULT 1
        CHECK (show_transition_markers IN (0, 1)),
      show_all_transition_sets INTEGER NOT NULL DEFAULT 0
        CHECK (show_all_transition_sets IN (0, 1)),
      previous_transition_set_count INTEGER NOT NULL DEFAULT 1
        CHECK (
          previous_transition_set_count >= 0 AND
          previous_transition_set_count <= 50 AND
          previous_transition_set_count = CAST(previous_transition_set_count AS INTEGER)
        ),
      next_transition_set_count INTEGER NOT NULL DEFAULT 1
        CHECK (
          next_transition_set_count >= 0 AND
          next_transition_set_count <= 50 AND
          next_transition_set_count = CAST(next_transition_set_count AS INTEGER)
        ),
      distance_green_threshold_steps REAL NOT NULL DEFAULT 0.5
        CHECK (
          distance_green_threshold_steps >= 0 AND
          distance_green_threshold_steps = distance_green_threshold_steps
        ),
      distance_yellow_threshold_steps REAL NOT NULL DEFAULT 1
        CHECK (
          distance_yellow_threshold_steps >= 0 AND
          distance_yellow_threshold_steps = distance_yellow_threshold_steps
        ),
      motion_interpolation_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (motion_interpolation_enabled IN (0, 1)),
      comfortable_anchor_range_meters REAL NOT NULL DEFAULT 20
        CHECK (comfortable_anchor_range_meters > 0),
      active_drill_id TEXT
        REFERENCES ${DRILLS_TABLE}(id) ON DELETE SET NULL,
      selected_drill_page_id TEXT
        REFERENCES ${DRILL_SETS_TABLE}(id) ON DELETE SET NULL,
      CHECK (
        distance_green_threshold_steps <= distance_yellow_threshold_steps
      )
    );

    INSERT INTO ${APP_SETTINGS_TABLE} (singleton_id) VALUES (1);

    PRAGMA user_version = ${MOBILE_SCHEMA_VERSION};
  `);
}

function parseSchemaVersion(value: number | string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new MobileStorageError(
      `Invalid mobile database version ${String(value)}.`,
    );
  }
  return parsed;
}
