import { STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE } from "../template";
import type { StandardHighSchoolFieldTemplate } from "../template";
import { feetToMeters, STANDARD_STEP_METERS, yardsToMeters } from "../units";

const GRID_PADDING_YARDS = 10;
const FIVE_YARD_GRID_SPACING_METERS = yardsToMeters(5);
const HASH_MARK_SPACING_METERS = yardsToMeters(1);
const HASH_MARK_LENGTH_METERS = feetToMeters(2);
const PATH_NUMBER_PRECISION = 1_000_000;
const COORDINATE_EPSILON = 1e-9;

export interface FieldPathExtent {
  readonly minXMeters: number;
  readonly maxXMeters: number;
  readonly minYMeters: number;
  readonly maxYMeters: number;
}

export interface StepGridPathMetadata {
  readonly spacingMeters: typeof STANDARD_STEP_METERS;
  readonly verticalLineCount: number;
  readonly horizontalLineCount: number;
}

export interface FiveYardGridPathMetadata {
  readonly spacingMeters: number;
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
  readonly stepGrid: StepGridPathMetadata;
  readonly fiveYardGrid: FiveYardGridPathMetadata;
  readonly yardLines: YardLinesPathMetadata;
  readonly hashMarks: HashMarksPathMetadata;
  readonly boundary: BoundaryPathMetadata;
}

/**
 * The immutable, world-space SVG geometry consumed by field renderers.
 *
 * Each path is a single aggregate string rather than a collection of line
 * components. Coordinates stay in the field's canonical meter coordinate
 * system: X runs from Side 1 to Side 2 and Y runs from the front sideline to
 * the back sideline.
 */
export interface FieldPaths {
  readonly stepGridPath: string;
  readonly fiveYardGridPath: string;
  readonly yardLinesPath: string;
  readonly hashMarksPath: string;
  readonly boundaryPath: string;
  readonly fieldExtent: FieldPathExtent;
  readonly gridExtent: FieldPathExtent;
  readonly stepGridSpacingMeters: typeof STANDARD_STEP_METERS;
  readonly extents: {
    readonly field: FieldPathExtent;
    readonly grid: FieldPathExtent;
  };
  readonly counts: FieldPathCounts;

  /** Short aliases keep the path set convenient for drawing callers. */
  readonly stepGrid: string;
  readonly fiveYardGrid: string;
  readonly yardLines: string;
  readonly hashMarks: string;
  readonly boundary: string;
}

const PATH_CACHE = new WeakMap<StandardHighSchoolFieldTemplate, FieldPaths>();

/**
 * Builds all static field geometry in one pass and memoizes it by template.
 * The standard template is deeply immutable, so identity-based memoization is
 * sufficient and avoids rebuilding hundreds of path segments on every render.
 */
export function createFieldPaths(
  template: StandardHighSchoolFieldTemplate = STANDARD_HIGH_SCHOOL_FIELD_TEMPLATE,
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

  const stepGridXCoordinates = coordinatesAtInterval(
    gridExtent.minXMeters,
    gridExtent.maxXMeters,
    STANDARD_STEP_METERS,
  );
  const stepGridYCoordinates = coordinatesAtInterval(
    gridExtent.minYMeters,
    gridExtent.maxYMeters,
    STANDARD_STEP_METERS,
  );
  const stepGridPath = [
    ...stepGridXCoordinates.map((xMeters) =>
      verticalSegment(xMeters, gridExtent.minYMeters, gridExtent.maxYMeters),
    ),
    ...stepGridYCoordinates.map((yMeters) =>
      horizontalSegment(gridExtent.minXMeters, yMeters, gridExtent.maxXMeters),
    ),
  ].join(" ");

  const fiveYardXCoordinates = template.allFiveYardLines.map(
    (line) => line.coordinateMeters,
  );
  const fiveYardYCoordinates = coordinatesAtInterval(
    fieldExtent.minYMeters,
    fieldExtent.maxYMeters,
    FIVE_YARD_GRID_SPACING_METERS,
  );
  const fiveYardGridPath = [
    ...fiveYardXCoordinates.map((xMeters) =>
      verticalSegment(xMeters, fieldExtent.minYMeters, fieldExtent.maxYMeters),
    ),
    ...fiveYardYCoordinates.map((yMeters) =>
      horizontalSegment(
        fieldExtent.minXMeters,
        yMeters,
        fieldExtent.maxXMeters,
      ),
    ),
  ].join(" ");

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
  const hashMarks = [] as string[];
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
      spacingMeters: STANDARD_STEP_METERS,
      verticalLineCount: stepGridXCoordinates.length,
      horizontalLineCount: stepGridYCoordinates.length,
    }),
    fiveYardGrid: Object.freeze({
      spacingMeters: FIVE_YARD_GRID_SPACING_METERS,
      verticalSubdivisionCount: fiveYardXCoordinates.length,
      horizontalSubdivisionCount: fiveYardYCoordinates.length,
      segmentCount: fiveYardXCoordinates.length + fiveYardYCoordinates.length,
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
    fiveYardGridPath,
    yardLinesPath,
    hashMarksPath,
    boundaryPath,
    fieldExtent,
    gridExtent,
    stepGridSpacingMeters: STANDARD_STEP_METERS,
    extents,
    counts,
    stepGrid: stepGridPath,
    fiveYardGrid: fiveYardGridPath,
    yardLines: yardLinesPath,
    hashMarks: hashMarksPath,
    boundary: boundaryPath,
  });
  PATH_CACHE.set(template, paths);
  return paths;
}

/** Alias for callers that describe the operation as building geometry. */
export const buildFieldPaths = createFieldPaths;

function freezeExtent(extent: FieldPathExtent): FieldPathExtent {
  return Object.freeze(extent);
}

function coordinatesAtInterval(
  minimum: number,
  maximum: number,
  interval: number,
): readonly number[] {
  const coordinates: number[] = [];
  const intervalCount = Math.floor(
    (maximum - minimum) / interval + COORDINATE_EPSILON,
  );
  for (let index = 0; index <= intervalCount; index += 1) {
    coordinates.push(minimum + index * interval);
  }

  return Object.freeze(coordinates);
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
