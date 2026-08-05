import type { DrillRepository } from "@eight2five/mobile/drill";
import {
  DRILL_SCHEMA_URL,
  DRILL_SCHEMA_VERSION,
  getFieldPreset,
  type DrillDocument,
} from "@eight2five/drill-schema";

import {
  getPerformerSymbolGroups,
  importEight2FiveDrillDocument,
  importEight2FiveDrillJson,
  isEight2FiveDrillFileName,
  parseImportableDrillJson,
} from "../drill-import";

const VALID_DOCUMENT: DrillDocument = {
  schema: DRILL_SCHEMA_URL,
  schemaVersion: DRILL_SCHEMA_VERSION,
  metadata: {
    title: "Part 4 Finale",
    createdAt: "2026-08-03T18:00:00.000Z",
  },
  field: { type: "preset", preset: "football-nfhs" },
  entities: [
    {
      id: 42,
      type: "performer",
      symbol: "B",
      label: "B1",
    },
  ],
  sets: [
    {
      id: 0,
      number: 1,
      kind: "set",
      countsFromPrevious: 0,
    },
    {
      id: 1,
      number: 2,
      kind: "set",
      countsFromPrevious: 16,
      measureRange: { start: 12, end: 15 },
    },
  ],
  positions: [
    { entityId: 42, setId: 0, xSteps: -8, ySteps: 0 },
    {
      entityId: 42,
      setId: 1,
      xSteps: 4,
      ySteps: 32,
      facingDegrees: 90,
    },
  ],
};

const MULTI_ENTITY_DOCUMENT: DrillDocument = {
  ...VALID_DOCUMENT,
  entities: [
    { id: 42, type: "performer", symbol: "B", label: "B1" },
    { id: 43, type: "performer", symbol: "B", label: "B2" },
    { id: 44, type: "performer", symbol: "T", label: "T1" },
    { id: 99, type: "prop", symbol: "P", label: "P1" },
  ],
  positions: [
    ...VALID_DOCUMENT.positions,
    { entityId: 43, setId: 0, xSteps: 10, ySteps: 12 },
    { entityId: 43, setId: 1, xSteps: 14, ySteps: 20 },
    { entityId: 44, setId: 0, xSteps: -4, ySteps: 8 },
    { entityId: 44, setId: 1, xSteps: -2, ySteps: 10 },
    { entityId: 99, setId: 0, xSteps: 0, ySteps: 16 },
    { entityId: 99, setId: 1, xSteps: 0, ySteps: 18 },
  ],
};

function createRepository() {
  const created = {
    id: "drill-1",
    name: "Part 4 Finale",
    fieldPreset: "football-nfhs" as const,
    createdAt: Date.parse(VALID_DOCUMENT.metadata.createdAt),
    updatedAt: Date.parse(VALID_DOCUMENT.metadata.createdAt),
  };
  const repository = {
    createDrill: jest.fn(async () => created),
    createSet: jest.fn(async (input) => ({ id: "set", ...input })),
    deleteDrill: jest.fn(async () => undefined),
  } as unknown as DrillRepository;
  return { created, repository };
}

describe("Eight2Five drill import", () => {
  test("recognizes the converter drill file extension", () => {
    expect(isEight2FiveDrillFileName("finale.eight2five.json")).toBe(true);
    expect(isEight2FiveDrillFileName("EIGHT2FIVE.JSON")).toBe(true);
    expect(isEight2FiveDrillFileName("finale.json")).toBe(false);
  });

  test("validates and imports a single-performer portable drill", async () => {
    const { created, repository } = createRepository();

    await expect(
      importEight2FiveDrillJson(repository, JSON.stringify(VALID_DOCUMENT)),
    ).resolves.toBe(created);

    expect(repository.createDrill).toHaveBeenCalledWith({
      name: "Part 4 Finale",
      fieldPreset: "football-nfhs",
      createdAt: Date.parse("2026-08-03T18:00:00.000Z"),
      updatedAt: Date.parse("2026-08-03T18:00:00.000Z"),
    });
    expect(repository.createSet).toHaveBeenNthCalledWith(1, {
      drillId: "drill-1",
      number: 1,
      kind: "set",
      countsFromPrevious: 0,
      position: { xSteps: -8, ySteps: 0 },
    });
    expect(repository.createSet).toHaveBeenNthCalledWith(2, {
      drillId: "drill-1",
      number: 2,
      kind: "set",
      countsFromPrevious: 16,
      measureRange: { start: 12, end: 15 },
      position: { xSteps: 4, ySteps: 32 },
      facingDegrees: 90,
    });
    expect(repository.deleteDrill).not.toHaveBeenCalled();
  });

  test("accepts multi-performer files with props and groups selectable performers by symbol", () => {
    const parsed = parseImportableDrillJson(
      JSON.stringify(MULTI_ENTITY_DOCUMENT),
    );

    expect(getPerformerSymbolGroups(parsed)).toEqual([
      {
        symbol: "B",
        performers: [
          expect.objectContaining({ id: 42, label: "B1" }),
          expect.objectContaining({ id: 43, label: "B2" }),
        ],
      },
      {
        symbol: "T",
        performers: [expect.objectContaining({ id: 44, label: "T1" })],
      },
    ]);
  });

  test("imports only the coordinates for the performer selected from a multi-performer file", async () => {
    const { repository } = createRepository();

    await importEight2FiveDrillDocument(repository, MULTI_ENTITY_DOCUMENT, 43);

    expect(repository.createSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        position: { xSteps: 10, ySteps: 12 },
      }),
    );
    expect(repository.createSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        position: { xSteps: 14, ySteps: 20 },
      }),
    );
  });

  test("requires an explicit performer selection when a file has multiple performers", async () => {
    const { repository } = createRepository();

    await expect(
      importEight2FiveDrillDocument(repository, MULTI_ENTITY_DOCUMENT),
    ).rejects.toThrow("Select your performer");
    expect(repository.createDrill).not.toHaveBeenCalled();
  });

  test("allows unsupported path geometry on other entities but rejects it for the selected performer", async () => {
    const otherEntityCurved: DrillDocument = {
      ...MULTI_ENTITY_DOCUMENT,
      paths: [
        {
          entityId: 99,
          fromSetId: 0,
          toSetId: 1,
          kind: "polyline",
          waypoints: [{ xSteps: 2, ySteps: 2 }],
        },
      ],
    };
    const firstRepository = createRepository().repository;
    await expect(
      importEight2FiveDrillDocument(firstRepository, otherEntityCurved, 43),
    ).resolves.toBeDefined();

    const selectedCurved: DrillDocument = {
      ...MULTI_ENTITY_DOCUMENT,
      paths: [
        {
          entityId: 43,
          fromSetId: 0,
          toSetId: 1,
          kind: "polyline",
          waypoints: [{ xSteps: 12, ySteps: 16 }],
        },
      ],
    };
    const secondRepository = createRepository().repository;
    await expect(
      importEight2FiveDrillDocument(secondRepository, selectedCurved, 43),
    ).rejects.toThrow("polyline or Bézier");
    expect(secondRepository.createDrill).not.toHaveBeenCalled();
  });

  test("rejects custom fields and files without any performers", () => {
    const customFieldDocument = {
      ...VALID_DOCUMENT,
      field: {
        type: "custom" as const,
        name: "Custom",
        physicalGeometry: {
          bounds: {
            minXMeters: 0,
            maxXMeters: 10,
            minYMeters: 0,
            maxYMeters: 10,
          },
          referenceLines: [
            { id: "left", name: "Left", axis: "x", coordinateMeters: 0 },
            { id: "right", name: "Right", axis: "x", coordinateMeters: 10 },
            { id: "front", name: "Front", axis: "y", coordinateMeters: 0 },
            { id: "back", name: "Back", axis: "y", coordinateMeters: 10 },
          ],
        },
        marchingGrid: {
          bounds: {
            minXSteps: 0,
            maxXSteps: 10,
            minYSteps: 0,
            maxYSteps: 10,
          },
          referenceLines: [
            { id: "left", name: "Left", axis: "x", coordinateSteps: 0 },
            { id: "right", name: "Right", axis: "x", coordinateSteps: 10 },
            { id: "front", name: "Front", axis: "y", coordinateSteps: 0 },
            { id: "back", name: "Back", axis: "y", coordinateSteps: 10 },
          ],
        },
        markings: getFieldPreset("football-nfhs").markings,
      },
    } satisfies DrillDocument;
    expect(() =>
      parseImportableDrillJson(JSON.stringify(customFieldDocument)),
    ).toThrow("Custom field definitions");

    const propsOnly: DrillDocument = {
      ...VALID_DOCUMENT,
      entities: [{ id: 99, type: "prop", symbol: "P", label: "P1" }],
      positions: [
        { entityId: 99, setId: 0, xSteps: 0, ySteps: 0 },
        { entityId: 99, setId: 1, xSteps: 0, ySteps: 8 },
      ],
    };
    expect(() => parseImportableDrillJson(JSON.stringify(propsOnly))).toThrow(
      "does not contain a performer",
    );
  });

  test("rolls back a partially-created drill if a set insert fails", async () => {
    const repository = {
      createDrill: jest.fn(async () => ({
        id: "drill-1",
        name: "Part 4 Finale",
        fieldPreset: "football-nfhs" as const,
        createdAt: 1,
        updatedAt: 1,
      })),
      createSet: jest
        .fn()
        .mockResolvedValueOnce({ id: "set-1" })
        .mockRejectedValueOnce(new Error("database failed")),
      deleteDrill: jest.fn(async () => undefined),
    } as unknown as DrillRepository;

    await expect(
      importEight2FiveDrillJson(repository, JSON.stringify(VALID_DOCUMENT)),
    ).rejects.toThrow("database failed");
    expect(repository.deleteDrill).toHaveBeenCalledWith("drill-1");
  });
});
