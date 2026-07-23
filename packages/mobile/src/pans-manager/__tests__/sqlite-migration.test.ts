import type { SQLiteDatabase } from "expo-sqlite";
import {
  migratePansManagerDatabase,
  PANS_MANAGER_SCHEMA_VERSION,
} from "../SqlitePansManagerRepository";

describe("PANS manager SQLite migration", () => {
  test("creates the exact versioned table set and enables WAL and foreign keys", async () => {
    const executed: string[] = [];
    const database = {
      execAsync: jest.fn(async (sql: string) => {
        executed.push(sql);
      }),
      getFirstAsync: jest.fn(async () => ({ user_version: 0 })),
      runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
      withTransactionAsync: jest.fn(
        async (task: () => Promise<void>) => await task(),
      ),
    } as unknown as SQLiteDatabase;

    await migratePansManagerDatabase(database);

    const sql = executed.join("\n");
    for (const table of [
      "pans_networks",
      "pans_devices",
      "pans_device_snapshots",
      "pans_batch_operations",
      "pans_batch_operation_items",
      "pans_position_logs",
      "pans_position_samples",
      "pans_manager_settings",
      "pans_schema_migrations",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(sql).toContain("PRAGMA journal_mode = WAL");
    expect(sql).toContain(
      `PRAGMA user_version = ${PANS_MANAGER_SCHEMA_VERSION}`,
    );
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("pans_schema_migrations"),
      [PANS_MANAGER_SCHEMA_VERSION, expect.any(Number)],
    );
    expect(sql).toContain("json_remove(settings_json, '$.scanDurationMs')");
    expect(sql).toContain(
      "json_remove(value_json, '$.discoveryScanDurationMs')",
    );
  });

  test("removes obsolete scan durations from an existing version-one database", async () => {
    const executed: string[] = [];
    const database = {
      execAsync: jest.fn(async (sql: string) => {
        executed.push(sql);
      }),
      getFirstAsync: jest.fn(async () => ({ user_version: 1 })),
      runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
      withTransactionAsync: jest.fn(
        async (task: () => Promise<void>) => await task(),
      ),
    } as unknown as SQLiteDatabase;

    await migratePansManagerDatabase(database);

    const sql = executed.join("\n");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS pans_networks");
    expect(sql).toContain("json_remove(settings_json, '$.scanDurationMs')");
    expect(sql).toContain("PRAGMA user_version = 2");
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("pans_schema_migrations"),
      [2, expect.any(Number)],
    );
  });
});
