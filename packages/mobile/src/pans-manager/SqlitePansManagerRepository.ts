import type { SQLiteDatabase } from "expo-sqlite";
import { ManagerError } from "./errors";
import type { PansManagerRepository } from "./PansManagerRepository";
import type {
  DeviceConfigurationSnapshot,
  ManagedDevice,
  ManagedNetwork,
  NetworkDeviceAssociation,
  PansBatchOperationItem,
  PansBatchOperationRecord,
  PansManagerSettings,
  PositionLogSample,
  PositionLogSession,
} from "./types";
import {
  normalizeManagedNetworkSettings,
  normalizePansManagerSettings,
} from "./types";

export const PANS_MANAGER_DB_NAME = "eight2five-pans-manager.db";
export const PANS_MANAGER_SCHEMA_VERSION = 2;

export interface OpenPansManagerRepositoryResult {
  repository: SqlitePansManagerRepository;
  close(): Promise<void>;
}

/**
 * Opens manager storage without requiring an app workspace to depend on
 * expo-sqlite directly. The caller still owns repository initialization so it
 * can report opening and migration failures separately.
 */
export async function openPansManagerRepository(
  databaseName = PANS_MANAGER_DB_NAME,
): Promise<OpenPansManagerRepositoryResult> {
  const { openDatabaseAsync } = await import("expo-sqlite");
  const database = await openDatabaseAsync(databaseName);
  return {
    repository: new SqlitePansManagerRepository(database),
    close: async () => await database.closeAsync(),
  };
}

type SqlValue = string | number | null;
type Row = Record<string, SqlValue>;

export async function migratePansManagerDatabase(
  db: SQLiteDatabase,
): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const current =
    (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version ?? 0;
  if (current > PANS_MANAGER_SCHEMA_VERSION) {
    throw new ManagerError(
      "STORAGE_FAILURE",
      `Unsupported PANS manager database version ${current}.`,
    );
  }
  if (current === 0) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pans_schema_migrations (
          version INTEGER PRIMARY KEY NOT NULL,
          applied_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pans_networks (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          pan_id INTEGER NOT NULL CHECK (pan_id BETWEEN 0 AND 65535),
          settings_json TEXT NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_opened_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS pans_devices (
          id TEXT PRIMARY KEY NOT NULL,
          network_id TEXT REFERENCES pans_networks(id) ON DELETE SET NULL,
          transport_device_id TEXT NOT NULL UNIQUE,
          mac_address TEXT,
          node_id_hex TEXT,
          nickname TEXT,
          label TEXT,
          role TEXT CHECK (role IN ('tag', 'anchor')),
          last_known_config_json TEXT,
          last_seen_at INTEGER,
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pans_devices_network ON pans_devices(network_id);
        CREATE TABLE IF NOT EXISTS pans_device_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT NOT NULL REFERENCES pans_devices(id) ON DELETE CASCADE,
          captured_at INTEGER NOT NULL,
          config_json TEXT NOT NULL,
          inspection_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_pans_snapshots_device_time
          ON pans_device_snapshots(device_id, captured_at);
        CREATE TABLE IF NOT EXISTS pans_batch_operations (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL,
          total_items INTEGER NOT NULL,
          completed_items INTEGER NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          metadata_json TEXT
        );
        CREATE TABLE IF NOT EXISTS pans_batch_operation_items (
          batch_id TEXT NOT NULL REFERENCES pans_batch_operations(id) ON DELETE CASCADE,
          device_id TEXT NOT NULL,
          item_index INTEGER NOT NULL,
          status TEXT NOT NULL,
          attempts INTEGER NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,
          result_json TEXT,
          error_json TEXT,
          PRIMARY KEY (batch_id, device_id)
        );
        CREATE TABLE IF NOT EXISTS pans_position_logs (
          id TEXT PRIMARY KEY NOT NULL,
          network_id TEXT NOT NULL,
          pan_id INTEGER NOT NULL,
          device_id TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          notes TEXT,
          metadata_json TEXT
        );
        CREATE TABLE IF NOT EXISTS pans_position_samples (
          session_id TEXT NOT NULL REFERENCES pans_position_logs(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL,
          timestamp_ms INTEGER NOT NULL,
          network_id TEXT NOT NULL,
          pan_id INTEGER NOT NULL,
          device_id TEXT NOT NULL,
          node_id TEXT,
          label TEXT,
          x_m REAL NOT NULL,
          y_m REAL NOT NULL,
          z_m REAL NOT NULL,
          quality INTEGER NOT NULL,
          solver TEXT NOT NULL,
          anchor_count INTEGER NOT NULL,
          distances_json TEXT,
          notes TEXT,
          event_marker TEXT,
          PRIMARY KEY (session_id, sequence)
        );
        CREATE TABLE IF NOT EXISTS pans_manager_settings (
          singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
          value_json TEXT NOT NULL
        );
      `);
      await db.runAsync(
        "INSERT OR REPLACE INTO pans_schema_migrations (version, applied_at) VALUES (?, ?)",
        [1, Date.now()],
      );
      await db.execAsync("PRAGMA user_version = 1;");
    });
  }
  if (current < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        UPDATE pans_networks
        SET settings_json = json_remove(settings_json, '$.scanDurationMs');
        UPDATE pans_manager_settings
        SET value_json = json_remove(value_json, '$.discoveryScanDurationMs');
      `);
      await db.runAsync(
        "INSERT OR REPLACE INTO pans_schema_migrations (version, applied_at) VALUES (?, ?)",
        [2, Date.now()],
      );
      await db.execAsync("PRAGMA user_version = 2;");
    });
  }
  await db.execAsync("PRAGMA foreign_keys = ON;");
}

export class SqlitePansManagerRepository implements PansManagerRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async initialize(): Promise<void> {
    await migratePansManagerDatabase(this.db);
  }

  async listNetworks(): Promise<ManagedNetwork[]> {
    return (
      await this.db.getAllAsync<Row>(
        "SELECT * FROM pans_networks ORDER BY name COLLATE NOCASE",
      )
    ).map(toNetwork);
  }

  async getNetwork(id: string): Promise<ManagedNetwork | undefined> {
    return optionalMap(
      await this.db.getFirstAsync<Row>(
        "SELECT * FROM pans_networks WHERE id = ?",
        [id],
      ),
      toNetwork,
    );
  }

  async saveNetwork(network: ManagedNetwork): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pans_networks
       (id, name, pan_id, settings_json, notes, created_at, updated_at, last_opened_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, pan_id=excluded.pan_id,
       settings_json=excluded.settings_json, notes=excluded.notes,
       updated_at=excluded.updated_at, last_opened_at=excluded.last_opened_at`,
      [
        network.id,
        network.name,
        network.panId,
        stringifyJson(normalizeManagedNetworkSettings(network.settings)),
        nullable(network.notes),
        network.createdAt,
        network.updatedAt,
        nullableNumber(network.lastOpenedAt),
      ],
    );
  }

  async deleteNetwork(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        "DELETE FROM pans_position_logs WHERE network_id = ?",
        [id],
      );
      await this.db.runAsync("DELETE FROM pans_networks WHERE id = ?", [id]);
    });
  }

  async listDevices(): Promise<ManagedDevice[]> {
    return (
      await this.db.getAllAsync<Row>("SELECT * FROM pans_devices ORDER BY id")
    ).map(toDevice);
  }

  async getDevice(id: string): Promise<ManagedDevice | undefined> {
    return optionalMap(
      await this.db.getFirstAsync<Row>(
        "SELECT * FROM pans_devices WHERE id = ?",
        [id],
      ),
      toDevice,
    );
  }

  async saveDevice(device: ManagedDevice): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pans_devices
       (id, network_id, transport_device_id, mac_address, node_id_hex, nickname, label,
        role, last_known_config_json, last_seen_at, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET network_id=excluded.network_id,
       transport_device_id=excluded.transport_device_id, mac_address=excluded.mac_address,
       node_id_hex=excluded.node_id_hex, nickname=excluded.nickname, label=excluded.label,
       role=excluded.role, last_known_config_json=excluded.last_known_config_json,
       last_seen_at=excluded.last_seen_at, notes=excluded.notes, updated_at=excluded.updated_at`,
      [
        device.id,
        nullable(device.networkId),
        device.transportDeviceId,
        nullable(device.macAddress),
        nullable(device.nodeIdHex),
        nullable(device.nickname),
        nullable(device.label),
        nullable(device.role),
        json(device.lastKnownConfig),
        nullableNumber(device.lastSeenAt),
        nullable(device.notes),
        device.createdAt,
        device.updatedAt,
      ],
    );
  }

  async deleteDevice(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        "DELETE FROM pans_position_logs WHERE device_id = ?",
        [id],
      );
      await this.db.runAsync("DELETE FROM pans_devices WHERE id = ?", [id]);
    });
  }

  async listNetworkDevices(networkId: string): Promise<ManagedDevice[]> {
    return (
      await this.db.getAllAsync<Row>(
        "SELECT * FROM pans_devices WHERE network_id = ? ORDER BY id",
        [networkId],
      )
    ).map(toDevice);
  }

  async associateDevice(association: NetworkDeviceAssociation): Promise<void> {
    await this.requireAssociationRecords(
      association.networkId,
      association.deviceId,
      "associate device",
    );
    await this.db.runAsync(
      "UPDATE pans_devices SET network_id = ?, updated_at = ? WHERE id = ?",
      [association.networkId, association.associatedAt, association.deviceId],
    );
  }

  async dissociateDevice(
    networkId: string,
    deviceId: string,
    dissociatedAt = Date.now(),
  ): Promise<void> {
    const device = await this.requireAssociationRecords(
      networkId,
      deviceId,
      "dissociate device",
    );
    if (device.networkId !== networkId) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "The device is not associated with that network profile.",
        { deviceId, operation: "dissociate device" },
      );
    }
    await this.db.runAsync(
      "UPDATE pans_devices SET network_id = NULL, updated_at = ? WHERE id = ? AND network_id = ?",
      [dissociatedAt, deviceId, networkId],
    );
  }

  private async requireAssociationRecords(
    networkId: string,
    deviceId: string,
    operation: string,
  ): Promise<ManagedDevice> {
    const [device, network] = await Promise.all([
      this.getDevice(deviceId),
      this.getNetwork(networkId),
    ]);
    if (!device) {
      throw new ManagerError(
        "DEVICE_NOT_FOUND",
        "The managed device does not exist.",
        { deviceId, operation },
      );
    }
    if (!network) {
      throw new ManagerError(
        "INVALID_CONFIGURATION",
        "The target network profile does not exist.",
        { deviceId, operation },
      );
    }
    return device;
  }

  async getSettings(): Promise<PansManagerSettings | undefined> {
    const row = await this.db.getFirstAsync<{ value_json: string }>(
      "SELECT value_json FROM pans_manager_settings WHERE singleton_id = ?",
      [1],
    );
    return row
      ? normalizePansManagerSettings(
          parseJson(row.value_json, "manager settings"),
        )
      : undefined;
  }

  async saveSettings(settings: PansManagerSettings): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pans_manager_settings (singleton_id, value_json) VALUES (?, ?)
       ON CONFLICT(singleton_id) DO UPDATE SET value_json=excluded.value_json`,
      [1, stringifyJson(normalizePansManagerSettings(settings))],
    );
  }

  async saveDeviceSnapshot(
    snapshot: DeviceConfigurationSnapshot,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pans_device_snapshots (device_id, captured_at, config_json, inspection_json)
       VALUES (?, ?, ?, ?)`,
      [
        snapshot.deviceId,
        snapshot.capturedAt,
        stringifyJson(snapshot.config),
        json(snapshot.inspection),
      ],
    );
  }

  async getLatestDeviceSnapshot(
    deviceId: string,
  ): Promise<DeviceConfigurationSnapshot | undefined> {
    return optionalMap(
      await this.db.getFirstAsync<Row>(
        `SELECT * FROM pans_device_snapshots WHERE device_id = ?
         ORDER BY captured_at DESC, id DESC LIMIT 1`,
        [deviceId],
      ),
      toSnapshot,
    );
  }

  async listDeviceSnapshots(
    deviceId: string,
  ): Promise<DeviceConfigurationSnapshot[]> {
    return (
      await this.db.getAllAsync<Row>(
        "SELECT * FROM pans_device_snapshots WHERE device_id = ? ORDER BY captured_at, id",
        [deviceId],
      )
    ).map(toSnapshot);
  }

  async saveBatchOperation(operation: PansBatchOperationRecord): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pans_batch_operations
       (id, type, status, total_items, completed_items, started_at, completed_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status=excluded.status,
       total_items=excluded.total_items, completed_items=excluded.completed_items,
       completed_at=excluded.completed_at, metadata_json=excluded.metadata_json`,
      [
        operation.id,
        operation.type,
        operation.status,
        operation.totalItems,
        operation.completedItems,
        operation.startedAt,
        nullableNumber(operation.completedAt),
        json(operation.metadata),
      ],
    );
  }

  async getBatchOperation(
    id: string,
  ): Promise<PansBatchOperationRecord | undefined> {
    return optionalMap(
      await this.db.getFirstAsync<Row>(
        "SELECT * FROM pans_batch_operations WHERE id = ?",
        [id],
      ),
      toBatch,
    );
  }

  async listBatchOperations(): Promise<PansBatchOperationRecord[]> {
    return (
      await this.db.getAllAsync<Row>(
        "SELECT * FROM pans_batch_operations ORDER BY started_at DESC",
      )
    ).map(toBatch);
  }

  async saveBatchItem(item: PansBatchOperationItem): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pans_batch_operation_items
       (batch_id, device_id, item_index, status, attempts, started_at, completed_at, result_json, error_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(batch_id, device_id) DO UPDATE SET item_index=excluded.item_index,
       status=excluded.status, attempts=excluded.attempts, started_at=excluded.started_at,
       completed_at=excluded.completed_at, result_json=excluded.result_json,
       error_json=excluded.error_json`,
      [
        item.batchId,
        item.deviceId,
        item.index,
        item.status,
        item.attempts,
        nullableNumber(item.startedAt),
        nullableNumber(item.completedAt),
        json(item.result),
        json(item.error),
      ],
    );
  }

  async listBatchItems(batchId: string): Promise<PansBatchOperationItem[]> {
    return (
      await this.db.getAllAsync<Row>(
        "SELECT * FROM pans_batch_operation_items WHERE batch_id = ? ORDER BY item_index",
        [batchId],
      )
    ).map(toBatchItem);
  }

  async savePositionLogSession(session: PositionLogSession): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO pans_position_logs
       (id, network_id, pan_id, device_id, started_at, ended_at, notes, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET network_id=excluded.network_id, pan_id=excluded.pan_id,
       device_id=excluded.device_id, ended_at=excluded.ended_at,
       notes=excluded.notes, metadata_json=excluded.metadata_json`,
      [
        session.id,
        session.networkId,
        session.panId,
        session.deviceId,
        session.startedAt,
        nullableNumber(session.endedAt),
        nullable(session.notes),
        json(session.metadata),
      ],
    );
  }

  async getPositionLogSession(
    id: string,
  ): Promise<PositionLogSession | undefined> {
    return optionalMap(
      await this.db.getFirstAsync<Row>(
        "SELECT * FROM pans_position_logs WHERE id = ?",
        [id],
      ),
      toLogSession,
    );
  }

  async listPositionLogSessions(): Promise<PositionLogSession[]> {
    return (
      await this.db.getAllAsync<Row>(
        "SELECT * FROM pans_position_logs ORDER BY started_at DESC",
      )
    ).map(toLogSession);
  }

  async appendPositionLogSamples(samples: PositionLogSample[]): Promise<void> {
    if (!samples.length) return;
    await this.db.withTransactionAsync(async () => {
      for (const sample of samples) {
        await this.db.runAsync(
          `INSERT INTO pans_position_samples
           (session_id, sequence, timestamp_ms, network_id, pan_id, device_id, node_id,
            label, x_m, y_m, z_m, quality, solver, anchor_count, distances_json, notes, event_marker)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(session_id, sequence) DO UPDATE SET timestamp_ms=excluded.timestamp_ms,
           network_id=excluded.network_id, pan_id=excluded.pan_id, device_id=excluded.device_id,
           node_id=excluded.node_id, label=excluded.label, x_m=excluded.x_m, y_m=excluded.y_m,
           z_m=excluded.z_m, quality=excluded.quality, solver=excluded.solver,
           anchor_count=excluded.anchor_count, distances_json=excluded.distances_json,
           notes=excluded.notes, event_marker=excluded.event_marker`,
          [
            sample.sessionId,
            sample.sequence,
            sample.timestampMs,
            sample.networkId,
            sample.panId,
            sample.deviceId,
            nullable(sample.nodeId),
            nullable(sample.label),
            sample.xMeters,
            sample.yMeters,
            sample.zMeters,
            sample.quality,
            sample.solver,
            sample.anchorCount,
            json(sample.distances),
            nullable(sample.notes),
            nullable(sample.eventMarker),
          ],
        );
      }
    });
  }

  async listPositionLogSamples(
    sessionId: string,
  ): Promise<PositionLogSample[]> {
    return (
      await this.db.getAllAsync<Row>(
        "SELECT * FROM pans_position_samples WHERE session_id = ? ORDER BY sequence",
        [sessionId],
      )
    ).map(toLogSample);
  }
}

function toNetwork(row: Row): ManagedNetwork {
  return {
    id: text(row.id),
    name: text(row.name),
    panId: number(row.pan_id),
    settings: normalizeManagedNetworkSettings(
      parseJson(text(row.settings_json), "network settings"),
    ),
    ...(hasValue(row.notes) ? { notes: text(row.notes) } : {}),
    createdAt: number(row.created_at),
    updatedAt: number(row.updated_at),
    ...(hasValue(row.last_opened_at)
      ? { lastOpenedAt: number(row.last_opened_at) }
      : {}),
  };
}

function toDevice(row: Row): ManagedDevice {
  return {
    id: text(row.id),
    ...(hasValue(row.network_id) ? { networkId: text(row.network_id) } : {}),
    transportDeviceId: text(row.transport_device_id),
    ...(hasValue(row.mac_address) ? { macAddress: text(row.mac_address) } : {}),
    ...(hasValue(row.node_id_hex) ? { nodeIdHex: text(row.node_id_hex) } : {}),
    ...(hasValue(row.nickname) ? { nickname: text(row.nickname) } : {}),
    ...(hasValue(row.label) ? { label: text(row.label) } : {}),
    ...(hasValue(row.role)
      ? { role: text(row.role) as ManagedDevice["role"] }
      : {}),
    ...(hasValue(row.last_known_config_json)
      ? {
          lastKnownConfig: parseJson(
            text(row.last_known_config_json),
            "last known configuration",
          ),
        }
      : {}),
    ...(hasValue(row.last_seen_at)
      ? { lastSeenAt: number(row.last_seen_at) }
      : {}),
    ...(hasValue(row.notes) ? { notes: text(row.notes) } : {}),
    createdAt: number(row.created_at),
    updatedAt: number(row.updated_at),
  };
}

function toSnapshot(row: Row): DeviceConfigurationSnapshot {
  return {
    deviceId: text(row.device_id),
    capturedAt: number(row.captured_at),
    config: parseJson(text(row.config_json), "device configuration"),
    ...(hasValue(row.inspection_json)
      ? {
          inspection: parseJson(text(row.inspection_json), "device inspection"),
        }
      : {}),
  };
}

function toBatch(row: Row): PansBatchOperationRecord {
  return {
    id: text(row.id),
    type: text(row.type),
    status: text(row.status) as PansBatchOperationRecord["status"],
    totalItems: number(row.total_items),
    completedItems: number(row.completed_items),
    startedAt: number(row.started_at),
    ...(hasValue(row.completed_at)
      ? { completedAt: number(row.completed_at) }
      : {}),
    ...(hasValue(row.metadata_json)
      ? { metadata: parseJson(text(row.metadata_json), "batch metadata") }
      : {}),
  };
}

function toBatchItem(row: Row): PansBatchOperationItem {
  return {
    batchId: text(row.batch_id),
    deviceId: text(row.device_id),
    index: number(row.item_index),
    status: text(row.status) as PansBatchOperationItem["status"],
    attempts: number(row.attempts),
    ...(hasValue(row.started_at) ? { startedAt: number(row.started_at) } : {}),
    ...(hasValue(row.completed_at)
      ? { completedAt: number(row.completed_at) }
      : {}),
    ...(hasValue(row.result_json)
      ? { result: parseJson(text(row.result_json), "batch result") }
      : {}),
    ...(hasValue(row.error_json)
      ? { error: parseJson(text(row.error_json), "batch error") }
      : {}),
  };
}

function toLogSession(row: Row): PositionLogSession {
  return {
    id: text(row.id),
    networkId: text(row.network_id),
    panId: number(row.pan_id),
    deviceId: text(row.device_id),
    startedAt: number(row.started_at),
    ...(hasValue(row.ended_at) ? { endedAt: number(row.ended_at) } : {}),
    ...(hasValue(row.notes) ? { notes: text(row.notes) } : {}),
    ...(hasValue(row.metadata_json)
      ? { metadata: parseJson(text(row.metadata_json), "log metadata") }
      : {}),
  };
}

function toLogSample(row: Row): PositionLogSample {
  return {
    sessionId: text(row.session_id),
    sequence: number(row.sequence),
    timestampMs: number(row.timestamp_ms),
    networkId: text(row.network_id),
    panId: number(row.pan_id),
    deviceId: text(row.device_id),
    ...(hasValue(row.node_id) ? { nodeId: text(row.node_id) } : {}),
    ...(hasValue(row.label) ? { label: text(row.label) } : {}),
    xMeters: number(row.x_m),
    yMeters: number(row.y_m),
    zMeters: number(row.z_m),
    quality: number(row.quality),
    solver: text(row.solver),
    anchorCount: number(row.anchor_count),
    ...(hasValue(row.distances_json)
      ? { distances: parseJson(text(row.distances_json), "distances") }
      : {}),
    ...(hasValue(row.notes) ? { notes: text(row.notes) } : {}),
    ...(hasValue(row.event_marker)
      ? { eventMarker: text(row.event_marker) }
      : {}),
  };
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (cause) {
    throw new ManagerError("STORAGE_FAILURE", `Stored ${label} is invalid.`, {
      cause,
    });
  }
}

function stringifyJson(value: unknown): string {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined)
      throw new Error("Value is not JSON serializable.");
    return encoded;
  } catch (cause) {
    throw new ManagerError(
      "STORAGE_FAILURE",
      "A value could not be stored as JSON.",
      { cause },
    );
  }
}

function json(value: unknown): string | null {
  return value === undefined ? null : stringifyJson(value);
}
function nullable(value: string | undefined): string | null {
  return value ?? null;
}
function nullableNumber(value: number | undefined): number | null {
  return value ?? null;
}
function text(value: SqlValue | undefined): string {
  return String(value ?? "");
}
function number(value: SqlValue | undefined): number {
  return Number(value);
}
function hasValue(value: SqlValue | undefined): value is string | number {
  return value !== null && value !== undefined;
}
function optionalMap<T>(
  row: Row | null,
  map: (value: Row) => T,
): T | undefined {
  return row ? map(row) : undefined;
}
