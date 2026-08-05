import {
  COLOR_PRESETS,
  DEFAULT_PROP_SIZE,
  FIELD_PRESETS,
  FIELD_PRESET_IDS,
  countPrimarySets,
  convertPropSizeValue,
  drillGridToPhysicalPoint,
  formatSetName,
  getFieldPreset,
  getGridReference,
  isFieldPresetId,
  parseDrillDocument,
  physicalPointToDrillGrid,
  resolveDrillEntity,
  resolveFieldDefinition,
  resolveEntityRuleValues,
  resolvePropSize,
  serializeDrillDocument,
  type DrillDocument,
} from "..";

const fixture: DrillDocument = {
  schema: "https://eight2five.com/schema/drill",
  schemaVersion: "2.0.0",
  metadata: {
    title: "Part 4",
    createdAt: "2026-08-02T17:30:00.000Z",
  },
  field: { type: "preset", preset: "football-nfhs" },
  entityRules: {
    bySymbol: {
      B: {
        instrument: "Baritone",
        appearance: { color: COLOR_PRESETS.blue },
      },
    },
    byLabel: {
      B1: { appearance: { color: COLOR_PRESETS.green } },
    },
  },
  entities: [
    {
      id: 1595433022185,
      type: "performer",
      symbol: "B",
      label: "B1",
    },
  ],
  sets: [
    {
      id: 0,
      number: 31,
      kind: "set",
      countsFromPrevious: 0,
      measureRange: { start: 122, end: 125 },
    },
    {
      id: 1,
      number: 31,
      suffix: "A",
      kind: "subset",
      countsFromPrevious: 8,
    },
    {
      id: 2,
      number: 31,
      suffix: ".5",
      kind: "subset",
      countsFromPrevious: 8,
    },
    {
      id: 3,
      number: 32,
      kind: "set",
      countsFromPrevious: 16,
      measureRange: { start: 126, end: 129 },
    },
  ],
  positions: [
    { entityId: 1595433022185, setId: 0, xSteps: 0, ySteps: 0 },
    { entityId: 1595433022185, setId: 1, xSteps: -4, ySteps: 28 },
    { entityId: 1595433022185, setId: 2, xSteps: -2, ySteps: 30 },
    { entityId: 1595433022185, setId: 3, xSteps: 0, ySteps: 32 },
  ],
};

describe("drill schema", () => {
  it("accepts the current set/subset model and round trips JSON", () => {
    const parsed = parseDrillDocument(fixture);
    expect(countPrimarySets(parsed.sets)).toBe(2);
    expect(formatSetName(parsed.sets[1])).toBe("31A");
    expect(formatSetName(parsed.sets[2])).toBe("31.5");
    expect(parseDrillDocument(JSON.parse(serializeDrillDocument(parsed)))).toEqual(
      parsed,
    );
  });

  it("rejects arbitrary labels on sets", () => {
    expect(() =>
      parseDrillDocument({
        ...fixture,
        sets: [{ ...fixture.sets[0], label: "Finale" }],
      }),
    ).toThrow();
  });

  it("requires set ids to follow array order", () => {
    expect(() =>
      parseDrillDocument({
        ...fixture,
        sets: fixture.sets.map((set, index) =>
          index === 1 ? { ...set, id: 9 } : set,
        ),
      }),
    ).toThrow(/zero-based array index/);
  });

  it("requires subsets to share a number with a primary set", () => {
    expect(() =>
      parseDrillDocument({
        ...fixture,
        sets: fixture.sets.map((set, index) =>
          index === 1 ? { ...set, number: 99 } : set,
        ),
      }),
    ).toThrow(/requires a primary set/);
  });

  it("accepts source symbols beyond A-Z", () => {
    expect(() =>
      parseDrillDocument({
        ...fixture,
        entityRules: { bySymbol: { $: { section: "Guard" } } },
        entities: [{ ...fixture.entities[0], symbol: "$", label: "$1" }],
      }),
    ).not.toThrow();
  });

  it("resolves entity rules from broad to specific", () => {
    const rules = {
      ...fixture.entityRules,
      byLabel: {
        B1: {
          name: "Lead Baritone",
          appearance: { color: COLOR_PRESETS.green },
        },
      },
    };
    const entity = resolveDrillEntity(fixture.entities[0], rules);
    expect(entity.name).toBe("Lead Baritone");
    expect(entity.instrument).toBe("Baritone");
    expect(entity.appearance).toEqual({
      icon: "dot",
      color: COLOR_PRESETS.green,
      labelVisible: true,
    });
    expect(resolveEntityRuleValues(fixture.entities[0], rules)).toMatchObject({
      name: "Lead Baritone",
      instrument: "Baritone",
    });
  });

  it("allows names on both performers and props but rejects performer-only prop fields", () => {
    expect(() =>
      parseDrillDocument({
        ...fixture,
        entities: [
          {
            id: 1595433022185,
            type: "prop",
            symbol: "P",
            label: "P1",
            name: "Podium",
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      parseDrillDocument({
        ...fixture,
        entities: [
          {
            id: 1595433022185,
            type: "prop",
            symbol: "P",
            label: "P1",
            name: "Podium",
            section: "Guard",
          },
        ],
      }),
    ).toThrow(/Props cannot define a section/);

    expect(() =>
      parseDrillDocument({
        ...fixture,
        entityRules: {
          bySymbol: {
            P: { type: "prop", instrument: "Flag" },
          },
        },
      }),
    ).toThrow(/Prop rules cannot define an instrument/);
  });

  it("defaults prop size to 1 by 1 8-to-5 steps and supports unit conversion", () => {
    const prop = {
      ...fixture.entities[0],
      type: "prop" as const,
      symbol: "P",
      label: "P1",
    };
    expect(resolvePropSize(prop)).toEqual(DEFAULT_PROP_SIZE);
    expect(resolveDrillEntity(prop).size).toEqual(DEFAULT_PROP_SIZE);
    expect(convertPropSizeValue(1, "8-to-5-steps", "inches")).toBeCloseTo(
      22.5,
      8,
    );
    expect(convertPropSizeValue(1, "8-to-5-steps", "feet")).toBeCloseTo(
      1.875,
      8,
    );
    expect(convertPropSizeValue(1, "8-to-5-steps", "meters")).toBeCloseTo(
      0.5715,
      8,
    );
  });

  it.each(["8-to-5-steps", "feet", "inches", "meters"] as const)(
    "accepts prop size in %s",
    (unit) => {
      expect(() =>
        parseDrillDocument({
          ...fixture,
          entities: [
            {
              id: 1595433022185,
              type: "prop",
              symbol: "P",
              label: "P1",
              size: { length: 2.5, width: 1.25, unit },
            },
          ],
        }),
      ).not.toThrow();
    },
  );

  it("rejects size on performers and non-prop rules", () => {
    expect(() =>
      parseDrillDocument({
        ...fixture,
        entities: [
          {
            ...fixture.entities[0],
            size: { length: 1, width: 1, unit: "8-to-5-steps" },
          },
        ],
      }),
    ).toThrow(/Only props can define a size/);

    expect(() =>
      parseDrillDocument({
        ...fixture,
        entityRules: {
          bySymbol: {
            B: {
              type: "performer",
              size: { length: 1, width: 1, unit: "feet" },
            },
          },
        },
      }),
    ).toThrow(/Only prop rules can define a size/);
  });

  it("exposes the canonical color presets without indigo or violet", () => {
    expect(COLOR_PRESETS).toMatchObject({
      lightBlue: "#64B5F6",
      darkBlue: "#1E3A8A",
      purple: "#8E44AD",
      pink: "#EC4899",
      black: "#000000",
    });
    expect("indigo" in COLOR_PRESETS).toBe(false);
    expect("violet" in COLOR_PRESETS).toBe(false);
  });

  it("exposes all field preset ids from one canonical registry", () => {
    expect(FIELD_PRESET_IDS).toEqual(Object.keys(FIELD_PRESETS));
    for (const id of FIELD_PRESET_IDS) expect(isFieldPresetId(id)).toBe(true);
    expect(isFieldPresetId("football-made-up")).toBe(false);
  });

  it.each([
    ["football-nfhs", 53 + 4 / 12, 24, 4],
    ["football-ncaa", 60, 24, 4],
    ["football-texas-uil", 60, 24, 4],
    ["football-nfl", 70 + 9 / 12, 39, 8],
  ] as const)(
    "%s exposes its physical football markings",
    (presetId, hashFeet, numberCenterFeet, sidelineInsetInches) => {
      const field = getFieldPreset(presetId);
      const frontHash = field.physicalGeometry.referenceLines.find(
        (line) => line.id === "front-hash",
      );
      const backHash = field.physicalGeometry.referenceLines.find(
        (line) => line.id === "back-hash",
      );
      expect(frontHash?.coordinateMeters).toBeCloseTo(hashFeet * 0.3048, 8);
      expect(backHash?.coordinateMeters).toBeCloseTo(
        160 * 0.3048 - hashFeet * 0.3048,
        8,
      );
      expect(field.markings).toMatchObject({
        yardNumbers: {
          heightMeters: 6 * 0.3048,
          nominalWidthMeters: 4 * 0.3048,
          centerFromFrontSidelineMeters: numberCenterFeet * 0.3048,
          centerFromBackSidelineMeters: numberCenterFeet * 0.3048,
        },
        inboundsHashMarks: {
          lengthMeters: 2 * 0.3048,
          spacingMeters: 0.9144,
        },
        sidelineHashMarks: {
          lengthMeters: 2 * 0.3048,
          spacingMeters: 0.9144,
          insetFromSidelineMeters: (sidelineInsetInches / 12) * 0.3048,
        },
      });
      expect(field.markings.yardNumbers.centerFromFrontSidelineMeters).toBe(
        field.markings.yardNumbers.centerFromBackSidelineMeters,
      );
    },
  );

  it("parses self-describing custom field markings", () => {
    const preset = getFieldPreset("football-nfhs");
    const parsed = parseDrillDocument({
      ...fixture,
      field: {
        type: "custom",
        name: "Custom Football Field",
        physicalGeometry: preset.physicalGeometry,
        marchingGrid: preset.marchingGrid,
        markings: preset.markings,
      },
    });
    expect(parsed.field).toMatchObject({
      type: "custom",
      markings: preset.markings,
    });
    expect(resolveFieldDefinition(parsed.field).markings).toEqual(
      preset.markings,
    );
  });

  it.each(FIELD_PRESET_IDS)(
    "%s uses the canonical 160 by 84 marching-grid bounds",
    (preset) => {
      expect(getFieldPreset(preset).marchingGrid.bounds).toEqual({
        minXSteps: -80,
        maxXSteps: 80,
        minYSteps: 0,
        maxYSteps: 84,
      });
    },
  );

  it("keeps the conventional NFHS lateral references at 0/28/56/84", () => {
    const field = getFieldPreset("football-nfhs");
    expect(getGridReference(field, "front-sideline")?.coordinateSteps).toBe(0);
    expect(getGridReference(field, "front-hash")?.coordinateSteps).toBe(28);
    expect(getGridReference(field, "back-hash")?.coordinateSteps).toBe(56);
    expect(getGridReference(field, "back-sideline")?.coordinateSteps).toBe(84);
  });

  it.each(["football-ncaa", "football-texas-uil"] as const)(
    "%s keeps its schema-defined 0/32/52/84 lateral references",
    (preset) => {
      const field = getFieldPreset(preset);
      expect(getGridReference(field, "front-sideline")?.coordinateSteps).toBe(0);
      expect(getGridReference(field, "front-hash")?.coordinateSteps).toBe(32);
      expect(getGridReference(field, "back-hash")?.coordinateSteps).toBe(52);
      expect(getGridReference(field, "back-sideline")?.coordinateSteps).toBe(84);
    },
  );

  it("maps the conventional NFHS front hash to exact physical geometry", () => {
    const physical = drillGridToPhysicalPoint(
      { xSteps: 0, ySteps: 28 },
      fixture.field,
    );
    expect(physical.xMeters).toBeCloseTo(0, 8);
    expect(physical.yMeters).toBeCloseTo((53 + 4 / 12) * 0.3048, 8);

    const grid = physicalPointToDrillGrid(physical, fixture.field);
    expect(grid.xSteps).toBeCloseTo(0, 8);
    expect(grid.ySteps).toBeCloseTo(28, 8);
  });
});
