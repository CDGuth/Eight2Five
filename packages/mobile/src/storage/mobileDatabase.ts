import type { SQLiteDatabase } from "expo-sqlite";

/** The app database is deliberately separate from the PANS manager database. */
export const MOBILE_DB_NAME = "eight2five-mobile.db";
export const MOBILE_DATABASE_NAME = MOBILE_DB_NAME;

/**
 * The schema owner for the app database. Repositories never run migrations on
 * their own; `openMobileRepositories` calls this function once before it
 * constructs either repository.
 */
export const MOBILE_SCHEMA_VERSION = 1;

export const MOBILE_SCHEMA_MIGRATIONS_TABLE = "mobile_schema_migrations";
export const DRILLS_TABLE = "drills";
export const DRILL_PAGES_TABLE = "drill_pages";
export const APP_SETTINGS_TABLE = "app_settings";

export class MobileStorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "MobileStorageError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * Migrate the app-side database.
 *
 * This is intentionally the only migration owner for the mobile database.
 * The PANS manager database has its own file and its own user_version and is
 * not touched here.
 */
export async function migrateMobileDatabase(db: SQLiteDatabase): Promise<void> {
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

  if (currentVersion === 0) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${MOBILE_SCHEMA_MIGRATIONS_TABLE} (
          version INTEGER PRIMARY KEY NOT NULL,
          applied_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ${DRILLS_TABLE} (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_drills_created_at
          ON ${DRILLS_TABLE}(created_at, id);

        CREATE TABLE IF NOT EXISTS ${DRILL_PAGES_TABLE} (
          id TEXT PRIMARY KEY NOT NULL,
          drill_id TEXT NOT NULL
            REFERENCES ${DRILLS_TABLE}(id) ON DELETE CASCADE,
          ordinal INTEGER NOT NULL
            CHECK (ordinal >= 0 AND ordinal = CAST(ordinal AS INTEGER)),
          label TEXT NOT NULL CHECK (length(trim(label)) > 0),
          counts_from_previous INTEGER NOT NULL
            CHECK (counts_from_previous >= 0),
          x_meters REAL NOT NULL
            CHECK (x_meters = x_meters),
          y_meters REAL NOT NULL
            CHECK (y_meters = y_meters),
          UNIQUE (drill_id, ordinal)
        );

        CREATE INDEX IF NOT EXISTS idx_drill_pages_drill
          ON ${DRILL_PAGES_TABLE}(drill_id, ordinal, id);

        CREATE TABLE IF NOT EXISTS ${APP_SETTINGS_TABLE} (
          singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
          drill_features_enabled INTEGER NOT NULL DEFAULT 1
            CHECK (drill_features_enabled IN (0, 1)),
          drill_terminology TEXT NOT NULL DEFAULT 'pages'
            CHECK (drill_terminology IN ('pages', 'sets')),
          field_perspective TEXT NOT NULL DEFAULT 'director'
            CHECK (field_perspective IN ('director', 'performer')),
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
          comfortable_anchor_range_meters REAL NOT NULL DEFAULT 20
            CHECK (comfortable_anchor_range_meters > 0),
          active_drill_id TEXT
            REFERENCES ${DRILLS_TABLE}(id) ON DELETE SET NULL,
          selected_drill_page_id TEXT
            REFERENCES ${DRILL_PAGES_TABLE}(id) ON DELETE SET NULL
        );

        INSERT OR IGNORE INTO ${APP_SETTINGS_TABLE} (singleton_id)
          VALUES (1);
      `);

      await db.runAsync(
        `INSERT OR REPLACE INTO ${MOBILE_SCHEMA_MIGRATIONS_TABLE}
          (version, applied_at) VALUES (?, ?)`,
        [MOBILE_SCHEMA_VERSION, Date.now()],
      );
      await db.execAsync(`PRAGMA user_version = ${MOBILE_SCHEMA_VERSION};`);
    });
  }

  // Keep this enabled for every connection, including an already migrated one.
  await db.execAsync("PRAGMA foreign_keys = ON;");
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
