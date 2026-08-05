import {
  DRILL_SCHEMA_URL,
  DRILL_SCHEMA_VERSION,
  FIELD_PRESET_IDS,
  type DrillDocument,
  type FieldPresetId,
} from "@eight2five/drill-schema";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  SqliteDrillRepository,
  type CreateDrillInput,
} from "../SqliteDrillRepository";

const IMPORTED_DOCUMENT: DrillDocument = {
  schema: DRILL_SCHEMA_URL,
  schemaVersion: DRILL_SCHEMA_VERSION,
  metadata: {
    title: "Imported Finale",
    createdAt: "2026-08-03T18:00:00.000Z",
    drillWriter: "A. Writer",
    ensemble: "The Ensemble",
    description: "Full document round trip",
    lucideIcon: "music-2",
  },
  field: { type: "preset", preset: "football-nfhs" },
  entityRules: {
    bySymbol: { B: { appearance: { color: "#E53935" } } },
  },
  entities: [
    { id: 10, type: "performer", symbol: "B", label: "B1" },
    { id: 11, type: "performer", symbol: "B", label: "B2" },
    { id: 99, type: "prop", symbol: "P", label: "Flag" },
  ],
  sets: [
    { id: 0, number: 1, kind: "set", countsFromPrevious: 0 },
    { id: 1, number: 2, kind: "set", countsFromPrevious: 8 },
  ],
  positions: [
    { entityId: 10, setId: 0, xSteps: 0, ySteps: 0 },
    { entityId: 10, setId: 1, xSteps: 8, ySteps: 0 },
    { entityId: 11, setId: 0, xSteps: 0, ySteps: 8 },
    { entityId: 11, setId: 1, xSteps: 8, ySteps: 8 },
    { entityId: 99, setId: 0, xSteps: 4, ySteps: 4 },
    { entityId: 99, setId: 1, xSteps: 12, ySteps: 4 },
  ],
  paths: [
    {
      entityId: 10,
      fromSetId: 0,
      toSetId: 1,
      kind: "polyline",
      waypoints: [{ xSteps: 4, ySteps: 3 }],
    },
    {
      entityId: 11,
      fromSetId: 0,
      toSetId: 1,
      kind: "bezier",
      controlPoints: [
        { xSteps: 2, ySteps: 10 },
        { xSteps: 6, ySteps: 10 },
      ],
    },
  ],
  provenance: {
    source: { kind: "coordinate-sheet", fileName: "finale.pdf" },
    importer: { name: "test", version: "1" },
    importedAt: "2026-08-03T18:01:00.000Z",
    references: [{ target: { type: "entity", entityId: 10 }, page: 1 }],
  },
  extensions: { custom: { retained: true } },
};

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

  test("round-trips the full imported document and summary metadata", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["full-0", "full-1"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });

    const drill = await repository.createImportedDrill({
      id: "imported",
      sourceDocument: IMPORTED_DOCUMENT,
      selectedPerformerEntityId: 10,
    });

    expect(await repository.getDrillDocument(drill.id)).toEqual(
      IMPORTED_DOCUMENT,
    );
    expect(fake.drills.get(drill.id)?.source_document_json).toBe(
      `${JSON.stringify(IMPORTED_DOCUMENT, null, 2)}\n`,
    );
    expect(drill).toMatchObject({
      name: "Imported Finale",
      selectedPerformerEntityId: 10,
      metadata: IMPORTED_DOCUMENT.metadata,
    });
    expect(await repository.listDrills()).toEqual([
      expect.objectContaining({
        id: "imported",
        metadata: IMPORTED_DOCUMENT.metadata,
      }),
    ]);

    fake.drills.get(drill.id)!.source_document_json = "not-json";
    await expect(repository.listDrills()).resolves.toHaveLength(1);
    await expect(repository.getDrillDocument(drill.id)).rejects.toThrow(
      "source document",
    );
  });

  test("updates imported properties transactionally in the summary and document", async () => {
    const fake = new DrillFakeDatabase();
    const repository = new SqliteDrillRepository(fake.database, {
      timeFactory: () => 123,
    });
    const drill = await repository.createImportedDrill({
      id: "imported",
      sourceDocument: IMPORTED_DOCUMENT,
      selectedPerformerEntityId: 10,
    });

    await expect(
      repository.updateDrillProperties(drill.id, {
        name: "Updated Finale",
        lucideIcon: "sparkles",
      }),
    ).resolves.toMatchObject({
      name: "Updated Finale",
      metadata: expect.objectContaining({
        title: "Updated Finale",
        lucideIcon: "sparkles",
      }),
      updatedAt: 123,
    });
    expect(await repository.getDrillDocument(drill.id)).toEqual({
      ...IMPORTED_DOCUMENT,
      metadata: {
        ...IMPORTED_DOCUMENT.metadata,
        title: "Updated Finale",
        lucideIcon: "sparkles",
      },
    });
    expect(fake.drills.get(drill.id)).toMatchObject({
      name: "Updated Finale",
      metadata_title: "Updated Finale",
      metadata_lucide_icon: "sparkles",
    });
    expect(fake.database.withTransactionAsync).toHaveBeenCalled();

    await repository.updateDrillProperties(drill.id, { lucideIcon: null });
    expect((await repository.getDrillDocument(drill.id))?.metadata).toEqual({
      createdAt: IMPORTED_DOCUMENT.metadata.createdAt,
      drillWriter: IMPORTED_DOCUMENT.metadata.drillWriter,
      ensemble: IMPORTED_DOCUMENT.metadata.ensemble,
      description: IMPORTED_DOCUMENT.metadata.description,
      title: "Updated Finale",
    });
  });

  test("rejects invalid drill property values without changing the document", async () => {
    const fake = new DrillFakeDatabase();
    const repository = new SqliteDrillRepository(fake.database);
    const drill = await repository.createImportedDrill({
      id: "imported",
      sourceDocument: IMPORTED_DOCUMENT,
      selectedPerformerEntityId: 10,
    });

    await expect(
      repository.updateDrillProperties(drill.id, { lucideIcon: "Not An Icon" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await repository.getDrillDocument(drill.id)).toEqual(
      IMPORTED_DOCUMENT,
    );
  });

  test("rejects imported fields passed through manual drill creation", async () => {
    const fake = new DrillFakeDatabase();
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => "manual",
      timeFactory: () => 1,
    });

    await expect(
      repository.createDrill({
        name: IMPORTED_DOCUMENT.metadata.title,
        sourceDocument: IMPORTED_DOCUMENT,
        selectedPerformerEntityId: 10,
      } as unknown as CreateDrillInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fake.drills.size).toBe(0);
  });

  test("maps local projected sets to source set ids and reprojections preserve source data", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["local-0", "local-1", "reprojected-0", "reprojected-1"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const drill = await repository.createImportedDrill({
      id: "imported",
      sourceDocument: IMPORTED_DOCUMENT,
      selectedPerformerEntityId: 10,
    });

    expect(
      (await repository.listSets(drill.id)).map((set) => [
        set.id,
        set.sourceSetId,
      ]),
    ).toEqual([
      ["local-0", 0],
      ["local-1", 1],
    ]);
    await repository.setActiveDrill(drill.id);
    await repository.setSelectedDrillSet("local-1");

    await repository.setSelectedPerformer(drill.id, 11);

    expect(await repository.getDrillDocument(drill.id)).toEqual(
      IMPORTED_DOCUMENT,
    );
    expect(await repository.getDrill(drill.id)).toMatchObject({
      selectedPerformerEntityId: 11,
    });
    expect(
      (await repository.listSets(drill.id)).map((set) => ({
        id: set.id,
        sourceSetId: set.sourceSetId,
        position: set.position,
      })),
    ).toEqual([
      {
        id: "reprojected-0",
        sourceSetId: 0,
        position: { xSteps: 0, ySteps: 8 },
      },
      {
        id: "reprojected-1",
        sourceSetId: 1,
        position: { xSteps: 8, ySteps: 8 },
      },
    ]);
    expect(fake.settings.selected_drill_page_id).toBe("reprojected-1");
  });

  test("rejects all set mutations for imported projections, including page aliases", async () => {
    const fake = new DrillFakeDatabase();
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: (() => {
        const ids = ["local-0", "local-1"];
        return () => ids.shift()!;
      })(),
      timeFactory: () => 1,
    });
    const drill = await repository.createImportedDrill({
      id: "imported",
      sourceDocument: IMPORTED_DOCUMENT,
      selectedPerformerEntityId: 10,
    });
    const beforeSets = await repository.listSets(drill.id);

    const expectRejected = async (operation: Promise<unknown>) => {
      await expect(operation).rejects.toMatchObject({ code: "INVALID_INPUT" });
    };
    await expectRejected(
      repository.createSet({
        drillId: drill.id,
        number: 3,
        position: { xSteps: 1, ySteps: 1 },
      }),
    );
    await expectRejected(
      repository.updateSet(beforeSets[0].id, {
        position: { xSteps: 1, ySteps: 1 },
      }),
    );
    await expectRejected(repository.deleteSet(beforeSets[0].id));
    await expectRejected(
      repository.insertSet(drill.id, 1, {
        number: 1,
        suffix: "A",
        kind: "subset",
        position: { xSteps: 1, ySteps: 1 },
      }),
    );
    await expectRejected(
      repository.reorderSets(
        drill.id,
        beforeSets.map((set) => set.id).reverse(),
      ),
    );

    await expectRejected(
      repository.createPage({
        drillId: drill.id,
        number: 3,
        position: { xSteps: 1, ySteps: 1 },
      }),
    );
    await expectRejected(
      repository.updatePage(beforeSets[0].id, {
        position: { xSteps: 1, ySteps: 1 },
      }),
    );
    await expectRejected(repository.deletePage(beforeSets[0].id));
    await expectRejected(
      repository.insertPage(drill.id, 1, {
        number: 1,
        suffix: "A",
        kind: "subset",
        position: { xSteps: 1, ySteps: 1 },
      }),
    );
    await expectRejected(
      repository.reorderPages(
        drill.id,
        beforeSets.map((set) => set.id).reverse(),
      ),
    );

    expect(await repository.listSets(drill.id)).toEqual(beforeSets);
    expect(await repository.getDrillDocument(drill.id)).toEqual(
      IMPORTED_DOCUMENT,
    );
  });

  test("rejects an invalid performer entity without changing the projection", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["local-0", "local-1"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const drill = await repository.createImportedDrill({
      id: "imported",
      sourceDocument: IMPORTED_DOCUMENT,
      selectedPerformerEntityId: 10,
    });
    const before = await repository.listSets(drill.id);

    await expect(
      repository.setSelectedPerformer(drill.id, 99),
    ).rejects.toMatchObject({
      code: "INVALID_SELECTION",
    });
    expect(await repository.listSets(drill.id)).toEqual(before);
    expect(
      (await repository.getDrill(drill.id))?.selectedPerformerEntityId,
    ).toBe(10);
  });

  test("rolls back the drill and projection when an imported set insert fails", async () => {
    const fake = new DrillFakeDatabase();
    fake.failOnSetInsert = true;
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => "set-that-fails",
      timeFactory: () => 1,
    });

    await expect(
      repository.createImportedDrill({
        id: "imported",
        sourceDocument: IMPORTED_DOCUMENT,
        selectedPerformerEntityId: 10,
      }),
    ).rejects.toThrow("set insert failed");
    expect(fake.drills.size).toBe(0);
    expect(fake.sets.size).toBe(0);
  });

  test("selects the first set when activating a different drill and clears it on deactivation", async () => {
    const fake = new DrillFakeDatabase();
    const ids = ["drill-a", "drill-b", "set-a-0", "set-b-0", "set-b-1"];
    const repository = new SqliteDrillRepository(fake.database, {
      idFactory: () => ids.shift()!,
      timeFactory: () => 1,
    });
    const drillA = await repository.createDrill("A");
    const drillB = await repository.createDrill("B");
    const setA = await repository.createSet({
      drillId: drillA.id,
      number: 1,
      position: { xSteps: 0, ySteps: 0 },
    });
    const setB = await repository.createSet({
      drillId: drillB.id,
      number: 1,
      position: { xSteps: 1, ySteps: 1 },
    });
    await repository.createSet({
      drillId: drillB.id,
      number: 2,
      countsFromPrevious: 8,
      position: { xSteps: 2, ySteps: 2 },
    });

    await repository.setActiveDrill(drillA.id);
    expect(fake.settings.selected_drill_page_id).toBe(setA.id);
    await repository.setActiveDrill(drillB.id);
    expect(fake.settings.selected_drill_page_id).toBe(setB.id);
    await repository.setActiveDrill(null);
    expect(fake.settings.active_drill_id).toBeNull();
    expect(fake.settings.selected_drill_page_id).toBeNull();
    await repository.setActiveDrill(drillA.id);
    expect(fake.settings.selected_drill_page_id).toBe(setA.id);
  });

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
  metadata_title?: string;
  metadata_created_at?: string;
  metadata_drill_writer?: string | null;
  metadata_ensemble?: string | null;
  metadata_description?: string | null;
  metadata_lucide_icon?: string | null;
  source_document_json?: string | null;
  selected_performer_entity_id?: number | null;
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
  source_set_id: number | null;
};

class DrillFakeDatabase {
  readonly drills = new Map<string, FakeDrillRow>();
  readonly sets = new Map<string, FakeSetRow>();
  failOnSetInsert = false;
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
      const [
        id,
        name,
        fieldPreset,
        createdAt,
        updatedAt,
        metadataTitle,
        metadataCreatedAt,
        metadataWriter,
        metadataEnsemble,
        metadataDescription,
        metadataLucideIcon,
        sourceDocumentJson,
        selectedPerformerEntityId,
      ] = params as [
        string,
        string,
        FieldPresetId,
        number,
        number,
        string,
        string,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        number | null,
      ];
      this.drills.set(id, {
        id,
        name,
        field_preset: fieldPreset,
        created_at: createdAt,
        updated_at: updatedAt,
        metadata_title: metadataTitle,
        metadata_created_at: metadataCreatedAt,
        metadata_drill_writer: metadataWriter,
        metadata_ensemble: metadataEnsemble,
        metadata_description: metadataDescription,
        metadata_lucide_icon: metadataLucideIcon,
        source_document_json: sourceDocumentJson,
        selected_performer_entity_id: selectedPerformerEntityId,
      });
    } else if (sql.includes("INSERT INTO drill_sets")) {
      if (this.failOnSetInsert) throw new Error("set insert failed");
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
        sourceSetId,
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
        source_set_id: sourceSetId,
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
      if (sql.includes("WHERE drill_id = ?")) {
        const drillId = String(params[0]);
        for (const [setId, set] of this.sets) {
          if (set.drill_id === drillId) {
            this.sets.delete(setId);
            if (this.settings.selected_drill_page_id === setId) {
              this.settings.selected_drill_page_id = null;
            }
          }
        }
      } else {
        const id = String(params[0]);
        this.sets.delete(id);
        if (this.settings.selected_drill_page_id === id) {
          this.settings.selected_drill_page_id = null;
        }
      }
    } else if (
      sql.includes("UPDATE drills") &&
      sql.includes("selected_performer_entity_id")
    ) {
      const [selectedPerformerEntityId, id] = params as [number, string];
      const row = this.drills.get(id);
      if (row) {
        this.drills.set(id, {
          ...row,
          selected_performer_entity_id: selectedPerformerEntityId,
        });
      }
    } else if (
      sql.includes("UPDATE drills") &&
      sql.includes("metadata_lucide_icon")
    ) {
      const row = this.drills.get(String(params[params.length - 1]));
      if (row) {
        const hasSourceDocument = sql.includes("source_document_json");
        if (hasSourceDocument) {
          const [name, metadataTitle, icon, sourceDocumentJson, updatedAt] =
            params as [string, string, string | null, string, number, string];
          this.drills.set(row.id, {
            ...row,
            name,
            metadata_title: metadataTitle,
            metadata_lucide_icon: icon,
            source_document_json: sourceDocumentJson,
            updated_at: updatedAt,
          });
        } else {
          const [name, metadataTitle, icon, updatedAt] = params as [
            string,
            string,
            string | null,
            number,
            string,
          ];
          this.drills.set(row.id, {
            ...row,
            name,
            metadata_title: metadataTitle,
            metadata_lucide_icon: icon,
            updated_at: updatedAt,
          });
        }
      }
    } else if (sql.includes("UPDATE drills")) {
      const [name, updatedAt, id] = params as [string, number, string];
      const row = this.drills.get(id);
      if (row) {
        this.drills.set(id, {
          ...row,
          name,
          metadata_title: name,
          updated_at: updatedAt,
        });
      }
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
        sourceSetId,
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
          source_set_id: sourceSetId,
        });
      }
    }
  }
}
