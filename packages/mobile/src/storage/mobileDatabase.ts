import {
  formatSetName,
  getFieldPreset,
  physicalPointToDrillGrid,
} from "@eight2five/drill-schema";
import type { SQLiteDatabase } from "expo-sqlite";

/** The app database is deliberately separate from the PANS manager database. */
export const MOBILE_DB_NAME = "eight2five-mobile.db";
export const MOBILE_DATABASE_NAME = MOBILE_DB_NAME;

/**
 * v2 replaces arbitrary drill-page labels/physical target coordinates with
 * explicit set identity and conventional drill-grid coordinates. Legacy
 * columns remain in the physical SQLite table so v1 databases can migrate
 * without rebuilding foreign-key relationships.
 */
export const MOBILE_SCHEMA_VERSION = 2;

export const MOBILE_SCHEMA_MIGRATIONS_TABLE = "mobile_schema_migrations";
export const DRILLS_TABLE = "drills";
export const DRILL_SETS_TABLE = "drill_pages";
/** @deprecated Physical table alias retained for storage compatibility. */
export const DRILL_PAGES_TABLE = DRILL_SETS_TABLE;
export const APP_SETTINGS_TABLE = "app_settings";

const NFHS_FIELD = getFieldPreset("football-nfhs");
const HALF_FIELD_METERS = 45.72;

export class MobileStorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "MobileStorageError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * Migrate the app-side database. This is the only migration owner for this
 * database; repositories only consume a completed schema.
 */
export async function migrateMobileDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number | string }>(
    "PRAGMA user_version",
  );
  let currentVersion = parseSchemaVersion(row?.user_version);
  if (currentVersion > MOBILE_SCHEMA_VERSION) {
    throw new MobileStorageError(
      `Unsupported mobile database version ${currentVersion}.`,
    );
  }

  if (currentVersion === 0) {
    await createCurrentSchema(db);
    currentVersion = MOBILE_SCHEMA_VERSION;
  }

  if (currentVersion === 1) {
    await migrateVersionOneToTwo(db);
    currentVersion = 2;
  }

  if (currentVersion !== MOBILE_SCHEMA_VERSION) {
    throw new MobileStorageError(
      `Mobile database migration stopped at unsupported version ${currentVersion}.`,
    );
  }

  // Keep this enabled for every connection, including an already migrated one.
  await db.execAsync("PRAGMA foreign_keys = ON;");
}

async function createCurrentSchema(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${MOBILE_SCHEMA_MIGRATIONS_TABLE} (
        version INTEGER PRIMARY KEY NOT NULL,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ${DRILLS_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        field_preset TEXT NOT NULL DEFAULT 'football-nfhs'
          CHECK (field_preset = 'football-nfhs'),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_drills_created_at
        ON ${DRILLS_TABLE}(created_at, id);

      CREATE TABLE IF NOT EXISTS ${DRILL_SETS_TABLE} (
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

        -- Legacy compatibility columns. New domain code derives these values.
        label TEXT NOT NULL CHECK (length(trim(label)) > 0),
        x_meters REAL NOT NULL CHECK (x_meters = x_meters),
        y_meters REAL NOT NULL CHECK (y_meters = y_meters),

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

      CREATE INDEX IF NOT EXISTS idx_drill_sets_drill
        ON ${DRILL_SETS_TABLE}(drill_id, ordinal, id);

      CREATE TABLE IF NOT EXISTS ${APP_SETTINGS_TABLE} (
        singleton_id INTEGER PRIMARY KEY NOT NULL CHECK (singleton_id = 1),
        drill_features_enabled INTEGER NOT NULL DEFAULT 1
          CHECK (drill_features_enabled IN (0, 1)),
        drill_terminology TEXT NOT NULL DEFAULT 'sets'
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
          REFERENCES ${DRILL_SETS_TABLE}(id) ON DELETE SET NULL
      );

      INSERT OR IGNORE INTO ${APP_SETTINGS_TABLE} (singleton_id)
        VALUES (1);
    `);
    await recordMigration(db, MOBILE_SCHEMA_VERSION);
  });
}

interface LegacySetRow {
  readonly id: string;
  readonly drill_id: string;
  readonly ordinal: number;
  readonly label: string;
  readonly counts_from_previous: number;
  readonly x_meters: number;
  readonly y_meters: number;
}

interface LegacyIdentity {
  readonly number: number;
  readonly suffix?: string;
  readonly kind: "set" | "subset";
}

async function migrateVersionOneToTwo(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      ALTER TABLE ${DRILLS_TABLE}
        ADD COLUMN field_preset TEXT NOT NULL DEFAULT 'football-nfhs';

      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN set_number INTEGER;
      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN set_suffix TEXT;
      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN set_kind TEXT;
      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN measure_start INTEGER;
      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN measure_end INTEGER;
      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN x_steps REAL;
      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN y_steps REAL;
      ALTER TABLE ${DRILL_SETS_TABLE} ADD COLUMN facing_degrees REAL;
    `);

    const rows = await db.getAllAsync<LegacySetRow>(
      `SELECT id, drill_id, ordinal, label, counts_from_previous, x_meters, y_meters
       FROM ${DRILL_SETS_TABLE}
       ORDER BY drill_id ASC, ordinal ASC, id ASC`,
    );
    const rowsByDrill = new Map<string, LegacySetRow[]>();
    for (const legacy of rows) {
      const list = rowsByDrill.get(legacy.drill_id) ?? [];
      list.push(legacy);
      rowsByDrill.set(legacy.drill_id, list);
    }

    for (const drillRows of rowsByDrill.values()) {
      await migrateLegacyDrillRows(db, drillRows);
    }

    await db.runAsync(
      `UPDATE ${APP_SETTINGS_TABLE} SET drill_terminology = 'sets' WHERE singleton_id = 1`,
    );
    await recordMigration(db, 2);
  });
}

async function migrateLegacyDrillRows(
  db: SQLiteDatabase,
  rows: readonly LegacySetRow[],
): Promise<void> {
  const parsed = rows.map((row) => parseLegacySetLabel(row.label));
  const reservedPrimaryNumbers = new Set<number>();
  for (const identity of parsed) {
    if (identity?.kind === "set") reservedPrimaryNumbers.add(identity.number);
  }

  const usedPrimaryNumbers = new Set<number>();
  const usedIdentities = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const candidate = parsed[index];
    let identity: LegacyIdentity | undefined;
    if (
      candidate?.kind === "set" &&
      !usedPrimaryNumbers.has(candidate.number)
    ) {
      identity = candidate;
    } else if (
      candidate?.kind === "subset" &&
      reservedPrimaryNumbers.has(candidate.number) &&
      !usedIdentities.has(identityKey(candidate))
    ) {
      identity = candidate;
    }

    if (!identity) {
      let fallback = Math.max(0, row.ordinal + 1);
      while (
        reservedPrimaryNumbers.has(fallback) ||
        usedPrimaryNumbers.has(fallback)
      ) {
        fallback += 1;
      }
      identity = { number: fallback, kind: "set" };
    }

    if (identity.kind === "set") usedPrimaryNumbers.add(identity.number);
    usedIdentities.add(identityKey(identity));

    // v1 stored X from the Side-1 goal line. Center it first, then project the
    // exact physical position onto the new conventional NFHS marching grid.
    const grid = physicalPointToDrillGrid(
      {
        xMeters: row.x_meters - HALF_FIELD_METERS,
        yMeters: row.y_meters,
      },
      NFHS_FIELD,
    );
    const counts =
      index === 0 ? 0 : normalizeLegacyCount(row.counts_from_previous);

    await db.runAsync(
      `UPDATE ${DRILL_SETS_TABLE}
       SET set_number = ?, set_suffix = ?, set_kind = ?, counts_from_previous = ?,
           x_steps = ?, y_steps = ?, facing_degrees = NULL,
           label = ?
       WHERE id = ?`,
      [
        identity.number,
        identity.suffix ?? null,
        identity.kind,
        counts,
        grid.xSteps,
        grid.ySteps,
        formatSetName(identity),
        row.id,
      ],
    );
  }
}

export function parseLegacySetLabel(label: string): LegacyIdentity | undefined {
  const match = label.trim().match(/^([0-9]+)([A-Z]|\.[0-9]+)?$/);
  if (!match) return undefined;
  const number = Number(match[1]);
  if (!Number.isSafeInteger(number)) return undefined;
  const suffix = match[2];
  return suffix ? { number, suffix, kind: "subset" } : { number, kind: "set" };
}

function identityKey(identity: LegacyIdentity): string {
  return `${identity.number}|${identity.suffix ?? ""}`;
}

function normalizeLegacyCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}

async function recordMigration(
  db: SQLiteDatabase,
  version: number,
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO ${MOBILE_SCHEMA_MIGRATIONS_TABLE}
      (version, applied_at) VALUES (?, ?)`,
    [version, Date.now()],
  );
  await db.execAsync(`PRAGMA user_version = ${version};`);
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
