import type { SQLiteDatabase } from "expo-sqlite";
import { SqliteDrillRepository } from "../SqliteDrillRepository";

describe("SqliteDrillRepository", () => {
  test("uses stable factories and deterministic drill/page ordering", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill-1", "drill-2", "page-1", "page-2", "page-3"];
    const times = [20, 10];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => times.shift()!,
    });

    const first = await repository.createDrill("First");
    const second = await repository.createDrill("Second");
    expect(first).toMatchObject({
      id: "drill-1",
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

    const firstPage = await repository.createPage({
      drillId: first.id,
      label: "Start",
      position: { xMeters: 1, yMeters: 2 },
    });
    const secondPage = await repository.createPage({
      drillId: first.id,
      label: "Second",
      countsFromPrevious: 2.5,
      position: { xMeters: 3, yMeters: 4 },
    });
    expect(firstPage).toMatchObject({
      id: "page-1",
      ordinal: 0,
      countsFromPrevious: 0,
    });
    expect(secondPage).toMatchObject({ id: "page-2", ordinal: 1 });
    expect((await repository.listPages(first.id)).map(({ id }) => id)).toEqual([
      "page-1",
      "page-2",
    ]);
  });

  test("inserts, reorders, updates, and deletes pages through transactions", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill", "page-a", "page-b", "page-inserted"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const drill = await repository.createDrill({ name: "Practice" });
    await repository.createPage({
      drillId: drill.id,
      label: "A",
      position: { xMeters: 0, yMeters: 0 },
    });
    await repository.createPage({
      drillId: drill.id,
      label: "B",
      position: { xMeters: 2, yMeters: 2 },
    });

    await repository.insertPage(drill.id, 1, {
      label: "Inserted",
      countsFromPrevious: 1,
      position: { xMeters: 1, yMeters: 1 },
    });
    expect(
      (await repository.listPages(drill.id)).map((page) => [
        page.id,
        page.ordinal,
      ]),
    ).toEqual([
      ["page-a", 0],
      ["page-inserted", 1],
      ["page-b", 2],
    ]);

    await repository.reorderPages(drill.id, [
      "page-b",
      "page-a",
      "page-inserted",
    ]);
    expect((await repository.listPages(drill.id)).map(({ id }) => id)).toEqual([
      "page-b",
      "page-a",
      "page-inserted",
    ]);
    await repository.updatePage("page-inserted", {
      label: "Updated",
      position: { xMeters: 9, yMeters: 10 },
    });
    expect(await repository.getPage("page-inserted")).toMatchObject({
      label: "Updated",
      position: { xMeters: 9, yMeters: 10 },
    });

    await repository.deletePage("page-a");
    expect(
      (await repository.listPages(drill.id)).map((page) => [
        page.id,
        page.ordinal,
      ]),
    ).toEqual([
      ["page-b", 0],
      ["page-inserted", 1],
    ]);
    expect(fake.database.withTransactionAsync).toHaveBeenCalled();
  });

  test("persists active and selected pointers, validates selection, and honors FK deletion contracts", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill-1", "drill-2", "page-1"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const first = await repository.createDrill("First");
    const second = await repository.createDrill("Second");
    const page = await repository.createPage({
      drillId: first.id,
      label: "Page",
      position: { xMeters: 0, yMeters: 0 },
    });

    await repository.setActiveDrill(first.id);
    await expect(
      repository.setSelectedDrillPage(page.id),
    ).resolves.toMatchObject({
      activeDrillId: first.id,
      selectedDrillPageId: page.id,
    });
    await expect(
      repository.setSelectedDrillPage("missing"),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION" });
    await expect(repository.setActiveDrill("missing")).rejects.toMatchObject({
      code: "DRILL_NOT_FOUND",
    });

    await expect(repository.setActiveDrill(second.id)).resolves.toMatchObject({
      activeDrillId: second.id,
      selectedDrillPageId: null,
    });
    await expect(
      repository.setSelectedDrillPage(page.id),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION" });

    await repository.setActiveDrill(first.id);
    await repository.setSelectedDrillPage(page.id);
    await repository.deletePage(page.id);
    expect(fake.settings.selected_drill_page_id).toBeNull();

    await repository.setActiveDrill(first.id);
    await repository.deleteDrill(first.id);
    expect(fake.settings.active_drill_id).toBeNull();
    expect(fake.pages.size).toBe(0);
  });

  test("rejects malformed names, labels, counts, and coordinates", async () => {
    const fake = new DrillFakeDatabase();
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => "drill",
      timeFactory: () => 1,
    });
    const drill = await repository.createDrill("Drill");

    await expect(repository.createDrill("   ")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(
      repository.createPage({
        drillId: drill.id,
        label: "Page",
        countsFromPrevious: -1,
        position: { xMeters: 0, yMeters: 0 },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      repository.createPage({
        drillId: drill.id,
        label: "Page",
        position: { xMeters: Number.NaN, yMeters: 0 },
      }),
    ).rejects.toThrow("xMeters");
  });
});

type FakeDrillRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

type FakePageRow = {
  id: string;
  drill_id: string;
  ordinal: number;
  label: string;
  counts_from_previous: number;
  x_meters: number;
  y_meters: number;
};

class DrillFakeDatabase {
  readonly drills = new Map<string, FakeDrillRow>();
  readonly pages = new Map<string, FakePageRow>();
  readonly settings = {
    drill_features_enabled: 1,
    drill_terminology: "pages",
    field_perspective: "director",
    transition_metric_mode: "step-size",
    guidance_enabled: 1,
    developer_mode_enabled: 0,
    show_cached_anchor_geometry: 0,
    show_comfortable_anchor_range: 0,
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
        const drills = new Map(this.drills);
        const pages = new Map(this.pages);
        const settings = { ...this.settings };
        try {
          await task();
        } catch (error) {
          this.drills.clear();
          this.pages.clear();
          for (const [id, row] of drills) this.drills.set(id, row);
          for (const [id, row] of pages) this.pages.set(id, row);
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
    if (sql.includes("COUNT(*) AS page_count")) {
      return {
        page_count: [...this.pages.values()].filter(
          (page) => page.drill_id === params[0],
        ).length,
      };
    }
    if (sql.includes("FROM drills")) {
      const row = this.drills.get(String(params[0]));
      return row ? { ...row } : null;
    }
    if (sql.includes("FROM drill_pages") && sql.includes("drill_id")) {
      const row = this.pages.get(String(params[0]));
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
    if (sql.includes("FROM drill_pages")) {
      return [...this.pages.values()]
        .filter((page) => page.drill_id === params[0])
        .sort(
          (left, right) =>
            left.ordinal - right.ordinal || left.id.localeCompare(right.id),
        )
        .map((row) =>
          sql.includes("SELECT id\n") ? { id: row.id } : { ...row },
        );
    }
    return [];
  }

  private async run(sql: string, params: unknown[]): Promise<unknown> {
    if (sql.includes("INSERT INTO drills")) {
      const [id, name, createdAt, updatedAt] = params as [
        string,
        string,
        number,
        number,
      ];
      this.drills.set(id, {
        id,
        name,
        created_at: createdAt,
        updated_at: updatedAt,
      });
    } else if (sql.includes("INSERT INTO drill_pages")) {
      const [id, drillId, ordinal, label, counts, xMeters, yMeters] =
        params as [string, string, number, string, number, number, number];
      this.pages.set(id, {
        id,
        drill_id: drillId,
        ordinal,
        label,
        counts_from_previous: counts,
        x_meters: xMeters,
        y_meters: yMeters,
      });
    } else if (sql.includes("INSERT OR IGNORE INTO app_settings")) {
      // The singleton already exists in this fake.
    } else if (sql.includes("DELETE FROM drills")) {
      const id = String(params[0]);
      this.drills.delete(id);
      for (const [pageId, page] of this.pages) {
        if (page.drill_id === id) {
          this.pages.delete(pageId);
          if (this.settings.selected_drill_page_id === pageId) {
            this.settings.selected_drill_page_id = null;
          }
        }
      }
      if (this.settings.active_drill_id === id)
        this.settings.active_drill_id = null;
    } else if (sql.includes("DELETE FROM drill_pages")) {
      const id = String(params[0]);
      this.pages.delete(id);
      if (this.settings.selected_drill_page_id === id) {
        this.settings.selected_drill_page_id = null;
      }
    } else if (sql.includes("UPDATE drills")) {
      const [name, updatedAt, id] = params as [string, number, string];
      const row = this.drills.get(id);
      if (row) this.drills.set(id, { ...row, name, updated_at: updatedAt });
    } else if (sql.includes("UPDATE app_settings")) {
      this.updateSettings(sql, params);
    } else if (sql.includes("UPDATE drill_pages")) {
      this.updatePages(sql, params);
    }
    return { lastInsertRowId: 1, changes: 1 };
  }

  private updateSettings(sql: string, params: unknown[]): void {
    if (sql.includes("active_drill_id = ?")) {
      this.settings.active_drill_id = params[0] as string | null;
    }
    if (sql.includes("selected_drill_page_id = NULL")) {
      this.settings.selected_drill_page_id = null;
    } else if (sql.includes("selected_drill_page_id = ?")) {
      this.settings.selected_drill_page_id = params[0] as string;
    }
  }

  private updatePages(sql: string, params: unknown[]): void {
    if (sql.includes("ordinal = ordinal + ?")) {
      const [offset, drillId] = params as [number, string];
      for (const page of this.pages.values()) {
        if (page.drill_id === drillId) page.ordinal += offset;
      }
      return;
    }
    if (sql.includes("ordinal = CASE")) {
      const [threshold, offset, , drillId] = params as [
        number,
        number,
        number,
        string,
      ];
      for (const page of this.pages.values()) {
        if (page.drill_id === drillId) {
          page.ordinal =
            page.ordinal >= threshold
              ? page.ordinal - offset + 1
              : page.ordinal - offset;
        }
      }
      return;
    }
    if (sql.includes("ordinal = ordinal - 1")) {
      const [drillId, ordinal] = params as [string, number];
      for (const page of this.pages.values()) {
        if (page.drill_id === drillId && page.ordinal > ordinal)
          page.ordinal -= 1;
      }
      return;
    }
    if (sql.includes("SET ordinal = ?")) {
      const [ordinal, id] = params as [number, string, string];
      const page = this.pages.get(id);
      if (page) page.ordinal = ordinal;
      return;
    }
    const id = String(params[params.length - 1]);
    const page = this.pages.get(id);
    if (!page) return;
    if (sql.includes("label = ?")) page.label = String(params[0]);
    if (sql.includes("counts_from_previous = ?")) {
      page.counts_from_previous = Number(
        sql.includes("label = ?") ? params[1] : params[0],
      );
    }
    if (sql.includes("x_meters = ?")) {
      const offset = sql.includes("label = ?") ? 1 : 0;
      const countOffset = sql.includes("counts_from_previous = ?") ? 1 : 0;
      page.x_meters = Number(params[offset + countOffset]);
      page.y_meters = Number(params[offset + countOffset + 1]);
    }
  }
}
