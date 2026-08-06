import {
  areGridPointsEquivalent,
  buildTransitionScene,
  cubicBezierPoint,
  DEFAULT_GRID_POINT_EPSILON_STEPS,
  measureTransitionGeometry,
  type TransitionSceneSettings,
} from "..";
import {
  DRILL_SCHEMA_URL,
  DRILL_SCHEMA_VERSION,
  type DrillDocument,
  type DrillGridPoint,
} from "@eight2five/drill-schema";

const ENTITY_ID = 7;

function settings(
  overrides: Partial<TransitionSceneSettings> = {},
): TransitionSceneSettings {
  return {
    markerEnabled: true,
    showAll: false,
    previousTotalCount: 1,
    nextTotalCount: 1,
    ...overrides,
  };
}

function documentFor(
  points: readonly DrillGridPoint[],
  paths?: DrillDocument["paths"],
): DrillDocument {
  return {
    schema: DRILL_SCHEMA_URL,
    schemaVersion: DRILL_SCHEMA_VERSION,
    metadata: {
      title: "Transition test",
      createdAt: "2026-08-05T00:00:00.000Z",
    },
    field: { type: "preset", preset: "football-nfhs" },
    entities: [{ id: ENTITY_ID, type: "performer", symbol: "P", label: "P1" }],
    sets: points.map((_, id) => ({
      id,
      number: id + 1,
      kind: "set" as const,
      countsFromPrevious: id === 0 ? 0 : 8,
    })),
    positions: points.map((point, setId) => ({
      entityId: ENTITY_ID,
      setId,
      ...point,
    })),
    ...(paths === undefined ? {} : { paths }),
  };
}

describe("transition geometry", () => {
  test("uses the analytic midpoint for a straight transition", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: 0, ySteps: 0 },
        { xSteps: 10, ySteps: 4 },
      ]),
      ENTITY_ID,
      1,
      settings(),
    );

    expect(scene.current).toEqual({ xSteps: 10, ySteps: 4 });
    expect(scene.previous?.geometry).toEqual({
      kind: "straight",
      start: { xSteps: 0, ySteps: 0 },
      end: { xSteps: 10, ySteps: 4 },
    });
    expect(scene.previous?.midpoint).toEqual({ xSteps: 5, ySteps: 2 });
  });

  test("finds the midpoint by distance on unequal polyline segments", () => {
    const scene = buildTransitionScene(
      documentFor(
        [
          { xSteps: 0, ySteps: 0 },
          { xSteps: 1, ySteps: 3 },
        ],
        [
          {
            entityId: ENTITY_ID,
            fromSetId: 0,
            toSetId: 1,
            kind: "polyline",
            waypoints: [{ xSteps: 1, ySteps: 0 }],
          },
        ],
      ),
      ENTITY_ID,
      1,
      settings(),
    );

    expect(scene.previous?.geometry.kind).toBe("polyline");
    expect(scene.previous?.lengthSteps).toBe(4);
    expect(scene.previous?.midpoint).toEqual({ xSteps: 1, ySteps: 1 });
  });

  test("uses a true half-arc-length midpoint for an asymmetric Bézier", () => {
    const geometry = {
      kind: "bezier" as const,
      start: { xSteps: 0, ySteps: 0 },
      controlPoints: [
        { xSteps: 0, ySteps: 140 },
        { xSteps: 18, ySteps: -12 },
      ] as const,
      end: { xSteps: 100, ySteps: 0 },
    };
    const measured = measureTransitionGeometry(geometry, { tolerance: 1e-6 });
    const parameterHalfPoint = cubicBezierPoint(
      geometry.start,
      geometry.controlPoints[0],
      geometry.controlPoints[1],
      geometry.end,
      0.5,
    );

    expect(measured.midpointParameter).not.toBeCloseTo(0.5, 3);
    expect(measured.midpoint.xSteps).not.toBeCloseTo(
      parameterHalfPoint.xSteps,
      3,
    );
    expect(measured.midpoint.ySteps).not.toBeCloseTo(
      parameterHalfPoint.ySteps,
      3,
    );
  });

  test("uses the same coarse chord LUT metric for length and midpoint", () => {
    const geometry = {
      kind: "bezier" as const,
      start: { xSteps: 0, ySteps: 0 },
      controlPoints: [
        { xSteps: 0, ySteps: 140 },
        { xSteps: 18, ySteps: -12 },
      ] as const,
      end: { xSteps: 100, ySteps: 0 },
    };
    const measured = measureTransitionGeometry(geometry, {
      tolerance: 1e-6,
      maxSubdivisionDepth: 0,
    });
    const expectedMidpoint = cubicBezierPoint(
      geometry.start,
      geometry.controlPoints[0],
      geometry.controlPoints[1],
      geometry.end,
      0.5,
    );

    expect(measured.lengthSteps).toBe(100);
    expect(measured.midpointParameter).toBe(0.5);
    expect(measured.midpoint).toEqual(expectedMidpoint);
  });

  test("falls back to a straight path when no matching path exists", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: -4, ySteps: 2 },
        { xSteps: 8, ySteps: -6 },
      ]),
      ENTITY_ID,
      1,
      settings(),
    );

    expect(scene.previous?.geometry.kind).toBe("straight");
  });

  test("matches an explicit path by entity and both set IDs", () => {
    const scene = buildTransitionScene(
      documentFor(
        [
          { xSteps: 0, ySteps: 0 },
          { xSteps: 8, ySteps: 0 },
          { xSteps: 20, ySteps: 0 },
        ],
        [
          {
            entityId: ENTITY_ID,
            fromSetId: 1,
            toSetId: 2,
            kind: "bezier",
            controlPoints: [
              { xSteps: 12, ySteps: 10 },
              { xSteps: 16, ySteps: 10 },
            ],
          },
        ],
      ),
      ENTITY_ID,
      2,
      settings(),
    );

    expect(scene.previous?.geometry.kind).toBe("bezier");
    expect(scene.previous?.start).toEqual({ xSteps: 8, ySteps: 0 });
    expect(scene.previous?.end).toEqual({ xSteps: 20, ySteps: 0 });
  });
});

describe("transition scene marker state", () => {
  test("suppresses the marker entering a hold", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: -4, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
      ]),
      ENTITY_ID,
      1,
      settings(),
    );

    expect(scene.previous).toBeDefined();
    expect(scene.next).toBeUndefined();
  });

  test("suppresses both sides inside a hold chain", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: -4, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 4, ySteps: 0 },
      ]),
      ENTITY_ID,
      2,
      settings(),
    );

    expect(scene.previous).toBeUndefined();
    expect(scene.next).toBeUndefined();
  });

  test("shows the next marker when moving out of a hold", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: -4, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 4, ySteps: 0 },
      ]),
      ENTITY_ID,
      2,
      settings({ previousTotalCount: 0 }),
    );

    expect(scene.next?.fromSetId).toBe(2);
    expect(scene.next?.toSetId).toBe(3);
  });

  test("handles the first and last source sets", () => {
    const document = documentFor([
      { xSteps: 0, ySteps: 0 },
      { xSteps: 4, ySteps: 0 },
    ]);
    const first = buildTransitionScene(
      document,
      ENTITY_ID,
      0,
      settings({ nextTotalCount: 0 }),
    );
    const last = buildTransitionScene(document, ENTITY_ID, 1, settings());

    expect(first.previous).toBeUndefined();
    expect(first.next).toBeUndefined();
    expect(last.previous).toBeDefined();
    expect(last.next).toBeUndefined();
  });

  test("showAll overrides detailed counts", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: 0, ySteps: 0 },
        { xSteps: 1, ySteps: 0 },
        { xSteps: 2, ySteps: 0 },
        { xSteps: 3, ySteps: 0 },
        { xSteps: 4, ySteps: 0 },
      ]),
      ENTITY_ID,
      3,
      settings({ showAll: true, previousTotalCount: 0, nextTotalCount: 0 }),
    );

    expect(scene.previous?.fromSetId).toBe(2);
    expect(
      scene.previousConnectors.map(({ fromSetId, toSetId }) => [
        fromSetId,
        toSetId,
      ]),
    ).toEqual([
      [1, 2],
      [0, 1],
    ]);
    expect(scene.previousDots.map((dot) => dot.setId)).toEqual([1, 0]);
    expect(scene.next?.toSetId).toBe(4);
    expect(scene.nextConnectors).toEqual([]);
  });

  test("uses total-count windows without backfilling a suppressed immediate marker", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: -8, ySteps: 0 },
        { xSteps: -4, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 8, ySteps: 0 },
      ]),
      ENTITY_ID,
      3,
      settings({ previousTotalCount: 2, nextTotalCount: 0 }),
    );

    expect(scene.previous).toBeUndefined();
    expect(scene.previousDots.map((dot) => dot.setId)).toEqual([1]);
    expect(scene.previousDots).not.toContainEqual({
      setId: 0,
      point: { xSteps: -8, ySteps: 0 },
    });
  });

  test("deduplicates coincident extras without removing the immediate marker", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: 0, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 4, ySteps: 0 },
        { xSteps: 4, ySteps: 0 },
        { xSteps: 8, ySteps: 0 },
      ]),
      ENTITY_ID,
      4,
      settings({ previousTotalCount: 4, nextTotalCount: 0 }),
    );

    expect(scene.previous?.fromSetId).toBe(3);
    expect(scene.previousDots.map((dot) => dot.setId)).toEqual([1]);
  });

  test("deduplicates extras scene-wide with previous extras taking priority", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: 8, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 4, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 8, ySteps: 0 },
      ]),
      ENTITY_ID,
      2,
      settings({ previousTotalCount: 3, nextTotalCount: 3 }),
    );

    expect(scene.previous).toBeDefined();
    expect(scene.next).toBeDefined();
    expect(
      scene.previousConnectors.map(({ fromSetId, toSetId }) => [
        fromSetId,
        toSetId,
      ]),
    ).toEqual([[0, 1]]);
    expect(
      scene.nextConnectors.map(({ fromSetId, toSetId }) => [
        fromSetId,
        toSetId,
      ]),
    ).toEqual([[3, 4]]);
    expect(scene.previousDots).toEqual([
      { setId: 0, point: { xSteps: 8, ySteps: 0 } },
    ]);
    expect(scene.nextDots).toEqual([]);
  });

  test("suppresses an extra that overlaps the opposite immediate endpoint", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: 6, ySteps: 0 },
        { xSteps: 0, ySteps: 0 },
        { xSteps: 4, ySteps: 0 },
        { xSteps: 6, ySteps: 0 },
        { xSteps: 8, ySteps: 0 },
      ]),
      ENTITY_ID,
      2,
      settings({ previousTotalCount: 3, nextTotalCount: 3 }),
    );

    expect(scene.previous).toBeDefined();
    expect(scene.next).toBeDefined();
    expect(scene.previousDots).toEqual([]);
    expect(scene.nextDots).toEqual([
      { setId: 4, point: { xSteps: 8, ySteps: 0 } },
    ]);
  });

  test("keeps the current point while hiding all transition markers when disabled", () => {
    const scene = buildTransitionScene(
      documentFor([
        { xSteps: 0, ySteps: 0 },
        { xSteps: 8, ySteps: 0 },
      ]),
      ENTITY_ID,
      1,
      settings({ markerEnabled: false, showAll: true }),
    );

    expect(scene.current).toEqual({ xSteps: 8, ySteps: 0 });
    expect(scene.previous).toBeUndefined();
    expect(scene.next).toBeUndefined();
    expect(scene.previousDots).toEqual([]);
    expect(scene.nextDots).toEqual([]);
  });

  test("defines epsilon equivalence for hold suppression", () => {
    expect(DEFAULT_GRID_POINT_EPSILON_STEPS).toBeGreaterThan(0);
    expect(
      areGridPointsEquivalent(
        { xSteps: 10, ySteps: -3 },
        { xSteps: 10 + DEFAULT_GRID_POINT_EPSILON_STEPS / 2, ySteps: -3 },
      ),
    ).toBe(true);
    expect(
      areGridPointsEquivalent(
        { xSteps: 10, ySteps: -3 },
        { xSteps: 10 + DEFAULT_GRID_POINT_EPSILON_STEPS * 2, ySteps: -3 },
      ),
    ).toBe(false);
  });
});
