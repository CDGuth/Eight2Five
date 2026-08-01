import type { SQLiteDatabase } from "expo-sqlite";
import {
  migrateMobileDatabase,
  MOBILE_DB_NAME,
  MOBILE_SCHEMA_VERSION,
} from "../mobileDatabase";

describe("mobile app SQLite migration", () => {
  test("creates the relational schema, defaults, indexes, WAL, and foreign keys", async () => {
    const executed: string[] = [];
    const database = fakeDatabase(0, executed);

    await migrateMobileDatabase(database);

    const sql = executed.join("\n");
    expect(MOBILE_DB_NAME).toBe("eight2five-mobile.db");
    expect(sql).toContain("PRAGMA journal_mode = WAL");
    expect(sql).toContain("PRAGMA foreign_keys = ON");
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS mobile_schema_migrations",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS drills");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS drill_pages");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS app_settings");
    expect(sql).toContain("REFERENCES drills(id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES drills(id) ON DELETE SET NULL");
    expect(sql).toContain("REFERENCES drill_pages(id) ON DELETE SET NULL");
    expect(sql).toContain("UNIQUE (drill_id, ordinal)");
    expect(sql).toContain("idx_drill_pages_drill");
    expect(sql).toContain("DEFAULT 'pages'");
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
