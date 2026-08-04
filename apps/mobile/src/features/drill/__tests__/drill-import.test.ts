import type { DrillRepository } from "@eight2five/mobile/drill";
import {
  DRILL_SCHEMA_URL,
  DRILL_SCHEMA_VERSION,
  type DrillDocument,
} from "@eight2five/drill-schema";

import {
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

describe("Eight2Five drill import", () => {
  test("recognizes the converter drill file extension", () => {
    expect(isEight2FiveDrillFileName("finale.eight2five.json")).toBe(true);
    expect(isEight2FiveDrillFileName("EIGHT2FIVE.JSON")).toBe(true);
    expect(isEight2FiveDrillFileName("finale.json")).toBe(false);
  });

  test("validates and imports a single-performer portable drill", async () => {
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

  test("rejects unsupported multi-performer documents before writing", () => {
    const document: DrillDocument = {
      ...VALID_DOCUMENT,
      entities: [
        ...VALID_DOCUMENT.entities,
        {
          id: 43,
          type: "performer",
          symbol: "B",
          label: "B2",
        },
      ],
      positions: [
        ...VALID_DOCUMENT.positions,
        { entityId: 43, setId: 0, xSteps: 0, ySteps: 0 },
        { entityId: 43, setId: 1, xSteps: 8, ySteps: 8 },
      ],
    };

    expect(() => parseImportableDrillJson(JSON.stringify(document))).toThrow(
      "exactly one performer",
    );
  });

  test("rejects custom fields and non-straight path geometry", () => {
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
      },
    } satisfies DrillDocument;
    expect(() =>
      parseImportableDrillJson(JSON.stringify(customFieldDocument)),
    ).toThrow("Custom field definitions");

    const curvedPathDocument = {
      ...VALID_DOCUMENT,
      paths: [
        {
          entityId: 42,
          fromSetId: 0,
          toSetId: 1,
          kind: "polyline" as const,
          waypoints: [{ xSteps: 2, ySteps: 2 }],
        },
      ],
    } satisfies DrillDocument;
    expect(() =>
      parseImportableDrillJson(JSON.stringify(curvedPathDocument)),
    ).toThrow("Polyline and Bézier");
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
