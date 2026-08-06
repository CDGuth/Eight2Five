import type {
  DrillDocument,
  DrillGridPoint,
  DrillPath,
} from "@eight2five/drill-schema";

/**
 * Grid coordinates are imported from external documents, so comparing their
 * object identity would make nearly-identical hold positions appear to move.
 */
export const DEFAULT_GRID_POINT_EPSILON_STEPS = 1e-6;

/** The default maximum error used while flattening a cubic Bézier in steps. */
export const DEFAULT_BEZIER_ARC_LENGTH_TOLERANCE_STEPS = 1e-4;

/** Prevents pathological documents from causing unbounded subdivision. */
export const DEFAULT_BEZIER_MAX_SUBDIVISION_DEPTH = 18;
export const MAX_BEZIER_SUBDIVISION_DEPTH = 24;

export interface TransitionGeometryOptions {
  /** Maximum flattening error, measured in drill-grid steps. */
  readonly tolerance?: number;
  /** Maximum recursive depth used by the deterministic cubic subdivision. */
  readonly maxSubdivisionDepth?: number;
}

export interface StraightTransitionGeometry {
  readonly kind: "straight";
  readonly start: DrillGridPoint;
  readonly end: DrillGridPoint;
}

export interface PolylineTransitionGeometry {
  readonly kind: "polyline";
  /** Includes the transition's start and end points. */
  readonly points: readonly DrillGridPoint[];
}

export interface BezierTransitionGeometry {
  readonly kind: "bezier";
  readonly start: DrillGridPoint;
  readonly controlPoints: readonly [DrillGridPoint, DrillGridPoint];
  readonly end: DrillGridPoint;
}

/**
 * Geometry is intentionally made only from serializable grid points. Phase 4
 * can use this same DTO to construct a Skia path and to place its midpoint.
 */
export type TransitionPathGeometry =
  | StraightTransitionGeometry
  | PolylineTransitionGeometry
  | BezierTransitionGeometry;

export interface ResolvedTransitionGeometry {
  readonly geometry: TransitionPathGeometry;
  readonly lengthSteps: number;
  readonly midpoint: DrillGridPoint;
  /** Only populated for cubic Bézier geometry. */
  readonly midpointParameter?: number;
}

/**
 * Compare grid points using coordinate tolerance rather than object equality.
 */
export function areGridPointsEquivalent(
  a: DrillGridPoint,
  b: DrillGridPoint,
  epsilon = DEFAULT_GRID_POINT_EPSILON_STEPS,
): boolean {
  assertEpsilon(epsilon);
  return (
    Math.abs(a.xSteps - b.xSteps) <= epsilon &&
    Math.abs(a.ySteps - b.ySteps) <= epsilon
  );
}

/** Evaluate a cubic Bézier at parameter t in [0, 1]. */
export function evaluateCubicBezier(
  start: DrillGridPoint,
  control1: DrillGridPoint,
  control2: DrillGridPoint,
  end: DrillGridPoint,
  t: number,
): DrillGridPoint {
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new RangeError("A cubic Bézier parameter must be between 0 and 1.");
  }

  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const tSquared = t * t;
  const startWeight = oneMinusTSquared * oneMinusT;
  const control1Weight = 3 * oneMinusTSquared * t;
  const control2Weight = 3 * oneMinusT * tSquared;
  const endWeight = tSquared * t;

  return {
    xSteps:
      start.xSteps * startWeight +
      control1.xSteps * control1Weight +
      control2.xSteps * control2Weight +
      end.xSteps * endWeight,
    ySteps:
      start.ySteps * startWeight +
      control1.ySteps * control1Weight +
      control2.ySteps * control2Weight +
      end.ySteps * endWeight,
  };
}

/** Alias with the noun-first spelling used by some geometry callers. */
export const cubicBezierPoint = evaluateCubicBezier;

/**
 * Approximate the arc length of a cubic Bézier using deterministic adaptive
 * subdivision. The result is in drill-grid steps.
 */
export function approximateCubicBezierLength(
  geometry: BezierTransitionGeometry,
  options: TransitionGeometryOptions = {},
): number {
  const subdivision = normalizeSubdivisionOptions(options);
  return buildBezierArcLengthLut(geometry, subdivision).lengthSteps;
}

/**
 * Resolve one entity transition from a complete document.
 *
 * A missing explicit path is deliberately represented as a straight segment;
 * endpoint positions still come from the document, so this fallback cannot
 * silently connect the wrong entity or set.
 */
export function resolveTransitionGeometry(
  document: DrillDocument,
  entityId: number,
  fromSetId: number,
  toSetId: number,
  options: TransitionGeometryOptions = {},
): ResolvedTransitionGeometry | undefined {
  const start = findPosition(document, entityId, fromSetId);
  const end = findPosition(document, entityId, toSetId);
  if (!start || !end) return undefined;

  const geometry = resolvePathWithEndpoints(
    document,
    entityId,
    fromSetId,
    toSetId,
    start,
    end,
  );
  return measureTransitionGeometry(geometry, options);
}

/**
 * Resolve only the path shape. Supplying endpoint positions separately keeps
 * this helper useful to the scene builder without making path data authoritative
 * over the position table.
 */
export function resolveTransitionPath(
  document: DrillDocument,
  entityId: number,
  fromSetId: number,
  toSetId: number,
): TransitionPathGeometry | undefined {
  const start = findPosition(document, entityId, fromSetId);
  const end = findPosition(document, entityId, toSetId);
  if (!start || !end) return undefined;
  return resolvePathWithEndpoints(
    document,
    entityId,
    fromSetId,
    toSetId,
    start,
    end,
  );
}

/** Calculate length and the true half-arc-length point for already-resolved geometry. */
export function measureTransitionGeometry(
  geometry: TransitionPathGeometry,
  options: TransitionGeometryOptions = {},
): ResolvedTransitionGeometry {
  switch (geometry.kind) {
    case "straight": {
      const lengthSteps = distanceBetween(geometry.start, geometry.end);
      return {
        geometry,
        lengthSteps,
        midpoint: interpolatePoint(geometry.start, geometry.end, 0.5),
      };
    }
    case "polyline": {
      const measured = measurePolyline(geometry.points);
      return {
        geometry,
        lengthSteps: measured.lengthSteps,
        midpoint: measured.midpoint,
      };
    }
    case "bezier": {
      const subdivision = normalizeSubdivisionOptions(options);
      const lut = buildBezierArcLengthLut(geometry, subdivision);
      const midpointResult = locateBezierArcLengthPoint(geometry, lut);
      return {
        geometry,
        lengthSteps: lut.lengthSteps,
        midpoint: midpointResult.point,
        midpointParameter: midpointResult.parameter,
      };
    }
  }
}

interface NormalizedSubdivisionOptions {
  readonly tolerance: number;
  readonly maxSubdivisionDepth: number;
}

interface BezierArcLengthLutNode {
  readonly parameter: number;
  readonly point: DrillGridPoint;
  readonly cumulativeLengthSteps: number;
}

interface BezierArcLengthLut {
  readonly nodes: readonly BezierArcLengthLutNode[];
  readonly lengthSteps: number;
}

function resolvePathWithEndpoints(
  document: DrillDocument,
  entityId: number,
  fromSetId: number,
  toSetId: number,
  start: DrillGridPoint,
  end: DrillGridPoint,
): TransitionPathGeometry {
  const explicitPath = document.paths?.find(
    (path) =>
      path.entityId === entityId &&
      path.fromSetId === fromSetId &&
      path.toSetId === toSetId,
  );

  return pathToGeometry(explicitPath, start, end);
}

function pathToGeometry(
  path: DrillPath | undefined,
  start: DrillGridPoint,
  end: DrillGridPoint,
): TransitionPathGeometry {
  if (!path || path.kind === "straight") {
    return {
      kind: "straight",
      start: clonePoint(start),
      end: clonePoint(end),
    };
  }

  if (path.kind === "polyline") {
    return {
      kind: "polyline",
      points: [
        clonePoint(start),
        ...path.waypoints.map(clonePoint),
        clonePoint(end),
      ],
    };
  }

  return {
    kind: "bezier",
    start: clonePoint(start),
    controlPoints: [
      clonePoint(path.controlPoints[0]),
      clonePoint(path.controlPoints[1]),
    ],
    end: clonePoint(end),
  };
}

function findPosition(
  document: DrillDocument,
  entityId: number,
  setId: number,
): DrillGridPoint | undefined {
  const position = document.positions.find(
    (candidate) => candidate.entityId === entityId && candidate.setId === setId,
  );
  return position ? clonePoint(position) : undefined;
}

function measurePolyline(points: readonly DrillGridPoint[]): {
  readonly lengthSteps: number;
  readonly midpoint: DrillGridPoint;
} {
  if (points.length === 0) {
    throw new RangeError("A polyline must contain at least one point.");
  }
  if (points.length === 1) {
    return { lengthSteps: 0, midpoint: clonePoint(points[0]) };
  }

  const segmentLengths = points
    .slice(1)
    .map((point, index) => distanceBetween(points[index], point));
  const lengthSteps = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (lengthSteps === 0) {
    return { lengthSteps, midpoint: clonePoint(points[0]) };
  }

  const targetDistance = lengthSteps / 2;
  let distanceBeforeSegment = 0;
  for (const [index, segmentLength] of segmentLengths.entries()) {
    const distanceAtSegmentEnd = distanceBeforeSegment + segmentLength;
    if (
      targetDistance <= distanceAtSegmentEnd ||
      index === segmentLengths.length - 1
    ) {
      const ratio =
        segmentLength === 0
          ? 0
          : (targetDistance - distanceBeforeSegment) / segmentLength;
      return {
        lengthSteps,
        midpoint: interpolatePoint(points[index], points[index + 1], ratio),
      };
    }
    distanceBeforeSegment = distanceAtSegmentEnd;
  }

  // The loop always returns for a finite, non-empty segment list.
  return { lengthSteps, midpoint: clonePoint(points[points.length - 1]) };
}

function buildBezierArcLengthLut(
  geometry: BezierTransitionGeometry,
  options: NormalizedSubdivisionOptions,
): BezierArcLengthLut {
  const nodes: { parameter: number; point: DrillGridPoint }[] = [
    { parameter: 0, point: clonePoint(geometry.start) },
  ];
  const [control1, control2] = geometry.controlPoints;

  subdivideBezier(
    geometry.start,
    control1,
    control2,
    geometry.end,
    0,
    1,
    0,
    options,
    nodes,
  );

  let cumulativeLengthSteps = 0;
  const measuredNodes: BezierArcLengthLutNode[] = [
    {
      parameter: nodes[0].parameter,
      point: nodes[0].point,
      cumulativeLengthSteps: 0,
    },
  ];
  for (const node of nodes.slice(1)) {
    cumulativeLengthSteps += distanceBetween(
      measuredNodes[measuredNodes.length - 1].point,
      node.point,
    );
    measuredNodes.push({
      parameter: node.parameter,
      point: node.point,
      cumulativeLengthSteps,
    });
  }

  return { nodes: measuredNodes, lengthSteps: cumulativeLengthSteps };
}

function subdivideBezier(
  start: DrillGridPoint,
  control1: DrillGridPoint,
  control2: DrillGridPoint,
  end: DrillGridPoint,
  startParameter: number,
  endParameter: number,
  depth: number,
  options: NormalizedSubdivisionOptions,
  nodes: { parameter: number; point: DrillGridPoint }[],
): void {
  const chordLength = distanceBetween(start, end);
  const controlPolygonLength =
    distanceBetween(start, control1) +
    distanceBetween(control1, control2) +
    distanceBetween(control2, end);
  const flatness = Math.max(0, controlPolygonLength - chordLength);

  if (depth >= options.maxSubdivisionDepth || flatness <= options.tolerance) {
    nodes.push({ parameter: endParameter, point: clonePoint(end) });
    return;
  }

  const firstMidpoint = interpolatePoint(start, control1, 0.5);
  const secondMidpoint = interpolatePoint(control1, control2, 0.5);
  const thirdMidpoint = interpolatePoint(control2, end, 0.5);
  const leftMidpoint = interpolatePoint(firstMidpoint, secondMidpoint, 0.5);
  const rightMidpoint = interpolatePoint(secondMidpoint, thirdMidpoint, 0.5);
  const curveMidpoint = interpolatePoint(leftMidpoint, rightMidpoint, 0.5);
  const parameterMidpoint = (startParameter + endParameter) / 2;

  subdivideBezier(
    start,
    firstMidpoint,
    leftMidpoint,
    curveMidpoint,
    startParameter,
    parameterMidpoint,
    depth + 1,
    options,
    nodes,
  );
  subdivideBezier(
    curveMidpoint,
    rightMidpoint,
    thirdMidpoint,
    end,
    parameterMidpoint,
    endParameter,
    depth + 1,
    options,
    nodes,
  );
}

function locateBezierArcLengthPoint(
  geometry: BezierTransitionGeometry,
  lut: BezierArcLengthLut,
): { readonly point: DrillGridPoint; readonly parameter: number } {
  if (lut.lengthSteps === 0) {
    return { point: clonePoint(geometry.start), parameter: 0 };
  }

  const targetDistance = lut.lengthSteps / 2;
  let segmentIndex = lut.nodes.length - 2;
  for (let index = 0; index < lut.nodes.length - 1; index += 1) {
    if (
      targetDistance <= lut.nodes[index + 1].cumulativeLengthSteps ||
      index === lut.nodes.length - 2
    ) {
      segmentIndex = index;
      break;
    }
  }

  const segmentStart = lut.nodes[segmentIndex];
  const segmentEnd = lut.nodes[segmentIndex + 1];
  const segmentLength =
    segmentEnd.cumulativeLengthSteps - segmentStart.cumulativeLengthSteps;
  if (segmentLength === 0) {
    return {
      point: clonePoint(segmentStart.point),
      parameter: segmentStart.parameter,
    };
  }

  // The LUT's cumulative distances are sums of flattened chord lengths. Use
  // that exact same metric for inversion, including deliberately coarse LUTs.
  const targetWithinSegment =
    targetDistance - segmentStart.cumulativeLengthSteps;
  const segmentRatio = targetWithinSegment / segmentLength;
  const parameter =
    segmentStart.parameter +
    (segmentEnd.parameter - segmentStart.parameter) * segmentRatio;
  return {
    point: evaluateCubicGeometryAt(geometry, parameter),
    parameter,
  };
}

function evaluateCubicGeometryAt(
  geometry: BezierTransitionGeometry,
  parameter: number,
): DrillGridPoint {
  return evaluateCubicBezier(
    geometry.start,
    geometry.controlPoints[0],
    geometry.controlPoints[1],
    geometry.end,
    parameter,
  );
}

function normalizeSubdivisionOptions(
  options: TransitionGeometryOptions,
): NormalizedSubdivisionOptions {
  const tolerance =
    options.tolerance ?? DEFAULT_BEZIER_ARC_LENGTH_TOLERANCE_STEPS;
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new RangeError(
      "Bézier arc-length tolerance must be greater than zero.",
    );
  }

  const maxSubdivisionDepth =
    options.maxSubdivisionDepth ?? DEFAULT_BEZIER_MAX_SUBDIVISION_DEPTH;
  if (
    !Number.isInteger(maxSubdivisionDepth) ||
    maxSubdivisionDepth < 0 ||
    maxSubdivisionDepth > MAX_BEZIER_SUBDIVISION_DEPTH
  ) {
    throw new RangeError(
      `Bézier subdivision depth must be an integer from 0 to ${MAX_BEZIER_SUBDIVISION_DEPTH}.`,
    );
  }

  return { tolerance, maxSubdivisionDepth };
}

function assertEpsilon(epsilon: number): void {
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new RangeError(
      "Grid-point epsilon must be a finite non-negative number.",
    );
  }
}

function clonePoint(point: DrillGridPoint): DrillGridPoint {
  return { xSteps: point.xSteps, ySteps: point.ySteps };
}

function distanceBetween(a: DrillGridPoint, b: DrillGridPoint): number {
  return Math.hypot(b.xSteps - a.xSteps, b.ySteps - a.ySteps);
}

function interpolatePoint(
  start: DrillGridPoint,
  end: DrillGridPoint,
  ratio: number,
): DrillGridPoint {
  return {
    xSteps: start.xSteps + (end.xSteps - start.xSteps) * ratio,
    ySteps: start.ySteps + (end.ySteps - start.ySteps) * ratio,
  };
}
