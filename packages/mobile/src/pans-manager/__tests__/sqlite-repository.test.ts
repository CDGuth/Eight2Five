import type { SQLiteDatabase } from "expo-sqlite";
import { SqlitePansManagerRepository } from "../SqlitePansManagerRepository";
import { DEFAULT_MANAGED_NETWORK_SETTINGS } from "../types";

describe("SqlitePansManagerRepository contracts", () => {
  test("saveNetworks uses one transaction and returns rows in input order", async () => {
    const rows = {
      first: networkRow("first", "First"),
      second: networkRow("second", "Second"),
    };
    const database = {
      runAsync: jest.fn(async () => ({ lastInsertRowId: 1, changes: 1 })),
      getFirstAsync: jest.fn(
        async (_sql: string, params: (string | number)[]) =>
          rows[params[0] as keyof typeof rows] ?? null,
      ),
      withTransactionAsync: jest.fn(
        async (task: () => Promise<void>) => await task(),
      ),
    } as unknown as SQLiteDatabase;
    const repository = new SqlitePansManagerRepository(database);

    const saved = await repository.saveNetworks([
      network("second", "Second"),
      network("first", "First"),
    ]);

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync).toHaveBeenCalledTimes(2);
    expect(saved.map(({ id }) => id)).toEqual(["second", "first"]);
  });

  test("bulk latest snapshots use one query with deterministic ties", async () => {
    const getAllAsync = jest.fn(async () => [
      snapshotRow(2, "a", 10, "newer-id"),
      snapshotRow(3, "b", 20, "B"),
    ]);
    const database = { getAllAsync } as unknown as SQLiteDatabase;
    const repository = new SqlitePansManagerRepository(database);

    expect(await repository.getLatestDeviceSnapshots([])).toEqual({});
    const latest = await repository.getLatestDeviceSnapshots([
      "a",
      "missing",
      "b",
    ]);

    expect(getAllAsync).toHaveBeenCalledTimes(1);
    expect(getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "PARTITION BY device_id ORDER BY captured_at DESC, id DESC",
      ),
      ["a", "missing", "b"],
    );
    expect(latest.a?.config.label).toBe("newer-id");
    expect(latest.b?.config.label).toBe("B");
    expect(latest.missing).toBeUndefined();
  });
});

function network(id: string, name: string) {
  return {
    id,
    name,
    panId: 1,
    settings: DEFAULT_MANAGED_NETWORK_SETTINGS,
    createdAt: 1,
    updatedAt: 1,
  };
}

function networkRow(id: string, name: string) {
  return {
    id,
    name,
    pan_id: 1,
    settings_json: JSON.stringify(DEFAULT_MANAGED_NETWORK_SETTINGS),
    notes: null,
    created_at: 1,
    updated_at: 1,
    last_opened_at: null,
  };
}

function snapshotRow(
  id: number,
  deviceId: string,
  capturedAt: number,
  label: string,
) {
  return {
    id,
    device_id: deviceId,
    captured_at: capturedAt,
    config_json: JSON.stringify({
      role: "anchor",
      label,
      uwbMode: "active",
      ledEnabled: true,
      firmwareUpdateEnabled: false,
      initiatorEnabled: false,
    }),
    inspection_json: null,
    latest_rank: 1,
  };
}
