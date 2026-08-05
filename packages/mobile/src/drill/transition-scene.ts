import type { DrillDocument, DrillGridPoint } from "@eight2five/drill-schema";

import {
  areGridPointsEquivalent,
  DEFAULT_GRID_POINT_EPSILON_STEPS,
  resolveTransitionGeometry,
  type ResolvedTransitionGeometry,
  type TransitionGeometryOptions,
  type TransitionPathGeometry,
} from "./transition-geometry";

/** Settings names mirror the persisted AppSettings contract. */
export interface AppTransitionSceneSettings {
  readonly showTransitionMarkers: boolean;
  readonly showAllTransitionSets: boolean;
  readonly previousTransitionSetCount: number;
  readonly nextTransitionSetCount: number;
}

/** A concise equivalent for callers that do not use the persisted settings object. */
export interface TransitionSceneSettings {
  readonly markerEnabled: boolean;
  readonly showAll: boolean;
  readonly previousTotalCount: number;
  readonly nextTotalCount: number;
}

export type TransitionSceneSettingsInput =
  | AppTransitionSceneSettings
  | TransitionSceneSettings;

export interface TransitionSceneInput {
  readonly document: DrillDocument;
  readonly selectedPerformerEntityId: number;
  readonly selectedSourceSetId: number;
  readonly settings: TransitionSceneSettingsInput;
  readonly geometryOptions?: TransitionGeometryOptions;
  readonly epsilon?: number;
}

export interface TransitionDot {
  readonly setId: number;
  readonly point: DrillGridPoint;
}

export interface ImmediateTransition {
  readonly entityId: number;
  readonly fromSetId: number;
  readonly toSetId: number;
  readonly start: DrillGridPoint;
  readonly end: DrillGridPoint;
  /** The geometry used both for the connector and for midpoint calculation. */
  readonly geometry: TransitionPathGeometry;
  readonly lengthSteps: number;
  readonly midpoint: DrillGridPoint;
  /** Only populated for cubic Bézier transitions. */
  readonly midpointParameter?: number;
}

export interface TransitionScene {
  readonly selectedPerformerEntityId: number;
  readonly selectedSourceSetId: number;
  /** Null means the selected performer has no position at the selected set. */
  readonly current: DrillGridPoint | null;
  readonly previous?: ImmediateTransition;
  readonly next?: ImmediateTransition;
  /** Extra dots are ordered nearest-to-farthest from the selected set. */
  readonly previousDots: readonly TransitionDot[];
  readonly nextDots: readonly TransitionDot[];
}

/**
 * Derive all transition marker geometry for one selected performer/set.
 *
 * Counts are ordinal windows: a count of one includes only the immediate
 * neighbor, a count of two includes that neighbor and one extra set, and so
 * on. Coincident suppression happens after selecting that raw window; omitted
 * positions are never replaced by a farther set.
 */
export function buildTransitionScene(
  input: TransitionSceneInput,
): TransitionScene;
export function buildTransitionScene(
  document: DrillDocument,
  selectedPerformerEntityId: number,
  selectedSourceSetId: number,
  settings: TransitionSceneSettingsInput,
  geometryOptions?: TransitionGeometryOptions,
): TransitionScene;
export function buildTransitionScene(
  inputOrDocument: TransitionSceneInput | DrillDocument,
  selectedPerformerEntityId?: number,
  selectedSourceSetId?: number,
  settings?: TransitionSceneSettingsInput,
  geometryOptions?: TransitionGeometryOptions,
): TransitionScene {
  const input = isTransitionSceneInput(inputOrDocument)
    ? inputOrDocument
    : {
        document: inputOrDocument,
        selectedPerformerEntityId: selectedPerformerEntityId as number,
        selectedSourceSetId: selectedSourceSetId as number,
        settings: settings as TransitionSceneSettingsInput,
        geometryOptions,
      };
  const normalizedSettings = normalizeSettings(input.settings);
  const epsilon = input.epsilon ?? DEFAULT_GRID_POINT_EPSILON_STEPS;
  assertEpsilon(epsilon);

  const selectedSetIndex = input.document.sets.findIndex(
    (set) => set.id === input.selectedSourceSetId,
  );
  const currentPosition = positionAtIndex(
    input.document,
    input.selectedPerformerEntityId,
    selectedSetIndex,
  );
  const current = currentPosition?.point ?? null;

  const emptyScene: TransitionScene = {
    selectedPerformerEntityId: input.selectedPerformerEntityId,
    selectedSourceSetId: input.selectedSourceSetId,
    current,
    previousDots: [],
    nextDots: [],
  };
  if (!normalizedSettings.markerEnabled || selectedSetIndex < 0 || !current) {
    return emptyScene;
  }

  const previousIndices = rawWindowIndices(
    selectedSetIndex,
    input.document.sets.length,
    "previous",
    normalizedSettings.showAll,
    normalizedSettings.previousTotalCount,
  );
  const nextIndices = rawWindowIndices(
    selectedSetIndex,
    input.document.sets.length,
    "next",
    normalizedSettings.showAll,
    normalizedSettings.nextTotalCount,
  );

  const previousPosition = positionAtIndex(
    input.document,
    input.selectedPerformerEntityId,
    previousIndices[0],
  );
  const nextPosition = positionAtIndex(
    input.document,
    input.selectedPerformerEntityId,
    nextIndices[0],
  );

  const previous = createImmediateTransition(
    input.document,
    input.selectedPerformerEntityId,
    previousPosition,
    currentPosition,
    input.geometryOptions,
    epsilon,
  );
  const next = createImmediateTransition(
    input.document,
    input.selectedPerformerEntityId,
    currentPosition,
    nextPosition,
    input.geometryOptions,
    epsilon,
  );

  const extraDots = createSceneExtraDots(
    input.document,
    input.selectedPerformerEntityId,
    previousIndices.slice(1),
    nextIndices.slice(1),
    current,
    previousPosition,
    nextPosition,
    epsilon,
  );

  return {
    ...emptyScene,
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
    previousDots: extraDots.previousDots,
    nextDots: extraDots.nextDots,
  };
}

export const deriveTransitionScene = buildTransitionScene;
export const buildTransitionMarkerScene = buildTransitionScene;

function createImmediateTransition(
  document: DrillDocument,
  entityId: number,
  fromPosition: PositionAtIndex | undefined,
  toPosition: PositionAtIndex | undefined,
  geometryOptions: TransitionGeometryOptions | undefined,
  epsilon: number,
): ImmediateTransition | undefined {
  if (!fromPosition || !toPosition) return undefined;
  if (areGridPointsEquivalent(fromPosition.point, toPosition.point, epsilon)) {
    return undefined;
  }

  const resolved = resolveTransitionGeometry(
    document,
    entityId,
    fromPosition.setId,
    toPosition.setId,
    geometryOptions,
  );
  return resolved
    ? makeImmediateTransition(
        entityId,
        fromPosition.setId,
        toPosition.setId,
        resolved,
      )
    : undefined;
}

function makeImmediateTransition(
  entityId: number,
  fromSetId: number,
  toSetId: number,
  resolved: ResolvedTransitionGeometry,
): ImmediateTransition {
  const { geometry } = resolved;
  const start = geometryStart(geometry);
  const end = geometryEnd(geometry);
  return {
    entityId,
    fromSetId,
    toSetId,
    start,
    end,
    geometry,
    lengthSteps: resolved.lengthSteps,
    midpoint: resolved.midpoint,
    ...(resolved.midpointParameter === undefined
      ? {}
      : { midpointParameter: resolved.midpointParameter }),
  };
}

function createSceneExtraDots(
  document: DrillDocument,
  entityId: number,
  previousExtraIndices: readonly number[],
  nextExtraIndices: readonly number[],
  current: DrillGridPoint,
  previousImmediatePosition: PositionAtIndex | undefined,
  nextImmediatePosition: PositionAtIndex | undefined,
  epsilon: number,
): {
  readonly previousDots: readonly TransitionDot[];
  readonly nextDots: readonly TransitionDot[];
} {
  // Previous extras have deterministic priority, followed by next extras.
  // Immediate markers are deliberately not part of `emittedPoints`: even
  // coincident previous and next transitions remain semantically distinct.
  const emittedPoints: DrillGridPoint[] = [];
  const blockedPoints = [
    current,
    ...(previousImmediatePosition ? [previousImmediatePosition.point] : []),
    ...(nextImmediatePosition ? [nextImmediatePosition.point] : []),
  ];

  const emit = (
    rawExtraIndices: readonly number[],
  ): readonly TransitionDot[] => {
    const dots: TransitionDot[] = [];
    for (const index of rawExtraIndices) {
      const position = positionAtIndex(document, entityId, index);
      if (!position) continue;
      if (
        blockedPoints.some((blocked) =>
          areGridPointsEquivalent(blocked, position.point, epsilon),
        ) ||
        emittedPoints.some((emitted) =>
          areGridPointsEquivalent(emitted, position.point, epsilon),
        )
      ) {
        continue;
      }
      dots.push({ setId: position.setId, point: position.point });
      emittedPoints.push(position.point);
    }
    return dots;
  };

  return {
    previousDots: emit(previousExtraIndices),
    nextDots: emit(nextExtraIndices),
  };
}

function rawWindowIndices(
  selectedSetIndex: number,
  setCount: number,
  direction: "previous" | "next",
  showAll: boolean,
  totalCount: number,
): readonly number[] {
  const availableCount =
    direction === "previous"
      ? selectedSetIndex
      : setCount - selectedSetIndex - 1;
  const windowCount = showAll
    ? availableCount
    : Math.min(totalCount, availableCount);
  return Array.from({ length: windowCount }, (_, offset) =>
    direction === "previous"
      ? selectedSetIndex - offset - 1
      : selectedSetIndex + offset + 1,
  );
}

interface PositionAtIndex {
  readonly setId: number;
  readonly point: DrillGridPoint;
}

function positionAtIndex(
  document: DrillDocument,
  entityId: number,
  index: number | undefined,
): PositionAtIndex | undefined {
  if (index === undefined || index < 0 || index >= document.sets.length) {
    return undefined;
  }
  const setId = document.sets[index].id;
  const point = findPosition(document, entityId, setId);
  return point ? { setId, point } : undefined;
}

function findPosition(
  document: DrillDocument,
  entityId: number,
  setId: number,
): DrillGridPoint | null {
  const position = document.positions.find(
    (candidate) => candidate.entityId === entityId && candidate.setId === setId,
  );
  return position ? { xSteps: position.xSteps, ySteps: position.ySteps } : null;
}

function geometryStart(geometry: TransitionPathGeometry): DrillGridPoint {
  return geometry.kind === "polyline" ? geometry.points[0] : geometry.start;
}

function geometryEnd(geometry: TransitionPathGeometry): DrillGridPoint {
  return geometry.kind === "polyline"
    ? geometry.points[geometry.points.length - 1]
    : geometry.end;
}

function normalizeSettings(
  settings: TransitionSceneSettingsInput,
): NormalizedTransitionSceneSettings {
  if ("showTransitionMarkers" in settings) {
    assertCount(settings.previousTransitionSetCount, "previous");
    assertCount(settings.nextTransitionSetCount, "next");
    return {
      markerEnabled: settings.showTransitionMarkers,
      showAll: settings.showAllTransitionSets,
      previousTotalCount: settings.previousTransitionSetCount,
      nextTotalCount: settings.nextTransitionSetCount,
    };
  }

  assertCount(settings.previousTotalCount, "previous");
  assertCount(settings.nextTotalCount, "next");
  return {
    markerEnabled: settings.markerEnabled,
    showAll: settings.showAll,
    previousTotalCount: settings.previousTotalCount,
    nextTotalCount: settings.nextTotalCount,
  };
}

interface NormalizedTransitionSceneSettings {
  readonly markerEnabled: boolean;
  readonly showAll: boolean;
  readonly previousTotalCount: number;
  readonly nextTotalCount: number;
}

function assertCount(value: number, direction: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(
      `${direction} transition total count must be a non-negative integer.`,
    );
  }
}

function assertEpsilon(epsilon: number): void {
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new RangeError(
      "Grid-point epsilon must be a finite non-negative number.",
    );
  }
}

function isTransitionSceneInput(
  value: TransitionSceneInput | DrillDocument,
): value is TransitionSceneInput {
  return "document" in value && "settings" in value;
}
