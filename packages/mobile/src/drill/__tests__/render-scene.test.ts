import {
  DRILL_MARKER_COLORS,
  DRILL_MARKER_SIZE_METERS,
  DRILL_MARKER_SIZE_STEPS,
  LIVE_POSITION_MARKER_DIAMETER_METERS,
  LIVE_POSITION_MARKER_SIZE_STEPS,
} from "../../field/render/field-render-tokens";
import {
  buildDrillRenderScene,
  DEFAULT_PERFORMER_DIAMETER_METERS,
  DRILL_RENDER_LAYER_ORDER,
  projectTransitionPathGeometry,
  resolveSelectedSourceSetId,
  resolvePropPhysicalSize,
  shouldBuildDrillRenderScene,
  type DrillRenderSceneSettings,
} from "../render-scene";
import { measurePhysicalTransitionGeometry } from "../physical-transition-geometry";
import { buildTransitionScene } from "../transition-scene";
import type { DrillDocument, FieldDefinition } from "@eight2five/drill-schema";
import {
  COLOR_PRESETS,
  drillGridToPhysicalPoint,
  getFieldPreset,
} from "@eight2five/drill-schema";

const SETTINGS: DrillRenderSceneSettings = {
  showPerformerLabels: true,
  showPerformerNames: true,
  showPropLabels: true,
  showPropNames: true,
  markerEnabled: true,
  showAll: false,
  previousTotalCount: 2,
  nextTotalCount: 2,
};

const DOCUMENT: DrillDocument = {
  schema: "https://eight2five.com/schema/drill",
  schemaVersion: "2.0.0",
  metadata: {
    title: "Entity render fixture",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  field: { type: "preset", preset: "football-nfhs" },
  entityRules: {
    bySymbol: {
      performer: { appearance: { color: "#101010", icon: "diamond" } },
    },
    byLabel: {
      Flag: {
        size: { length: 2, width: 1, unit: "feet" },
        appearance: { color: "#123456", icon: "square" },
      },
    },
  },
  entities: [
    {
      id: 1,
      type: "performer",
      symbol: "performer",
      label: "A",
      name: "Alice",
    },
    {
      id: 2,
      type: "performer",
      symbol: "performer",
      label: "B",
      name: "Bob",
    },
    {
      id: 3,
      type: "prop",
      symbol: "prop",
      label: "Flag",
      name: "Blue flag",
    },
  ],
  sets: [
    {
      id: 10,
      number: 1,
      kind: "set",
      countsFromPrevious: 0,
    },
    {
      id: 11,
      number: 2,
      kind: "set",
      countsFromPrevious: 8,
    },
    {
      id: 12,
      number: 3,
      kind: "set",
      countsFromPrevious: 8,
    },
  ],
  positions: [
    { entityId: 1, setId: 10, xSteps: 0, ySteps: 0 },
    { entityId: 1, setId: 11, xSteps: 8, ySteps: 8 },
    { entityId: 1, setId: 12, xSteps: 16, ySteps: 8 },
    { entityId: 2, setId: 11, xSteps: 10, ySteps: 30 },
    { entityId: 3, setId: 11, xSteps: -10, ySteps: 20 },
  ],
  paths: [
    {
      entityId: 1,
      fromSetId: 10,
      toSetId: 11,
      kind: "polyline",
      waypoints: [{ xSteps: 4, ySteps: 1 }],
    },
  ],
};

const NON_UNIFORM_CUSTOM_FIELD: FieldDefinition = {
  type: "custom",
  name: "Non-uniform test field",
  physicalGeometry: {
    bounds: {
      minXMeters: -10,
      maxXMeters: 10,
      minYMeters: 0,
      maxYMeters: 168,
    },
    referenceLines: [
      { id: "x-min", name: "X minimum", axis: "x", coordinateMeters: -10 },
      { id: "x-max", name: "X maximum", axis: "x", coordinateMeters: 10 },
      { id: "y-front", name: "Y front", axis: "y", coordinateMeters: 0 },
      { id: "y-back", name: "Y back", axis: "y", coordinateMeters: 168 },
    ],
  },
  marchingGrid: {
    bounds: {
      minXSteps: -10,
      maxXSteps: 10,
      minYSteps: 0,
      maxYSteps: 84,
    },
    referenceLines: [
      { id: "x-min", name: "X minimum", axis: "x", coordinateSteps: -10 },
      { id: "x-max", name: "X maximum", axis: "x", coordinateSteps: 10 },
      { id: "y-front", name: "Y front", axis: "y", coordinateSteps: 0 },
      { id: "y-back", name: "Y back", axis: "y", coordinateSteps: 84 },
    ],
  },
  markings: {
    yardNumbers: {
      heightMeters: 0,
      nominalWidthMeters: 0,
      centerFromFrontSidelineMeters: 0,
      centerFromBackSidelineMeters: 0,
    },
    inboundsHashMarks: { lengthMeters: 0, spacingMeters: 1 },
    sidelineHashMarks: {
      lengthMeters: 0,
      spacingMeters: 1,
      insetFromSidelineMeters: 0,
    },
  },
};

describe("selected-set drill render scene", () => {
  test("uses the drill feature master switch as a scene creation policy", () => {
    expect(shouldBuildDrillRenderScene(true)).toBe(true);
    expect(shouldBuildDrillRenderScene(false)).toBe(false);
  });

  test("maps an opaque local set row to its nontrivial portable source set id", () => {
    expect(
      resolveSelectedSourceSetId({ id: "sqlite-set-900", sourceSetId: 11 }),
    ).toBe(11);
    expect(resolveSelectedSourceSetId({ id: "manual-set" })).toBeUndefined();
  });

  test("resolves every ordinary entity, projects it, and keeps the selected performer in the target layer", () => {
    const scene = buildDrillRenderScene({
      document: DOCUMENT,
      field: "football-nfhs",
      selectedPerformerEntityId: 1,
      selectedSourceSetId: 11,
      settings: SETTINGS,
    });
    const performer = scene.entities.find((entity) => entity.entityId === 2);
    const prop = scene.entities.find((entity) => entity.entityId === 3);

    expect(scene.entities.map((entity) => entity.entityId)).toEqual([2, 3]);
    expect(performer).toMatchObject({
      type: "performer",
      diameterMeters: DEFAULT_PERFORMER_DIAMETER_METERS,
      color: "#101010",
      icon: "diamond",
      labelText: "B",
      nameText: "Bob",
      opacity: 1,
    });
    expect(prop).toMatchObject({
      type: "prop",
      widthMeters: 0.3048,
      lengthMeters: 0.6096,
      color: "#123456",
      icon: "square",
      labelText: "Flag",
      nameText: "Blue flag",
      opacity: 1,
    });
    expect(scene.current).toEqual(physicalPoint({ xSteps: 8, ySteps: 8 }));
    expect(scene.previous?.geometry.kind).toBe("polyline");
    expect(scene.next?.geometry.kind).toBe("straight");
    expect(scene.previous?.midpoint).toEqual(
      measurePhysicalTransitionGeometry(scene.previous!.geometry).midpoint,
    );
    expect(scene.previous?.geometry).toMatchObject({
      points: [
        physicalPoint({ xSteps: 0, ySteps: 0 }),
        physicalPoint({ xSteps: 4, ySteps: 1 }),
        physicalPoint({ xSteps: 8, ySteps: 8 }),
      ],
    });
    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(scene.entities)).toBe(true);
  });

  test("keeps labels and names independent and marker master only suppresses transition graphics", () => {
    const scene = buildDrillRenderScene({
      document: DOCUMENT,
      field: "football-nfhs",
      selectedPerformerEntityId: 1,
      selectedSourceSetId: 11,
      settings: {
        ...SETTINGS,
        showPerformerLabels: false,
        showPropLabels: false,
        markerEnabled: false,
      },
    });

    expect(scene.entities[0].labelText).toBeUndefined();
    expect(scene.entities[0].nameText).toBe("Bob");
    expect(scene.entities[1].labelText).toBeUndefined();
    expect(scene.entities[1].nameText).toBe("Blue flag");
    expect(scene.current).not.toBeNull();
    expect(scene.previous).toBeUndefined();
    expect(scene.next).toBeUndefined();
    expect(scene.previousDots).toEqual([]);
    expect(scene.nextDots).toEqual([]);
  });

  test("does not invent a selected target or transitions when its source position is missing", () => {
    const documentWithoutCurrentPosition: DrillDocument = {
      ...DOCUMENT,
      positions: DOCUMENT.positions.filter(
        (position) => !(position.entityId === 1 && position.setId === 11),
      ),
    };
    const scene = buildDrillRenderScene({
      document: documentWithoutCurrentPosition,
      field: "football-nfhs",
      selectedPerformerEntityId: 1,
      selectedSourceSetId: 11,
      settings: SETTINGS,
    });

    expect(scene.current).toBeNull();
    expect(scene.previous).toBeUndefined();
    expect(scene.next).toBeUndefined();
    expect(scene.previousDots).toEqual([]);
    expect(scene.nextDots).toEqual([]);
  });

  test("measures midpoint from the projected connector geometry on a nonlinear field", () => {
    const documentWithCurve: DrillDocument = {
      ...DOCUMENT,
      paths: [
        {
          entityId: 1,
          fromSetId: 10,
          toSetId: 11,
          kind: "bezier",
          controlPoints: [
            { xSteps: 0, ySteps: 30 },
            { xSteps: 8, ySteps: 30 },
          ],
        },
      ],
    };
    const scene = buildDrillRenderScene({
      document: documentWithCurve,
      field: NON_UNIFORM_CUSTOM_FIELD,
      selectedPerformerEntityId: 1,
      selectedSourceSetId: 11,
      settings: SETTINGS,
    });
    const previous = scene.previous;
    expect(previous?.geometry.kind).toBe("bezier");
    if (!previous || previous.geometry.kind !== "bezier") return;

    const measured = measurePhysicalTransitionGeometry(previous.geometry);
    expect(previous.midpoint).toEqual(measured.midpoint);
    expect(previous.midpointParameter).toBe(measured.midpointParameter);

    const gridScene = buildTransitionScene({
      document: documentWithCurve,
      selectedPerformerEntityId: 1,
      selectedSourceSetId: 11,
      settings: SETTINGS,
    });
    expect(previous.lengthSteps).toBe(gridScene.previous?.lengthSteps);
    const projectedGridMidpoint = drillGridToPhysicalPoint(
      gridScene.previous!.midpoint,
      NON_UNIFORM_CUSTOM_FIELD,
    );
    expect(previous.midpoint).not.toEqual(projectedGridMidpoint);
  });

  test("projects path controls and waypoints through the active field preset", () => {
    const geometry = projectTransitionPathGeometry(
      {
        kind: "bezier",
        start: { xSteps: -8, ySteps: 4 },
        controlPoints: [
          { xSteps: -2, ySteps: 12 },
          { xSteps: 4, ySteps: 16 },
        ],
        end: { xSteps: 8, ySteps: 20 },
      },
      "football-ncaa",
    );

    expect(geometry).toEqual({
      kind: "bezier",
      start: physicalPoint({ xSteps: -8, ySteps: 4 }, "football-ncaa"),
      controlPoints: [
        physicalPoint({ xSteps: -2, ySteps: 12 }, "football-ncaa"),
        physicalPoint({ xSteps: 4, ySteps: 16 }, "football-ncaa"),
      ],
      end: physicalPoint({ xSteps: 8, ySteps: 20 }, "football-ncaa"),
    });
  });

  test("converts prop sizes and keeps marker size math explicit", () => {
    expect(
      resolvePropPhysicalSize({
        size: { length: 1, width: 2, unit: "meters" },
      }),
    ).toEqual({ widthMeters: 2, lengthMeters: 1 });
    expect(DEFAULT_PERFORMER_DIAMETER_METERS).toBe(0.5715);
    expect(DRILL_MARKER_SIZE_STEPS).toEqual({
      currentDiameter: 2,
      transitionDiameter: 1,
      midpointDiameter: 0.5,
    });
    expect(DRILL_MARKER_SIZE_METERS.currentDiameter).toBeCloseTo(1.143);
    expect(DRILL_MARKER_SIZE_METERS.transitionDiameter).toBeCloseTo(0.5715);
    expect(DRILL_MARKER_SIZE_METERS.midpointDiameter).toBeCloseTo(0.28575);
    expect(LIVE_POSITION_MARKER_SIZE_STEPS).toBe(1.5);
    expect(LIVE_POSITION_MARKER_DIAMETER_METERS).toBeCloseTo(0.85725);
    expect(DRILL_MARKER_COLORS).toEqual({
      yellow: COLOR_PRESETS.yellow,
      red: COLOR_PRESETS.red,
      green: COLOR_PRESETS.green,
    });
    expect(DRILL_RENDER_LAYER_ORDER).toEqual([
      "static",
      "anchors",
      "entities",
      "extra-connectors",
      "extra-dots",
      "previous",
      "next",
      "current-target",
      "guidance",
      "live-position",
    ]);
  });
});

function physicalPoint(
  point: { readonly xSteps: number; readonly ySteps: number },
  preset: "football-nfhs" | "football-ncaa" = "football-nfhs",
) {
  return drillGridToPhysicalPoint(point, getFieldPreset(preset));
}
