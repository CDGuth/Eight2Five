import { FIELD_PRESET_IDS, type FieldPresetId } from "@eight2five/drill-schema";
import type { SQLiteDatabase } from "expo-sqlite";
import { SqliteDrillRepository } from "../SqliteDrillRepository";

describe("SqliteDrillRepository", () => {
  test("uses stable factories and deterministic drill/set ordering", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill-1", "drill-2", "set-1", "set-2", "set-3"];
    const times = [20, 10];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => times.shift()!,
    });

    const first = await repository.createDrill("First");
    const second = await repository.createDrill("Second");
    expect(first).toMatchObject({
      id: "drill-1",
      fieldPreset: "football-nfhs",
      createdAt: 20,
      updatedAt: 20,
    });
    expect(second).toMatchObject({
      id: "drill-2",
      createdAt: 10,
      updatedAt: 10,
    });
    expect((await repository.listDrills()).map(({ id }) => id)).toEqual([
      "drill-2",
      "drill-1",
    ]);

    const firstSet = await repository.createSet({
      drillId: first.id,
      number: 31,
      position: { xSteps: 0, ySteps: 0 },
    });
    const secondSet = await repository.createSet({
      drillId: first.id,
      number: 32,
      countsFromPrevious: 16,
      measureRange: { start: 126, end: 129 },
      position: { xSteps: 0, ySteps: 32 },
    });
    expect(firstSet).toMatchObject({
      id: "set-1",
      ordinal: 0,
      number: 31,
      kind: "set",
      countsFromPrevious: 0,
    });
    expect(secondSet).toMatchObject({
      id: "set-2",
      ordinal: 1,
      number: 32,
      countsFromPrevious: 16,
      measureRange: { start: 126, end: 129 },
      position: { xSteps: 0, ySteps: 32 },
    });
    expect((await repository.listSets(first.id)).map(({ id }) => id)).toEqual([
      "set-1",
      "set-2",
    ]);
  });

  test.each(FIELD_PRESET_IDS)(
    "round-trips the %s field preset",
    async (fieldPreset) => {
      const fake = new DrillFakeDatabase();
      const repository = new SqliteDrillRepository(fake.database, {
        idFactory: () => `drill-${fieldPreset}`,
        timeFactory: () => 1,
      });

      await expect(
        repository.createDrill({ name: fieldPreset, fieldPreset }),
      ).resolves.toMatchObject({ fieldPreset });
      await expect(repository.listDrills()).resolves.toEqual([
        expect.objectContaining({ fieldPreset }),
      ]);
    },
  );

  test("inserts, reorders, updates, and deletes sets through transactions", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill", "set-a", "set-b", "set-inserted"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const drill = await repository.createDrill({ name: "Practice" });
    await repository.createSet({
      drillId: drill.id,
      number: 1,
      position: { xSteps: 0, ySteps: 0 },
    });
    await repository.createSet({
      drillId: drill.id,
      number: 2,
      countsFromPrevious: 8,
      position: { xSteps: 8, ySteps: 8 },
    });

    await repository.insertSet(drill.id, 1, {
      number: 1,
      suffix: "A",
      kind: "subset",
      countsFromPrevious: 4,
      position: { xSteps: 4, ySteps: 4 },
    });
    expect(
      (await repository.listSets(drill.id)).map((set) => [set.id, set.ordinal]),
    ).toEqual([
      ["set-a", 0],
      ["set-inserted", 1],
      ["set-b", 2],
    ]);

    await repository.reorderSets(drill.id, ["set-a", "set-inserted", "set-b"]);
    expect((await repository.listSets(drill.id)).map(({ id }) => id)).toEqual([
      "set-a",
      "set-inserted",
      "set-b",
    ]);
    await repository.updateSet("set-inserted", {
      suffix: ".5",
      countsFromPrevious: 6,
      measureRange: { start: 10, end: 11 },
      position: { xSteps: 6, ySteps: 9 },
      facingDegrees: 90,
    });
    expect(await repository.getSet("set-inserted")).toMatchObject({
      number: 1,
      suffix: ".5",
      kind: "subset",
      countsFromPrevious: 6,
      measureRange: { start: 10, end: 11 },
      position: { xSteps: 6, ySteps: 9 },
      facingDegrees: 90,
    });

    await repository.deleteSet("set-inserted");
    expect(
      (await repository.listSets(drill.id)).map((set) => [set.id, set.ordinal]),
    ).toEqual([
      ["set-a", 0],
      ["set-b", 1],
    ]);
    expect(fake.database.withTransactionAsync).toHaveBeenCalled();
  });

  test("persists active and selected pointers, validates selection, and honors FK deletion contracts", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill-1", "drill-2", "set-1"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const first = await repository.createDrill("First");
    const second = await repository.createDrill("Second");
    const set = await repository.createSet({
      drillId: first.id,
      number: 1,
      position: { xSteps: 0, ySteps: 0 },
    });

    await repository.setActiveDrill(first.id);
    await expect(repository.setSelectedDrillSet(set.id)).resolves.toMatchObject(
      {
        activeDrillId: first.id,
        selectedDrillSetId: set.id,
      },
    );
    await expect(
      repository.setSelectedDrillSet("missing"),
    ).rejects.toMatchObject({
      code: "INVALID_SELECTION",
    });
    await expect(repository.setActiveDrill("missing")).rejects.toMatchObject({
      code: "DRILL_NOT_FOUND",
    });

    await expect(repository.setActiveDrill(second.id)).resolves.toMatchObject({
      activeDrillId: second.id,
      selectedDrillSetId: null,
    });
    await expect(repository.setSelectedDrillSet(set.id)).rejects.toMatchObject({
      code: "INVALID_SELECTION",
    });

    await repository.setActiveDrill(first.id);
    await repository.setSelectedDrillSet(set.id);
    await repository.deleteSet(set.id);
    expect(fake.settings.selected_drill_page_id).toBeNull();

    await repository.setActiveDrill(first.id);
    await repository.deleteDrill(first.id);
    expect(fake.settings.active_drill_id).toBeNull();
    expect(fake.sets.size).toBe(0);
  });

  test("rejects malformed set data and enforces subset/primary structure", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill", "set-1", "set-2"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const drill = await repository.createDrill("Drill");

    await expect(repository.createDrill("   ")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(
      repository.createSet({
        drillId: drill.id,
        number: 1,
        countsFromPrevious: 1,
        position: { xSteps: 0, ySteps: 0 },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      repository.createSet({
        drillId: drill.id,
        number: 1,
        countsFromPrevious: 0,
        position: { xSteps: Number.NaN, ySteps: 0 },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    await repository.createSet({
      drillId: drill.id,
      number: 1,
      position: { xSteps: 0, ySteps: 0 },
    });
    await expect(
      repository.createSet({
        drillId: drill.id,
        number: 99,
        kind: "subset",
        suffix: "A",
        countsFromPrevious: 8,
        position: { xSteps: 8, ySteps: 0 },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      repository.createSet({
        drillId: drill.id,
        number: 2,
        countsFromPrevious: 2.5,
        position: { xSteps: 8, ySteps: 0 },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

type FakeDrillRow = {
  id: string;
  name: string;
  field_preset: FieldPresetId;
  created_at: number;
  updated_at: number;
};

type FakeSetRow = {
  id: string;
  drill_id: string;
  ordinal: number;
  set_number: number;
  set_suffix: string | null;
  set_kind: "set" | "subset";
  counts_from_previous: number;
  measure_start: number | null;
  measure_end: number | null;
  x_steps: number;
  y_steps: number;
  facing_degrees: number | null;
};

class DrillFakeDatabase {
  readonly drills = new Map<string, FakeDrillRow>();
  readonly sets = new Map<string, FakeSetRow>();
  readonly settings = {
    drill_features_enabled: 1,
    drill_terminology: "sets",
    field_perspective: "director",
    default_field_preset: "football-nfhs",
    transition_metric_mode: "step-size",
    guidance_enabled: 1,
    developer_mode_enabled: 0,
    show_cached_anchor_geometry: 0,
    show_comfortable_anchor_range: 0,
    show_perimeter_step_grid: 0,
    comfortable_anchor_range_meters: 20,
    active_drill_id: null as string | null,
    selected_drill_page_id: null as string | null,
  };
  readonly database: SQLiteDatabase & {
    withTransactionAsync: jest.Mock;
  };

  constructor() {
    const database = {
      execAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn((sql: string, params: unknown[] = []) =>
        this.getFirst(sql, params),
      ),
      getAllAsync: jest.fn((sql: string, params: unknown[] = []) =>
        this.getAll(sql, params),
      ),
      runAsync: jest.fn((sql: string, params: unknown[] = []) =>
        this.run(sql, params),
      ),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
        const drills = new Map(
          [...this.drills].map(([id, row]) => [id, { ...row }]),
        );
        const sets = new Map(
          [...this.sets].map(([id, row]) => [id, { ...row }]),
        );
        const settings = { ...this.settings };
        try {
          await task();
        } catch (error) {
          this.drills.clear();
          this.sets.clear();
          for (const [id, row] of drills) this.drills.set(id, row);
          for (const [id, row] of sets) this.sets.set(id, row);
          Object.assign(this.settings, settings);
          throw error;
        }
      }),
    };
    this.database = database as unknown as SQLiteDatabase & {
      withTransactionAsync: jest.Mock;
    };
  }

  private async getFirst(sql: string, params: unknown[]): Promise<unknown> {
    if (sql.includes("COUNT(*) AS set_count")) {
      return {
        set_count: [...this.sets.values()].filter(
          (set) => set.drill_id === params[0],
        ).length,
      };
    }
    if (sql.includes("FROM drills")) {
      const row = this.drills.get(String(params[0]));
      return row ? { ...row } : null;
    }
    if (sql.includes("SELECT id FROM drill_sets") && sql.includes("LIMIT 1")) {
      const row = [...this.sets.values()]
        .filter((set) => set.drill_id === params[0])
        .sort((left, right) => left.ordinal - right.ordinal)[0];
      return row ? { id: row.id } : null;
    }
    if (sql.includes("SELECT drill_id FROM drill_sets")) {
      const row = this.sets.get(String(params[0]));
      return row ? { drill_id: row.drill_id } : null;
    }
    if (sql.includes("FROM drill_sets")) {
      const row = this.sets.get(String(params[0]));
      return row ? { ...row } : null;
    }
    if (sql.includes("FROM app_settings")) return { ...this.settings };
    return null;
  }

  private async getAll(sql: string, params: unknown[]): Promise<unknown[]> {
    if (sql.includes("FROM drills")) {
      return [...this.drills.values()]
        .sort(
          (left, right) =>
            left.created_at - right.created_at ||
            left.id.localeCompare(right.id),
        )
        .map((row) => ({ ...row }));
    }
    if (sql.includes("FROM drill_sets")) {
      const rows = [...this.sets.values()]
        .filter((set) => set.drill_id === params[0])
        .sort(
          (left, right) =>
            left.ordinal - right.ordinal || left.id.localeCompare(right.id),
        );
      return rows.map((row) =>
        /^\s*SELECT id\s+FROM drill_sets/m.test(sql)
          ? { id: row.id }
          : { ...row },
      );
    }
    return [];
  }

  private async run(sql: string, params: unknown[]): Promise<unknown> {
    if (sql.includes("INSERT INTO drills")) {
      const [id, name, fieldPreset, createdAt, updatedAt] = params as [
        string,
        string,
        FieldPresetId,
        number,
        number,
      ];
      this.drills.set(id, {
        id,
        name,
        field_preset: fieldPreset,
        created_at: createdAt,
        updated_at: updatedAt,
      });
    } else if (sql.includes("INSERT INTO drill_sets")) {
      const [
        id,
        drillId,
        ordinal,
        number,
        suffix,
        kind,
        counts,
        measureStart,
        measureEnd,
        xSteps,
        ySteps,
        facingDegrees,
      ] = params as [
        string,
        string,
        number,
        number,
        string | null,
        "set" | "subset",
        number,
        number | null,
        number | null,
        number,
        number,
        number | null,
      ];
      this.sets.set(id, {
        id,
        drill_id: drillId,
        ordinal,
        set_number: number,
        set_suffix: suffix,
        set_kind: kind,
        counts_from_previous: counts,
        measure_start: measureStart,
        measure_end: measureEnd,
        x_steps: xSteps,
        y_steps: ySteps,
        facing_degrees: facingDegrees,
      });
    } else if (sql.includes("INSERT OR IGNORE INTO app_settings")) {
      // Singleton already exists in this fake.
    } else if (sql.includes("DELETE FROM drills")) {
      const id = String(params[0]);
      this.drills.delete(id);
      for (const [setId, set] of this.sets) {
        if (set.drill_id === id) {
          this.sets.delete(setId);
          if (this.settings.selected_drill_page_id === setId) {
            this.settings.selected_drill_page_id = null;
          }
        }
      }
      if (this.settings.active_drill_id === id) {
        this.settings.active_drill_id = null;
        this.settings.selected_drill_page_id = null;
      }
    } else if (sql.includes("DELETE FROM drill_sets")) {
      const id = String(params[0]);
      this.sets.delete(id);
      if (this.settings.selected_drill_page_id === id) {
        this.settings.selected_drill_page_id = null;
      }
    } else if (sql.includes("UPDATE drills")) {
      const [name, updatedAt, id] = params as [string, number, string];
      const row = this.drills.get(id);
      if (row) this.drills.set(id, { ...row, name, updated_at: updatedAt });
    } else if (sql.includes("UPDATE app_settings")) {
      this.updateSettings(sql, params);
    } else if (sql.includes("UPDATE drill_sets")) {
      this.updateSets(sql, params);
    }
    return { lastInsertRowId: 1, changes: 1 };
  }

  private updateSettings(sql: string, params: unknown[]): void {
    if (sql.includes("active_drill_id = ?")) {
      const next = params[0] as string | null;
      if (this.settings.active_drill_id !== next) {
        this.settings.selected_drill_page_id = null;
      }
      this.settings.active_drill_id = next;
      return;
    }
    if (sql.includes("selected_drill_page_id = NULL")) {
      this.settings.selected_drill_page_id = null;
      return;
    }
    if (sql.includes("selected_drill_page_id = ?")) {
      this.settings.selected_drill_page_id = params[0] as string;
    }
  }

  private updateSets(sql: string, params: unknown[]): void {
    if (sql.includes("SET ordinal = ordinal + ?")) {
      const [offset, drillId] = params as [number, string];
      for (const set of this.sets.values()) {
        if (set.drill_id === drillId) set.ordinal += offset;
      }
      return;
    }
    if (sql.includes("SET ordinal = CASE")) {
      const [threshold, offset, , drillId] = params as [
        number,
        number,
        number,
        string,
      ];
      for (const set of this.sets.values()) {
        if (set.drill_id === drillId) {
          set.ordinal =
            set.ordinal >= threshold
              ? set.ordinal - offset + 1
              : set.ordinal - offset;
        }
      }
      return;
    }
    if (sql.includes("SET ordinal = ordinal - 1")) {
      const [drillId, ordinal] = params as [string, number];
      for (const set of this.sets.values()) {
        if (set.drill_id === drillId && set.ordinal > ordinal) set.ordinal -= 1;
      }
      return;
    }
    if (sql.includes("SET ordinal = ?")) {
      const [ordinal, id] = params as [number, string, string];
      const set = this.sets.get(id);
      if (set) set.ordinal = ordinal;
      return;
    }
    if (
      sql.includes("SET counts_from_previous = 0") &&
      sql.includes("ordinal = 0")
    ) {
      const drillId = String(params[0]);
      const first = [...this.sets.values()].find(
        (set) => set.drill_id === drillId && set.ordinal === 0,
      );
      if (first) first.counts_from_previous = 0;
      return;
    }
    if (sql.includes("SET counts_from_previous = 0 WHERE id = ?")) {
      const set = this.sets.get(String(params[0]));
      if (set) set.counts_from_previous = 0;
      return;
    }
    if (sql.includes("SET set_number = ?")) {
      const [
        number,
        suffix,
        kind,
        counts,
        measureStart,
        measureEnd,
        xSteps,
        ySteps,
        facingDegrees,
        id,
      ] = params as [
        number,
        string | null,
        "set" | "subset",
        number,
        number | null,
        number | null,
        number,
        number,
        number | null,
        string,
      ];
      const set = this.sets.get(id);
      if (set) {
        Object.assign(set, {
          set_number: number,
          set_suffix: suffix,
          set_kind: kind,
          counts_from_previous: counts,
          measure_start: measureStart,
          measure_end: measureEnd,
          x_steps: xSteps,
          y_steps: ySteps,
          facing_degrees: facingDegrees,
        });
      }
    }
  }
}
