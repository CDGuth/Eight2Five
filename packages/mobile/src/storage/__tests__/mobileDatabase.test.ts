import { FIELD_PRESET_IDS } from "@eight2five/drill-schema";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  MOBILE_DB_NAME,
  MOBILE_SCHEMA_VERSION,
  prepareMobileDatabase,
} from "../mobileDatabase";

describe("mobile app SQLite schema preparation", () => {
  test("creates the current disposable development schema", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(0, executed);

    await prepareMobileDatabase(database);

    const sql = executed.join("\n");
    expect(MOBILE_DB_NAME).toBe("eight2five-mobile.db");
    expect(MOBILE_SCHEMA_VERSION).toBe(3);
    expect(sql).toContain("PRAGMA journal_mode = WAL");
    expect(sql).toContain("PRAGMA foreign_keys = OFF");
    expect(sql).toContain("DROP TABLE IF EXISTS app_settings");
    expect(sql).toContain("DROP TABLE IF EXISTS drill_pages");
    expect(sql).toContain("CREATE TABLE drills");
    expect(sql).toContain("CREATE TABLE drill_sets");
    expect(sql).toContain("field_preset TEXT NOT NULL DEFAULT 'football-nfhs'");
    for (const fieldPreset of FIELD_PRESET_IDS) {
      expect(sql).toContain(`'${fieldPreset}'`);
    }
    expect(sql).toContain("set_number INTEGER NOT NULL");
    expect(sql).toContain("x_steps REAL NOT NULL");
    expect(sql).not.toContain("x_meters REAL");
    expect(sql).not.toContain("y_meters REAL");
    expect(sql).toContain("CREATE TABLE app_settings");
    expect(sql).toContain("default_field_preset TEXT NOT NULL");
    expect(sql).toContain("show_perimeter_step_grid INTEGER NOT NULL");
    expect(sql).toContain("REFERENCES drills(id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES drill_sets(id) ON DELETE SET NULL");
    expect(sql).toContain(`PRAGMA user_version = ${MOBILE_SCHEMA_VERSION}`);
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  test("destructively rebuilds an older development layout without migrations", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(MOBILE_SCHEMA_VERSION - 1, executed);

    await prepareMobileDatabase(database);

    const sql = executed.join("\n");
    expect(sql).toContain("DROP TABLE IF EXISTS app_settings");
    expect(sql).toContain("DROP TABLE IF EXISTS drill_sets");
    expect(sql).toContain("DROP TABLE IF EXISTS drills");
    expect(sql).toContain("CREATE TABLE app_settings");
    expect(sql).not.toContain("ALTER TABLE");
    expect(sql).not.toContain("mobile_schema_migrations (");
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  test("keeps a current schema without rebuilding it", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(MOBILE_SCHEMA_VERSION, executed);

    await prepareMobileDatabase(database);

    const sql = executed.join("\n");
    expect(sql).toContain("PRAGMA journal_mode = WAL");
    expect(sql).toContain("PRAGMA foreign_keys = ON");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("CREATE TABLE");
    expect(database.withTransactionAsync).not.toHaveBeenCalled();
  });

  test("rejects a database newer than the package schema", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(MOBILE_SCHEMA_VERSION + 1, executed);

    await expect(prepareMobileDatabase(database)).rejects.toThrow(
      `Unsupported mobile database version ${MOBILE_SCHEMA_VERSION + 1}`,
    );
    expect(database.withTransactionAsync).not.toHaveBeenCalled();
    expect(executed.join("\n")).not.toContain("DROP TABLE");
  });
});

function fakeDatabase(version: number, executed: string[]) {
  return {
    execAsync: jest.fn(async (sql: string) => {
      executed.push(sql);
    }),
    getFirstAsync: jest.fn(async () => ({ user_version: version })),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
    withTransactionAsync: jest.fn(
      async (task: () => Promise<void>) => await task(),
    ),
  } as unknown as SQLiteDatabase & {
    runAsync: jest.Mock;
    withTransactionAsync: jest.Mock;
  };
}
