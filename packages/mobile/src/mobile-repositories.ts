import type { SQLiteDatabase } from "expo-sqlite";
import {
  MOBILE_DB_NAME,
  prepareMobileDatabase,
} from "./storage/mobileDatabase";
import { SqliteDrillRepository } from "./drill/SqliteDrillRepository";
import { SqliteSettingsRepository } from "./settings/SqliteSettingsRepository";

export interface OpenMobileRepositoriesResult {
  readonly drillRepository: SqliteDrillRepository;
  readonly settingsRepository: SqliteSettingsRepository;
  close(): Promise<void>;
}

/**
 * Delete the disposable app-side SQLite database so it can be recreated from
 * the current schema on the next open. Callers must close every connection to
 * this database before invoking this helper. The separate PANS manager database
 * is intentionally unaffected.
 */
export async function deleteMobileDatabase(
  databaseName = MOBILE_DB_NAME,
): Promise<void> {
  const { deleteDatabaseAsync } = await import("expo-sqlite");
  await deleteDatabaseAsync(databaseName);
}

/**
 * Open the app-side repositories over one database connection.
 *
 * `expo-sqlite` is imported lazily so consumers of the pure field and drill
 * helpers do not load native SQLite at module evaluation time. Schema
 * preparation is owned here and runs before either repository is exposed.
 */
export async function openMobileRepositories(
  databaseName = MOBILE_DB_NAME,
): Promise<OpenMobileRepositoriesResult> {
  const { openDatabaseAsync } = await import("expo-sqlite");
  const database = await openDatabaseAsync(databaseName);
  try {
    await prepareMobileDatabase(database);
  } catch (cause) {
    await closeQuietly(database);
    throw cause;
  }

  return {
    drillRepository: new SqliteDrillRepository(database),
    settingsRepository: new SqliteSettingsRepository(database),
    close: async () => await database.closeAsync(),
  };
}

async function closeQuietly(database: SQLiteDatabase): Promise<void> {
  try {
    await database.closeAsync();
  } catch {
    // Preserve the schema/opening error rather than masking it with close.
  }
}
