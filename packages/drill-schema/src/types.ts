export const DRILL_SCHEMA_URL = "https://eight2five.com/schema/drill" as const;
export const DRILL_SCHEMA_VERSION = "1.0.0" as const;

export type SetKind = "set" | "subset";
export type DrillEntityType = "performer" | "prop";
export const PROP_SIZE_UNITS = Object.freeze([
  "8-to-5-steps",
  "feet",
  "inches",
  "meters",
] as const);
export type PropSizeUnit = (typeof PROP_SIZE_UNITS)[number];

export interface PropSize {
  readonly length: number;
  readonly width: number;
  readonly unit: PropSizeUnit;
}

export type EntityIcon =
  | "dot"
  | "square"
  | "triangle"
  | "diamond"
  | "star"
  | "hexagon"
  | "cross";

export const FIELD_PRESET_IDS = Object.freeze([
  "football-nfhs",
  "football-ncaa",
  "football-texas-uil",
  "football-nfl",
] as const);
export type FieldPresetId = (typeof FIELD_PRESET_IDS)[number];

export interface DrillMetadata {
  readonly title: string;
  readonly createdAt: string;
  readonly drillWriter?: string;
  readonly ensemble?: string;
  readonly description?: string;
  readonly lucideIcon?: string;
}

export interface MeasureRange {
  readonly start: number;
  readonly end: number;
}

export interface DrillSet {
  readonly id: number;
  readonly number: number;
  readonly suffix?: string;
  readonly kind: SetKind;
  readonly countsFromPrevious: number;
  readonly measureRange?: MeasureRange;
}

export interface EntityAppearance {
  readonly icon?: EntityIcon;
  readonly color?: string;
  readonly labelVisible?: boolean;
}

export interface DrillEntity {
  readonly id: number;
  readonly type: DrillEntityType;
  readonly symbol: string;
  readonly label: string;
  readonly name?: string;
  readonly section?: string;
  readonly instrument?: string;
  readonly size?: PropSize;
  readonly appearance?: EntityAppearance;
}

export interface EntityRuleValues {
  readonly type?: DrillEntityType;
  readonly name?: string;
  readonly section?: string;
  readonly instrument?: string;
  readonly size?: PropSize;
  readonly appearance?: EntityAppearance;
}

export interface EntityRules {
  readonly bySymbol?: Readonly<Record<string, EntityRuleValues>>;
  readonly byLabel?: Readonly<Record<string, EntityRuleValues>>;
  readonly byId?: Readonly<Record<string, EntityRuleValues>>;
}

export interface DrillGridPoint {
  readonly xSteps: number;
  readonly ySteps: number;
}

export interface PhysicalFieldPoint {
  readonly xMeters: number;
  readonly yMeters: number;
}

export interface DrillPosition extends DrillGridPoint {
  readonly entityId: number;
  readonly setId: number;
  /** Omission is semantically identical to 0 degrees (front sideline). */
  readonly facingDegrees?: number;
}

export interface StraightDrillPath {
  readonly entityId: number;
  readonly fromSetId: number;
  readonly toSetId: number;
  readonly kind: "straight";
}

export interface PolylineDrillPath {
  readonly entityId: number;
  readonly fromSetId: number;
  readonly toSetId: number;
  readonly kind: "polyline";
  readonly waypoints: readonly DrillGridPoint[];
}

export interface BezierDrillPath {
  readonly entityId: number;
  readonly fromSetId: number;
  readonly toSetId: number;
  readonly kind: "bezier";
  readonly controlPoints: readonly [DrillGridPoint, DrillGridPoint];
}

export type DrillPath =
  | StraightDrillPath
  | PolylineDrillPath
  | BezierDrillPath;

export interface PhysicalFieldBounds {
  readonly minXMeters: number;
  readonly maxXMeters: number;
  readonly minYMeters: number;
  readonly maxYMeters: number;
}

export interface MarchingGridBounds {
  readonly minXSteps: number;
  readonly maxXSteps: number;
  readonly minYSteps: number;
  readonly maxYSteps: number;
}

export interface PhysicalReferenceLine {
  readonly id: string;
  readonly name: string;
  readonly axis: "x" | "y";
  readonly coordinateMeters: number;
}

export interface MarchingReferenceLine {
  readonly id: string;
  readonly name: string;
  readonly axis: "x" | "y";
  readonly coordinateSteps: number;
}

export interface PhysicalFieldGeometry {
  readonly bounds: PhysicalFieldBounds;
  readonly referenceLines: readonly PhysicalReferenceLine[];
}

export interface MarchingGrid {
  readonly bounds: MarchingGridBounds;
  readonly referenceLines: readonly MarchingReferenceLine[];
}

/** Physical football-marking dimensions consumed by field renderers. */
export interface FieldMarkingDefinition {
  readonly yardNumbers: {
    readonly heightMeters: number;
    readonly nominalWidthMeters: number;
    readonly centerFromFrontSidelineMeters: number;
    readonly centerFromBackSidelineMeters: number;
  };
  readonly inboundsHashMarks: {
    readonly lengthMeters: number;
    readonly spacingMeters: number;
  };
  readonly sidelineHashMarks: {
    readonly lengthMeters: number;
    readonly spacingMeters: number;
    /** Clear distance from the inside edge of the sideline to each mark. */
    readonly insetFromSidelineMeters: number;
  };
}

export interface PresetFieldDefinition {
  readonly type: "preset";
  readonly preset: FieldPresetId;
}

export interface CustomFieldDefinition {
  readonly type: "custom";
  readonly name: string;
  readonly physicalGeometry: PhysicalFieldGeometry;
  readonly marchingGrid: MarchingGrid;
  readonly markings: FieldMarkingDefinition;
}

export type FieldDefinition = PresetFieldDefinition | CustomFieldDefinition;

export interface ResolvedFieldDefinition {
  readonly id: FieldPresetId | "custom";
  readonly name: string;
  readonly physicalGeometry: PhysicalFieldGeometry;
  readonly marchingGrid: MarchingGrid;
  readonly markings: FieldMarkingDefinition;
}

export type SourceReferenceTarget =
  | {
      readonly type: "set";
      readonly setId: number;
    }
  | {
      readonly type: "entity";
      readonly entityId: number;
    }
  | {
      readonly type: "position";
      readonly entityId: number;
      readonly setId: number;
    };

export interface SourceReference {
  readonly target: SourceReferenceTarget;
  readonly page?: number;
  readonly rawText?: string;
}

export interface DrillProvenance {
  readonly source?: {
    readonly kind: string;
    readonly fileName?: string;
  };
  readonly importer?: {
    readonly name: string;
    readonly version: string;
  };
  readonly importedAt?: string;
  readonly references?: readonly SourceReference[];
}

export interface DrillDocument {
  readonly schema: typeof DRILL_SCHEMA_URL;
  readonly schemaVersion: typeof DRILL_SCHEMA_VERSION;
  readonly metadata: DrillMetadata;
  readonly field: FieldDefinition;
  readonly entityRules?: EntityRules;
  readonly entities: readonly DrillEntity[];
  readonly sets: readonly DrillSet[];
  readonly positions: readonly DrillPosition[];
  readonly paths?: readonly DrillPath[];
  readonly provenance?: DrillProvenance;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface ResolvedEntityAppearance {
  readonly icon: EntityIcon;
  readonly color: string;
  readonly labelVisible: boolean;
}

export interface ResolvedDrillEntity extends Omit<DrillEntity, "appearance"> {
  readonly section?: string;
  readonly instrument?: string;
  readonly appearance: ResolvedEntityAppearance;
}
