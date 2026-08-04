import {
  drillGridToPhysicalPoint,
  physicalPointToDrillGrid,
} from "@eight2five/drill-schema";

import {
  STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
  type StandardFootballFieldTemplate,
} from "../template";
import { feetToMeters, yardsToMeters } from "../units";

const GRID_PADDING_YARDS = 10;
const HASH_MARK_SPACING_METERS = yardsToMeters(1);
const HASH_MARK_LENGTH_METERS = feetToMeters(2);
const PATH_NUMBER_PRECISION = 1_000_000;
const COORDINATE_EPSILON = 1e-9;
const FOUR_STEP_INTERVAL = 4;

export interface FieldPathExtent {
  readonly minXMeters: number;
  readonly maxXMeters: number;
  readonly minYMeters: number;
  readonly maxYMeters: number;
}

export interface MarchingGridPathMetadata {
  readonly spacingSteps: 1;
  readonly verticalLineCount: number;
  readonly horizontalLineCount: number;
}

export interface PerimeterMarchingGridPathMetadata extends MarchingGridPathMetadata {
  readonly clippedByFieldBackground: true;
}

export interface FourStepGridPathMetadata {
  readonly spacingSteps: 4;
  readonly verticalSubdivisionCount: number;
  readonly horizontalSubdivisionCount: number;
  readonly segmentCount: number;
  readonly clippedToField: true;
}

export interface YardLinesPathMetadata {
  readonly lineCount: number;
}

export interface HashMarksPathMetadata {
  readonly spacingMeters: number;
  readonly tickLengthMeters: number;
  readonly rowCount: 2;
  readonly ticksPerRow: number;
  readonly tickCount: number;
}

export interface BoundaryPathMetadata {
  readonly segmentCount: 1;
}

export interface FieldPathCounts {
  readonly stepGrid: MarchingGridPathMetadata;
  readonly perimeterStepGrid: PerimeterMarchingGridPathMetadata;
  readonly fourStepGrid: FourStepGridPathMetadata;
  readonly yardLines: YardLinesPathMetadata;
  readonly hashMarks: HashMarksPathMetadata;
  readonly boundary: BoundaryPathMetadata;
}

/** Immutable world-space geometry projected from the active marching field. */
export interface FieldPaths {
  /** One marching-grid step, clipped to the physical field. */
  readonly stepGridPath: string;
  /** One marching-grid step across the 10-yard camera perimeter. */
  readonly perimeterStepGridPath: string;
  /** Four marching-grid steps, clipped to the physical field. */
  readonly fourStepGridPath: string;
  readonly yardLinesPath: string;
  readonly hashMarksPath: string;
  readonly boundaryPath: string;
  readonly fieldExtent: FieldPathExtent;
  readonly gridExtent: FieldPathExtent;
  readonly stepGridSpacingSteps: 1;
  readonly fourStepGridSpacingSteps: 4;
  readonly extents: {
    readonly field: FieldPathExtent;
    readonly grid: FieldPathExtent;
  };
  readonly counts: FieldPathCounts;

  readonly stepGrid: string;
  readonly perimeterStepGrid: string;
  readonly fourStepGrid: string;
  readonly yardLines: string;
  readonly hashMarks: string;
  readonly boundary: string;
}

const PATH_CACHE = new WeakMap<StandardFootballFieldTemplate, FieldPaths>();

/**
 * Project the active drill schema's marching grid onto the exact physical
 * football geometry. Grid steps are abstract drill coordinates; they are not
 * assumed to equal 22.5 physical inches on both axes.
 */
export function createFieldPaths(
  template: StandardFootballFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
): FieldPaths {
  const cached = PATH_CACHE.get(template);
  if (cached) return cached;

  const fieldExtent = freezeExtent({
    minXMeters: template.bounds.minXMeters,
    maxXMeters: template.bounds.maxXMeters,
    minYMeters: template.bounds.minYMeters,
    maxYMeters: template.bounds.maxYMeters,
  });
  const gridPaddingMeters = yardsToMeters(GRID_PADDING_YARDS);
  const gridExtent = freezeExtent({
    minXMeters: fieldExtent.minXMeters - gridPaddingMeters,
    maxXMeters: fieldExtent.maxXMeters + gridPaddingMeters,
    minYMeters: fieldExtent.minYMeters - gridPaddingMeters,
    maxYMeters: fieldExtent.maxYMeters + gridPaddingMeters,
  });

  const marchingBounds = template.fieldDefinition.marchingGrid.bounds;
  const stepGridXSteps = integerCoordinates(
    marchingBounds.minXSteps,
    marchingBounds.maxXSteps,
  );
  const stepGridYSteps = integerCoordinates(
    marchingBounds.minYSteps,
    marchingBounds.maxYSteps,
  );
  const stepGridPath = gridPathFromSteps(
    template,
    stepGridXSteps,
    stepGridYSteps,
    fieldExtent,
  );

  const perimeterGridBounds = physicalExtentToGridBounds(template, gridExtent);
  const perimeterXSteps = integerCoordinates(
    Math.floor(perimeterGridBounds.minXSteps),
    Math.ceil(perimeterGridBounds.maxXSteps),
  );
  const perimeterYSteps = integerCoordinates(
    Math.floor(perimeterGridBounds.minYSteps),
    Math.ceil(perimeterGridBounds.maxYSteps),
  );
  const perimeterStepGridPath = gridPathFromSteps(
    template,
    perimeterXSteps,
    perimeterYSteps,
    gridExtent,
  );

  const fourStepXSteps = stepIntervalCoordinates(
    marchingBounds.minXSteps,
    marchingBounds.maxXSteps,
    FOUR_STEP_INTERVAL,
  );
  const fourStepYSteps = stepIntervalCoordinates(
    marchingBounds.minYSteps,
    marchingBounds.maxYSteps,
    FOUR_STEP_INTERVAL,
  );
  const fourStepGridPath = gridPathFromSteps(
    template,
    fourStepXSteps,
    fourStepYSteps,
    fieldExtent,
  );

  const yardLinesPath = template.yardLines
    .map((line) =>
      verticalSegment(
        line.coordinateMeters,
        fieldExtent.minYMeters,
        fieldExtent.maxYMeters,
      ),
    )
    .join(" ");

  const hashYCoordinates = [
    template.frontHashLine.coordinateMeters,
    template.backHashLine.coordinateMeters,
  ] as const;
  const hashMarks: string[] = [];
  const ticksPerRow = Math.max(0, Math.ceil(template.goalToGoalYards) - 1);
  for (const yMeters of hashYCoordinates) {
    for (let yard = 1; yard < template.goalToGoalYards; yard += 1) {
      const xMeters = fieldExtent.minXMeters + yard * HASH_MARK_SPACING_METERS;
      hashMarks.push(
        verticalSegment(
          xMeters,
          yMeters - HASH_MARK_LENGTH_METERS / 2,
          yMeters + HASH_MARK_LENGTH_METERS / 2,
        ),
      );
    }
  }
  const hashMarksPath = hashMarks.join(" ");

  const boundaryPath = rectanglePath(fieldExtent);
  const extents = Object.freeze({ field: fieldExtent, grid: gridExtent });
  const counts: FieldPathCounts = Object.freeze({
    stepGrid: Object.freeze({
      spacingSteps: 1,
      verticalLineCount: stepGridXSteps.length,
      horizontalLineCount: stepGridYSteps.length,
    }),
    perimeterStepGrid: Object.freeze({
      spacingSteps: 1,
      verticalLineCount: perimeterXSteps.length,
      horizontalLineCount: perimeterYSteps.length,
      clippedByFieldBackground: true,
    }),
    fourStepGrid: Object.freeze({
      spacingSteps: 4,
      verticalSubdivisionCount: fourStepXSteps.length,
      horizontalSubdivisionCount: fourStepYSteps.length,
      segmentCount: fourStepXSteps.length + fourStepYSteps.length,
      clippedToField: true,
    }),
    yardLines: Object.freeze({ lineCount: template.yardLines.length }),
    hashMarks: Object.freeze({
      spacingMeters: HASH_MARK_SPACING_METERS,
      tickLengthMeters: HASH_MARK_LENGTH_METERS,
      rowCount: 2,
      ticksPerRow,
      tickCount: hashMarks.length,
    }),
    boundary: Object.freeze({ segmentCount: 1 }),
  });

  const paths: FieldPaths = Object.freeze({
    stepGridPath,
    perimeterStepGridPath,
    fourStepGridPath,
    yardLinesPath,
    hashMarksPath,
    boundaryPath,
    fieldExtent,
    gridExtent,
    stepGridSpacingSteps: 1,
    fourStepGridSpacingSteps: 4,
    extents,
    counts,
    stepGrid: stepGridPath,
    perimeterStepGrid: perimeterStepGridPath,
    fourStepGrid: fourStepGridPath,
    yardLines: yardLinesPath,
    hashMarks: hashMarksPath,
    boundary: boundaryPath,
  });
  PATH_CACHE.set(template, paths);
  return paths;
}

export const buildFieldPaths = createFieldPaths;

function gridPathFromSteps(
  template: StandardFootballFieldTemplate,
  xSteps: readonly number[],
  ySteps: readonly number[],
  extent: FieldPathExtent,
): string {
  return [
    ...xSteps.map((step) =>
      verticalSegment(
        projectXStep(template, step),
        extent.minYMeters,
        extent.maxYMeters,
      ),
    ),
    ...ySteps.map((step) =>
      horizontalSegment(
        extent.minXMeters,
        projectYStep(template, step),
        extent.maxXMeters,
      ),
    ),
  ].join(" ");
}

function projectXStep(
  template: StandardFootballFieldTemplate,
  xSteps: number,
): number {
  return drillGridToPhysicalPoint(
    {
      xSteps,
      ySteps: template.fieldDefinition.marchingGrid.bounds.minYSteps,
    },
    template.fieldDefinition,
  ).xMeters;
}

function projectYStep(
  template: StandardFootballFieldTemplate,
  ySteps: number,
): number {
  return drillGridToPhysicalPoint(
    {
      xSteps: 0,
      ySteps,
    },
    template.fieldDefinition,
  ).yMeters;
}

function physicalExtentToGridBounds(
  template: StandardFootballFieldTemplate,
  extent: FieldPathExtent,
) {
  const field = template.fieldDefinition;
  const xMin = physicalPointToDrillGrid(
    { xMeters: extent.minXMeters, yMeters: template.bounds.minYMeters },
    field,
  ).xSteps;
  const xMax = physicalPointToDrillGrid(
    { xMeters: extent.maxXMeters, yMeters: template.bounds.minYMeters },
    field,
  ).xSteps;
  const yMin = physicalPointToDrillGrid(
    { xMeters: 0, yMeters: extent.minYMeters },
    field,
  ).ySteps;
  const yMax = physicalPointToDrillGrid(
    { xMeters: 0, yMeters: extent.maxYMeters },
    field,
  ).ySteps;
  return { minXSteps: xMin, maxXSteps: xMax, minYSteps: yMin, maxYSteps: yMax };
}

function integerCoordinates(
  minimum: number,
  maximum: number,
): readonly number[] {
  const start = Math.ceil(minimum - COORDINATE_EPSILON);
  const end = Math.floor(maximum + COORDINATE_EPSILON);
  const coordinates: number[] = [];
  for (let value = start; value <= end; value += 1) coordinates.push(value);
  return Object.freeze(coordinates);
}

function stepIntervalCoordinates(
  minimum: number,
  maximum: number,
  interval: number,
): readonly number[] {
  const coordinates: number[] = [];
  for (
    let value = minimum;
    value <= maximum + COORDINATE_EPSILON;
    value += interval
  ) {
    coordinates.push(value);
  }
  if (
    coordinates.length === 0 ||
    Math.abs(coordinates[coordinates.length - 1] - maximum) > COORDINATE_EPSILON
  ) {
    coordinates.push(maximum);
  }
  return Object.freeze(coordinates);
}

function freezeExtent(extent: FieldPathExtent): FieldPathExtent {
  return Object.freeze(extent);
}

function verticalSegment(
  xMeters: number,
  minYMeters: number,
  maxYMeters: number,
): string {
  return `M ${formatCoordinate(xMeters)} ${formatCoordinate(
    minYMeters,
  )} L ${formatCoordinate(xMeters)} ${formatCoordinate(maxYMeters)}`;
}

function horizontalSegment(
  minXMeters: number,
  yMeters: number,
  maxXMeters: number,
): string {
  return `M ${formatCoordinate(minXMeters)} ${formatCoordinate(
    yMeters,
  )} L ${formatCoordinate(maxXMeters)} ${formatCoordinate(yMeters)}`;
}

function rectanglePath(extent: FieldPathExtent): string {
  return `M ${formatCoordinate(extent.minXMeters)} ${formatCoordinate(
    extent.minYMeters,
  )} L ${formatCoordinate(extent.maxXMeters)} ${formatCoordinate(
    extent.minYMeters,
  )} L ${formatCoordinate(extent.maxXMeters)} ${formatCoordinate(
    extent.maxYMeters,
  )} L ${formatCoordinate(extent.minXMeters)} ${formatCoordinate(
    extent.maxYMeters,
  )} Z`;
}

function formatCoordinate(value: number): string {
  const rounded =
    Math.round(value * PATH_NUMBER_PRECISION) / PATH_NUMBER_PRECISION;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
