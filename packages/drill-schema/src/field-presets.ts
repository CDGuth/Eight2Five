import {
  FIELD_PRESET_IDS,
  type FieldPresetId,
  type MarchingReferenceLine,
  type PhysicalReferenceLine,
  type ResolvedFieldDefinition,
} from "./types";

const FEET_TO_METERS = 0.3048;
const YARDS_TO_METERS = 0.9144;
const FIELD_HALF_LENGTH_METERS = 50 * YARDS_TO_METERS;
const FIELD_WIDTH_METERS = 160 * FEET_TO_METERS;

function xReferenceLines(): {
  physical: readonly PhysicalReferenceLine[];
  marching: readonly MarchingReferenceLine[];
} {
  const physical: PhysicalReferenceLine[] = [];
  const marching: MarchingReferenceLine[] = [];
  for (let absoluteYards = -50; absoluteYards <= 50; absoluteYards += 5) {
    const id =
      absoluteYards === 0
        ? "50-yard-line"
        : `${absoluteYards < 0 ? "side-1" : "side-2"}-${50 - Math.abs(absoluteYards)}-yard-line`;
    const name =
      absoluteYards === 0
        ? "50 Yard Line"
        : `${absoluteYards < 0 ? "Side 1" : "Side 2"} ${50 - Math.abs(absoluteYards)} Yard Line`;
    physical.push({
      id,
      name,
      axis: "x",
      coordinateMeters: absoluteYards * YARDS_TO_METERS,
    });
    marching.push({
      id,
      name,
      axis: "x",
      coordinateSteps: (absoluteYards / 5) * 8,
    });
  }
  return { physical: Object.freeze(physical), marching: Object.freeze(marching) };
}

const X_REFERENCES = xReferenceLines();

function makeFootballPreset({
  id,
  name,
  physicalFrontHashFeet,
  gridFrontHashSteps,
  gridBackHashSteps,
}: {
  id: FieldPresetId;
  name: string;
  physicalFrontHashFeet: number;
  gridFrontHashSteps: number;
  gridBackHashSteps: number;
}): ResolvedFieldDefinition {
  const physicalFrontHashMeters = physicalFrontHashFeet * FEET_TO_METERS;
  const physicalBackHashMeters = FIELD_WIDTH_METERS - physicalFrontHashMeters;
  const physicalYReferences: readonly PhysicalReferenceLine[] = Object.freeze([
    {
      id: "front-sideline",
      name: "Front Sideline",
      axis: "y",
      coordinateMeters: 0,
    },
    {
      id: "front-hash",
      name: "Front Hash",
      axis: "y",
      coordinateMeters: physicalFrontHashMeters,
    },
    {
      id: "back-hash",
      name: "Back Hash",
      axis: "y",
      coordinateMeters: physicalBackHashMeters,
    },
    {
      id: "back-sideline",
      name: "Back Sideline",
      axis: "y",
      coordinateMeters: FIELD_WIDTH_METERS,
    },
  ]);
  const marchingYReferences: readonly MarchingReferenceLine[] = Object.freeze([
    {
      id: "front-sideline",
      name: "Front Sideline",
      axis: "y",
      coordinateSteps: 0,
    },
    {
      id: "front-hash",
      name: "Front Hash",
      axis: "y",
      coordinateSteps: gridFrontHashSteps,
    },
    {
      id: "back-hash",
      name: "Back Hash",
      axis: "y",
      coordinateSteps: gridBackHashSteps,
    },
    {
      id: "back-sideline",
      name: "Back Sideline",
      axis: "y",
      coordinateSteps: 84,
    },
  ]);

  return Object.freeze({
    id,
    name,
    physicalGeometry: Object.freeze({
      bounds: Object.freeze({
        minXMeters: -FIELD_HALF_LENGTH_METERS,
        maxXMeters: FIELD_HALF_LENGTH_METERS,
        minYMeters: 0,
        maxYMeters: FIELD_WIDTH_METERS,
      }),
      referenceLines: Object.freeze([
        ...X_REFERENCES.physical,
        ...physicalYReferences,
      ]),
    }),
    marchingGrid: Object.freeze({
      bounds: Object.freeze({
        minXSteps: -80,
        maxXSteps: 80,
        minYSteps: 0,
        maxYSteps: 84,
      }),
      referenceLines: Object.freeze([
        ...X_REFERENCES.marching,
        ...marchingYReferences,
      ]),
    }),
  });
}

const FIELD_PRESET_ID_SET = new Set<FieldPresetId>(FIELD_PRESET_IDS);

export function isFieldPresetId(value: unknown): value is FieldPresetId {
  return (
    typeof value === "string" &&
    FIELD_PRESET_ID_SET.has(value as FieldPresetId)
  );
}

/**
 * Presets keep exact physical football geometry separate from conventional
 * marching-grid references. The grid is intentionally not a literal inches
 * measurement: e.g. NFHS hashes are conventionally 28/56 on an 84-step grid.
 */
export const FIELD_PRESETS: Readonly<Record<FieldPresetId, ResolvedFieldDefinition>> =
  Object.freeze({
    "football-nfhs": makeFootballPreset({
      id: "football-nfhs",
      name: "High School (NFHS)",
      physicalFrontHashFeet: 53 + 4 / 12,
      gridFrontHashSteps: 28,
      gridBackHashSteps: 56,
    }),
    "football-ncaa": makeFootballPreset({
      id: "football-ncaa",
      name: "College (NCAA)",
      physicalFrontHashFeet: 60,
      gridFrontHashSteps: 32,
      gridBackHashSteps: 52,
    }),
    "football-texas-uil": makeFootballPreset({
      id: "football-texas-uil",
      name: "Texas High School (UIL)",
      physicalFrontHashFeet: 60,
      gridFrontHashSteps: 32,
      gridBackHashSteps: 52,
    }),
    "football-nfl": makeFootballPreset({
      id: "football-nfl",
      name: "Professional (NFL)",
      physicalFrontHashFeet: 70 + 9 / 12,
      // There is no broadly standardized marching-band NFL grid convention.
      // Preserve the physical hash proportions on Eight2Five's 84-step grid.
      gridFrontHashSteps: ((70 + 9 / 12) / 160) * 84,
      gridBackHashSteps: 84 - ((70 + 9 / 12) / 160) * 84,
    }),
  });

export function getFieldPreset(id: FieldPresetId): ResolvedFieldDefinition {
  return FIELD_PRESETS[id];
}
