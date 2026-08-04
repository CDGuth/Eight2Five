import {
  COLOR_PRESETS,
  FIELD_PRESET_IDS,
  parseDrillDocument,
  resolveDrillEntity,
  type DrillDocument,
} from "@eight2five/drill-schema";

import {
  applyConverterSettings,
  createDefaultConverterSettings,
  createEmptyRuleDraft,
  downloadFileName,
  FIELD_PRESET_OPTIONS,
  inferTitleFromFileName,
  validateConverterSettings,
} from "../settings";

const source: DrillDocument = parseDrillDocument({
  schema: "https://eight2five.com/schema/drill",
  schemaVersion: "1.0.0",
  metadata: {
    title: "Imported",
    createdAt: "2026-08-02T18:00:00.000Z",
  },
  field: { type: "preset", preset: "football-nfhs" },
  entities: [
    { id: 1, type: "performer", symbol: "B", label: "B1" },
    { id: 2, type: "performer", symbol: "X", label: "P2" },
  ],
  sets: [
    { id: 0, number: 1, kind: "set", countsFromPrevious: 0 },
    { id: 1, number: 2, kind: "set", countsFromPrevious: 8 },
  ],
  positions: [
    { entityId: 1, setId: 0, xSteps: 0, ySteps: 0 },
    { entityId: 1, setId: 1, xSteps: 8, ySteps: 8 },
    { entityId: 2, setId: 0, xSteps: 0, ySteps: 4 },
    { entityId: 2, setId: 1, xSteps: 4, ySteps: 8 },
  ],
  provenance: {
    source: { kind: "coordinate-sheet-pdf", fileName: "coords.pdf" },
    references: [
      {
        target: { type: "position", entityId: 1, setId: 0 },
        page: 1,
        rawText: "Set 1 row",
      },
    ],
  },
});

describe("drill converter settings", () => {
  test("keeps the default UI minimal and validates NFHS settings", () => {
    const settings = { ...createDefaultConverterSettings(), title: "Part 4" };
    expect(validateConverterSettings(settings)).toMatchObject({
      field: { type: "preset", preset: "football-nfhs" },
      errors: [],
    });
  });

  test("exposes every schema field preset in schema order", () => {
    expect(FIELD_PRESET_OPTIONS.map(({ value }) => value)).toEqual(
      FIELD_PRESET_IDS,
    );
  });

  test("applies metadata, props, rules, and optional explicit straight paths", () => {
    const symbolRule = {
      ...createEmptyRuleDraft("rule-1"),
      key: "B",
      instrument: "Baritone",
      color: COLOR_PRESETS.blue,
    };
    const labelRule = {
      ...createEmptyRuleDraft("rule-2"),
      target: "label" as const,
      key: "B1",
      color: COLOR_PRESETS.green,
      labelVisibility: "hidden" as const,
    };
    const settings = {
      ...createDefaultConverterSettings(),
      title: "Part 4",
      drillWriter: "Writer",
      ensemble: "UHS",
      description: "Final movement",
      lucideIcon: "music-2",
      propSymbols: ["X"],
      rules: [symbolRule, labelRule],
      includeSourceReferences: false,
      explicitStraightPaths: true,
    };
    const validation = validateConverterSettings(settings);
    expect(validation.errors).toEqual([]);

    const result = applyConverterSettings(source, settings, validation);
    expect(result.metadata).toMatchObject({
      title: "Part 4",
      drillWriter: "Writer",
      ensemble: "UHS",
      description: "Final movement",
      lucideIcon: "music-2",
    });
    expect(result.entities[1].type).toBe("prop");
    expect(result.provenance?.references).toBeUndefined();
    expect(result.paths).toHaveLength(2);
    expect(
      resolveDrillEntity(result.entities[0], result.entityRules),
    ).toMatchObject({
      instrument: "Baritone",
      appearance: { color: COLOR_PRESETS.green, labelVisible: false },
    });
  });

  test("rejects malformed custom fields and duplicate rule targets", () => {
    const settings = {
      ...createDefaultConverterSettings(),
      title: "Part 4",
      fieldMode: "custom" as const,
      customFieldJson: "{bad json",
      rules: [
        { ...createEmptyRuleDraft("1"), key: "B", instrument: "Baritone" },
        { ...createEmptyRuleDraft("2"), key: "B", instrument: "Trombone" },
      ],
    };
    expect(validateConverterSettings(settings).errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Custom field JSON is invalid"),
        expect.stringContaining("Duplicate symbol rule"),
      ]),
    );
  });

  test("creates stable human-readable output names", () => {
    expect(inferTitleFromFileName("2026_UHS-Part-4_COORDINATES.pdf")).toBe(
      "2026 UHS Part 4 COORDINATES",
    );
    expect(downloadFileName("Part 4 / Finale!")).toBe(
      "part-4-finale.eight2five.json",
    );
  });
});
