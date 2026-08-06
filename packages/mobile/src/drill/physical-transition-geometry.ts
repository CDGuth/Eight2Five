import type {
  PhysicalBezierTransitionGeometry,
  PhysicalImmediateTransition,
  PhysicalTransitionPathGeometry,
} from "./render-scene";
import type { PhysicalFieldPoint } from "@eight2five/drill-schema";
import {
  DEFAULT_BEZIER_ARC_LENGTH_TOLERANCE_STEPS,
  DEFAULT_BEZIER_MAX_SUBDIVISION_DEPTH,
  MAX_BEZIER_SUBDIVISION_DEPTH,
  type TransitionGeometryOptions,
} from "./transition-geometry";
import { STANDARD_STEP_METERS } from "../field/units";

/** Measured geometry in the same physical coordinate space sent to Skia. */
export interface MeasuredPhysicalTransitionGeometry {
  readonly geometry: PhysicalTransitionPathGeometry;
  readonly lengthMeters: number;
  readonly midpoint: PhysicalFieldPoint;
  readonly midpointParameter?: number;
}

/**
 * Measure the projected geometry, rather than projecting a midpoint measured in
 * grid coordinates. This matters for custom fields whose X/Y scales are not
 * uniform: the connector and midpoint must use one physical path metric.
 */
export function measurePhysicalTransitionGeometry(
  geometry: PhysicalTransitionPathGeometry,
  options: TransitionGeometryOptions = {},
): MeasuredPhysicalTransitionGeometry {
  switch (geometry.kind) {
    case "straight": {
      const lengthMeters = physicalDistance(geometry.start, geometry.end);
      return {
        geometry,
        lengthMeters,
        midpoint: interpolatePhysicalPoint(geometry.start, geometry.end, 0.5),
      };
    }
    case "polyline": {
      const measured = measurePhysicalPolyline(geometry.points);
      return {
        geometry,
        lengthMeters: measured.lengthMeters,
        midpoint: measured.midpoint,
      };
    }
    case "bezier": {
      const lut = buildPhysicalBezierArcLengthLut(
        geometry,
        normalizePhysicalBezierOptions(options),
      );
      const midpoint = locatePhysicalBezierArcLengthPoint(geometry, lut);
      return {
        geometry,
        lengthMeters: lut.lengthMeters,
        midpoint: midpoint.point,
        midpointParameter: midpoint.parameter,
      };
    }
  }
}

/** Keep Phase 3's semantic grid length while replacing only projected geometry. */
export function withPhysicalTransitionMidpoint(
  transition: Omit<
    PhysicalImmediateTransition,
    "midpoint" | "midpointParameter"
  >,
  geometry: PhysicalTransitionPathGeometry,
  options: TransitionGeometryOptions = {},
): PhysicalImmediateTransition {
  const measured = measurePhysicalTransitionGeometry(geometry, options);
  return Object.freeze({
    ...transition,
    geometry: measured.geometry,
    midpoint: measured.midpoint,
    ...(measured.midpointParameter === undefined
      ? {}
      : { midpointParameter: measured.midpointParameter }),
  });
}

interface NormalizedPhysicalBezierOptions {
  readonly toleranceMeters: number;
  readonly maxSubdivisionDepth: number;
}

interface PhysicalBezierArcLengthLutNode {
  readonly parameter: number;
  readonly point: PhysicalFieldPoint;
  readonly cumulativeLengthMeters: number;
}

interface PhysicalBezierArcLengthLut {
  readonly nodes: readonly PhysicalBezierArcLengthLutNode[];
  readonly lengthMeters: number;
}

function measurePhysicalPolyline(points: readonly PhysicalFieldPoint[]): {
  readonly lengthMeters: number;
  readonly midpoint: PhysicalFieldPoint;
} {
  if (points.length === 0) {
    throw new RangeError("A polyline must contain at least one point.");
  }
  if (points.length === 1) {
    return { lengthMeters: 0, midpoint: clonePhysicalPoint(points[0]) };
  }

  const segmentLengths = points
    .slice(1)
    .map((point, index) => physicalDistance(points[index], point));
  const lengthMeters = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (lengthMeters === 0) {
    return { lengthMeters, midpoint: clonePhysicalPoint(points[0]) };
  }

  const targetDistance = lengthMeters / 2;
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
        lengthMeters,
        midpoint: interpolatePhysicalPoint(
          points[index],
          points[index + 1],
          ratio,
        ),
      };
    }
    distanceBeforeSegment = distanceAtSegmentEnd;
  }

  return {
    lengthMeters,
    midpoint: clonePhysicalPoint(points[points.length - 1]),
  };
}

function buildPhysicalBezierArcLengthLut(
  geometry: PhysicalBezierTransitionGeometry,
  options: NormalizedPhysicalBezierOptions,
): PhysicalBezierArcLengthLut {
  const nodes: { parameter: number; point: PhysicalFieldPoint }[] = [
    { parameter: 0, point: clonePhysicalPoint(geometry.start) },
  ];
  subdividePhysicalBezier(
    geometry.start,
    geometry.controlPoints[0],
    geometry.controlPoints[1],
    geometry.end,
    0,
    1,
    0,
    options,
    nodes,
  );

  let cumulativeLengthMeters = 0;
  const measuredNodes: PhysicalBezierArcLengthLutNode[] = [
    {
      parameter: nodes[0].parameter,
      point: nodes[0].point,
      cumulativeLengthMeters: 0,
    },
  ];
  for (const node of nodes.slice(1)) {
    cumulativeLengthMeters += physicalDistance(
      measuredNodes[measuredNodes.length - 1].point,
      node.point,
    );
    measuredNodes.push({
      parameter: node.parameter,
      point: node.point,
      cumulativeLengthMeters,
    });
  }
  return { nodes: measuredNodes, lengthMeters: cumulativeLengthMeters };
}

function subdividePhysicalBezier(
  start: PhysicalFieldPoint,
  control1: PhysicalFieldPoint,
  control2: PhysicalFieldPoint,
  end: PhysicalFieldPoint,
  startParameter: number,
  endParameter: number,
  depth: number,
  options: NormalizedPhysicalBezierOptions,
  nodes: { parameter: number; point: PhysicalFieldPoint }[],
): void {
  const chordLength = physicalDistance(start, end);
  const controlPolygonLength =
    physicalDistance(start, control1) +
    physicalDistance(control1, control2) +
    physicalDistance(control2, end);
  const flatness = Math.max(0, controlPolygonLength - chordLength);

  if (
    depth >= options.maxSubdivisionDepth ||
    flatness <= options.toleranceMeters
  ) {
    nodes.push({ parameter: endParameter, point: clonePhysicalPoint(end) });
    return;
  }

  const firstMidpoint = interpolatePhysicalPoint(start, control1, 0.5);
  const secondMidpoint = interpolatePhysicalPoint(control1, control2, 0.5);
  const thirdMidpoint = interpolatePhysicalPoint(control2, end, 0.5);
  const leftMidpoint = interpolatePhysicalPoint(
    firstMidpoint,
    secondMidpoint,
    0.5,
  );
  const rightMidpoint = interpolatePhysicalPoint(
    secondMidpoint,
    thirdMidpoint,
    0.5,
  );
  const curveMidpoint = interpolatePhysicalPoint(
    leftMidpoint,
    rightMidpoint,
    0.5,
  );
  const parameterMidpoint = (startParameter + endParameter) / 2;

  subdividePhysicalBezier(
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
  subdividePhysicalBezier(
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

function locatePhysicalBezierArcLengthPoint(
  geometry: PhysicalBezierTransitionGeometry,
  lut: PhysicalBezierArcLengthLut,
): { readonly point: PhysicalFieldPoint; readonly parameter: number } {
  if (lut.lengthMeters === 0) {
    return { point: clonePhysicalPoint(geometry.start), parameter: 0 };
  }

  const targetDistance = lut.lengthMeters / 2;
  let segmentIndex = lut.nodes.length - 2;
  for (let index = 0; index < lut.nodes.length - 1; index += 1) {
    if (
      targetDistance <= lut.nodes[index + 1].cumulativeLengthMeters ||
      index === lut.nodes.length - 2
    ) {
      segmentIndex = index;
      break;
    }
  }

  const segmentStart = lut.nodes[segmentIndex];
  const segmentEnd = lut.nodes[segmentIndex + 1];
  const segmentLength =
    segmentEnd.cumulativeLengthMeters - segmentStart.cumulativeLengthMeters;
  if (segmentLength === 0) {
    return {
      point: clonePhysicalPoint(segmentStart.point),
      parameter: segmentStart.parameter,
    };
  }

  const segmentRatio =
    (targetDistance - segmentStart.cumulativeLengthMeters) / segmentLength;
  const parameter =
    segmentStart.parameter +
    (segmentEnd.parameter - segmentStart.parameter) * segmentRatio;
  return {
    point: evaluatePhysicalCubic(geometry, parameter),
    parameter,
  };
}

function evaluatePhysicalCubic(
  geometry: PhysicalBezierTransitionGeometry,
  parameter: number,
): PhysicalFieldPoint {
  const oneMinusT = 1 - parameter;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const tSquared = parameter * parameter;
  const startWeight = oneMinusTSquared * oneMinusT;
  const control1Weight = 3 * oneMinusTSquared * parameter;
  const control2Weight = 3 * oneMinusT * tSquared;
  const endWeight = tSquared * parameter;
  return Object.freeze({
    xMeters:
      geometry.start.xMeters * startWeight +
      geometry.controlPoints[0].xMeters * control1Weight +
      geometry.controlPoints[1].xMeters * control2Weight +
      geometry.end.xMeters * endWeight,
    yMeters:
      geometry.start.yMeters * startWeight +
      geometry.controlPoints[0].yMeters * control1Weight +
      geometry.controlPoints[1].yMeters * control2Weight +
      geometry.end.yMeters * endWeight,
  });
}

function normalizePhysicalBezierOptions(
  options: TransitionGeometryOptions,
): NormalizedPhysicalBezierOptions {
  const toleranceSteps =
    options.tolerance ?? DEFAULT_BEZIER_ARC_LENGTH_TOLERANCE_STEPS;
  if (!Number.isFinite(toleranceSteps) || toleranceSteps <= 0) {
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
  return {
    toleranceMeters: toleranceSteps * STANDARD_STEP_METERS,
    maxSubdivisionDepth,
  };
}

function clonePhysicalPoint(point: PhysicalFieldPoint): PhysicalFieldPoint {
  return Object.freeze({ xMeters: point.xMeters, yMeters: point.yMeters });
}

function physicalDistance(
  first: PhysicalFieldPoint,
  second: PhysicalFieldPoint,
): number {
  return Math.hypot(
    second.xMeters - first.xMeters,
    second.yMeters - first.yMeters,
  );
}

function interpolatePhysicalPoint(
  start: PhysicalFieldPoint,
  end: PhysicalFieldPoint,
  ratio: number,
): PhysicalFieldPoint {
  return Object.freeze({
    xMeters: start.xMeters + (end.xMeters - start.xMeters) * ratio,
    yMeters: start.yMeters + (end.yMeters - start.yMeters) * ratio,
  });
}
