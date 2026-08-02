import type { SQLiteDatabase } from "expo-sqlite";
import {
  migrateMobileDatabase,
  MOBILE_DB_NAME,
  MOBILE_SCHEMA_VERSION,
  parseLegacySetLabel,
} from "../mobileDatabase";

describe("mobile app SQLite migration", () => {
  test("creates the v2 relational schema, set model, defaults, WAL, and foreign keys", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(0, executed);

    await migrateMobileDatabase(database);

    const sql = executed.join("\n");
    expect(MOBILE_DB_NAME).toBe("eight2five-mobile.db");
    expect(MOBILE_SCHEMA_VERSION).toBe(2);
    expect(sql).toContain("PRAGMA journal_mode = WAL");
    expect(sql).toContain("PRAGMA foreign_keys = ON");
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS mobile_schema_migrations",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS drills");
    expect(sql).toContain("field_preset TEXT NOT NULL DEFAULT 'football-nfhs'");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS drill_pages");
    expect(sql).toContain("set_number INTEGER NOT NULL");
    expect(sql).toContain("set_kind TEXT NOT NULL");
    expect(sql).toContain("measure_start INTEGER");
    expect(sql).toContain("x_steps REAL NOT NULL");
    expect(sql).toContain("facing_degrees REAL");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS app_settings");
    expect(sql).toContain("REFERENCES drills(id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES drills(id) ON DELETE SET NULL");
    expect(sql).toContain("REFERENCES drill_pages(id) ON DELETE SET NULL");
    expect(sql).toContain("UNIQUE (drill_id, ordinal)");
    expect(sql).toContain("idx_drill_sets_drill");
    expect(sql).toContain("DEFAULT 'sets'");
    expect(sql).toContain("DEFAULT 'director'");
    expect(sql).toContain("DEFAULT 'step-size'");
    expect(sql).toContain("DEFAULT 20");
    expect(sql).toContain(`PRAGMA user_version = ${MOBILE_SCHEMA_VERSION}`);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("mobile_schema_migrations"),
      [MOBILE_SCHEMA_VERSION, expect.any(Number)],
    );
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  test("migrates v1 labels and physical coordinates into explicit set/grid fields", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(1, executed, [
      {
        id: "legacy-1",
        drill_id: "drill",
        ordinal: 0,
        label: "31",
        counts_from_previous: 8,
        x_meters: 45.72,
        y_meters: 0,
      },
      {
        id: "legacy-2",
        drill_id: "drill",
        ordinal: 1,
        label: "31A",
        counts_from_previous: 8,
        x_meters: 45.72,
        y_meters: 16.256,
      },
      {
        id: "legacy-3",
        drill_id: "drill",
        ordinal: 2,
        label: "Finale",
        counts_from_previous: 2.5,
        x_meters: 45.72,
        y_meters: 32.512,
      },
    ]);

    await migrateMobileDatabase(database);

    const sql = executed.join("\n");
    expect(sql).toContain("ADD COLUMN set_number INTEGER");
    expect(sql).toContain("ADD COLUMN x_steps REAL");
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("drill_terminology = 'sets'"),
    );
    expect(sql).toContain("PRAGMA user_version = 2");

    const migrationUpdates = database.runAsync.mock.calls.filter(
      ([statement]) => String(statement).includes("SET set_number = ?"),
    );
    expect(migrationUpdates).toHaveLength(3);
    expect(migrationUpdates[0][1]).toEqual([
      31,
      null,
      "set",
      0,
      expect.closeTo(0, 8),
      expect.closeTo(0, 8),
      "31",
      "legacy-1",
    ]);
    expect(migrationUpdates[1][1]).toEqual([
      31,
      "A",
      "subset",
      8,
      expect.closeTo(0, 8),
      expect.closeTo(28, 8),
      "31A",
      "legacy-2",
    ]);
    expect(migrationUpdates[2][1]).toEqual([
      3,
      null,
      "set",
      3,
      expect.closeTo(0, 8),
      expect.closeTo(56, 8),
      "3",
      "legacy-3",
    ]);
  });

  test("parses only safe numeric and supported subset legacy labels", () => {
    expect(parseLegacySetLabel("31")).toEqual({ number: 31, kind: "set" });
    expect(parseLegacySetLabel("31A")).toEqual({
      number: 31,
      suffix: "A",
      kind: "subset",
    });
    expect(parseLegacySetLabel("31.5")).toEqual({
      number: 31,
      suffix: ".5",
      kind: "subset",
    });
    expect(parseLegacySetLabel("Finale")).toBeUndefined();
  });

  test("rejects a database newer than the package schema without migrating it", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(MOBILE_SCHEMA_VERSION + 1, executed);

    await expect(migrateMobileDatabase(database)).rejects.toThrow(
      `Unsupported mobile database version ${MOBILE_SCHEMA_VERSION + 1}`,
    );
    expect(database.withTransactionAsync).not.toHaveBeenCalled();
    expect(executed.join("\n")).not.toContain(
      "CREATE TABLE IF NOT EXISTS drills",
    );
  });
});

function fakeDatabase(
  version: number,
  executed: string[],
  rows: readonly Record<string, unknown>[] = [],
) {
  return {
    execAsync: jest.fn(async (sql: string) => {
      executed.push(sql);
    }),
    getFirstAsync: jest.fn(async () => ({ user_version: version })),
    getAllAsync: jest.fn(async () => rows.map((row) => ({ ...row }))),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
    withTransactionAsync: jest.fn(
      async (task: () => Promise<void>) => await task(),
    ),
  } as unknown as SQLiteDatabase & {
    runAsync: jest.Mock;
    withTransactionAsync: jest.Mock;
  };
}
