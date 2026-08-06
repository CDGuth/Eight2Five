import {
  convertPropSizeValue,
  DEFAULT_PROP_SIZE,
  drillGridToPhysicalPoint,
  resolveDrillEntity,
  resolveFieldDefinition,
  type DrillDocument,
  type DrillEntity,
  type DrillGridPoint,
  type EntityIcon,
  type FieldDefinition,
  type FieldPresetId,
  type PhysicalFieldPoint,
  type ResolvedDrillEntity,
  type ResolvedFieldDefinition,
} from "@eight2five/drill-schema";

import { standardStepsToMeters } from "../field/units";
import {
  buildTransitionScene,
  type ImmediateTransition,
  type TransitionDot,
  type TransitionSceneSettings,
} from "./transition-scene";
import type {
  TransitionGeometryOptions,
  TransitionPathGeometry,
} from "./transition-geometry";
import type { DrillSet } from "./types";
import { withPhysicalTransitionMidpoint } from "./physical-transition-geometry";

/**
 * Visibility settings used while deriving a selected-set render model.
 *
 * The model intentionally receives the small visibility contract instead of
 * the complete AppSettings object. This keeps the domain helper independent of
 * persistence and makes its memoization inputs explicit at the field boundary.
 */
export interface DrillRenderSceneSettings extends TransitionSceneSettings {
  readonly showPerformerLabels: boolean;
  readonly showPerformerNames: boolean;
  readonly showPropLabels: boolean;
  readonly showPropNames: boolean;
}

export type DrillRenderFieldInput =
  | FieldPresetId
  | FieldDefinition
  | ResolvedFieldDefinition;

export interface DrillRenderSceneInput {
  readonly document: DrillDocument;
  /** The active field definition, not necessarily the document's default. */
  readonly field: DrillRenderFieldInput;
  readonly selectedPerformerEntityId: number;
  readonly selectedSourceSetId: number;
  readonly settings: DrillRenderSceneSettings;
  readonly geometryOptions?: TransitionGeometryOptions;
  readonly epsilon?: number;
}

export interface DrillRenderEntityBase {
  readonly entityId: number;
  readonly type: DrillEntity["type"];
  readonly symbol: string;
  readonly label: string;
  readonly name?: string;
  readonly icon: EntityIcon;
  readonly color: string;
  readonly labelVisible: boolean;
  readonly labelText?: string;
  readonly nameText?: string;
  readonly position: PhysicalFieldPoint;
  readonly facingDegrees?: number;
  /** Ordinary entities intentionally remain fully opaque. */
  readonly opacity: 1;
  readonly resolvedEntity: ResolvedDrillEntity;
}

export interface PerformerRenderEntity extends DrillRenderEntityBase {
  readonly type: "performer";
  /** Exactly one standard 8-to-5 step in physical meters. */
  readonly diameterMeters: number;
}

export interface PropRenderEntity extends DrillRenderEntityBase {
  readonly type: "prop";
  readonly widthMeters: number;
  readonly lengthMeters: number;
}

export type DrillRenderEntity = PerformerRenderEntity | PropRenderEntity;

export interface PhysicalStraightTransitionGeometry {
  readonly kind: "straight";
  readonly start: PhysicalFieldPoint;
  readonly end: PhysicalFieldPoint;
}

export interface PhysicalPolylineTransitionGeometry {
  readonly kind: "polyline";
  readonly points: readonly PhysicalFieldPoint[];
}

export interface PhysicalBezierTransitionGeometry {
  readonly kind: "bezier";
  readonly start: PhysicalFieldPoint;
  readonly controlPoints: readonly [PhysicalFieldPoint, PhysicalFieldPoint];
  readonly end: PhysicalFieldPoint;
}

export type PhysicalTransitionPathGeometry =
  | PhysicalStraightTransitionGeometry
  | PhysicalPolylineTransitionGeometry
  | PhysicalBezierTransitionGeometry;

export interface PhysicalImmediateTransition {
  readonly entityId: number;
  readonly fromSetId: number;
  readonly toSetId: number;
  readonly start: PhysicalFieldPoint;
  readonly end: PhysicalFieldPoint;
  readonly geometry: PhysicalTransitionPathGeometry;
  readonly lengthSteps: number;
  readonly midpoint: PhysicalFieldPoint;
  readonly midpointParameter?: number;
}

export interface PhysicalTransitionDot {
  readonly setId: number;
  readonly point: PhysicalFieldPoint;
}

export interface DrillRenderScene {
  readonly selectedPerformerEntityId: number;
  readonly selectedSourceSetId: number;
  /** Null means that the selected performer has no position in this set. */
  readonly current: PhysicalFieldPoint | null;
  /** Other performers and props in the selected source set. */
  readonly entities: readonly DrillRenderEntity[];
  readonly previous?: PhysicalImmediateTransition;
  readonly next?: PhysicalImmediateTransition;
  readonly previousConnectors: readonly PhysicalImmediateTransition[];
  readonly nextConnectors: readonly PhysicalImmediateTransition[];
  readonly previousDots: readonly PhysicalTransitionDot[];
  readonly nextDots: readonly PhysicalTransitionDot[];
}

/**
 * The renderer's layer contract is kept as data so z-order cannot silently
 * drift when a new overlay is added.
 */
export const DRILL_RENDER_LAYER_ORDER = Object.freeze([
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
] as const);

/** One standard 8-to-5 step, shared by performer and marker size math. */
export const DEFAULT_PERFORMER_DIAMETER_METERS = standardStepsToMeters(1);

/**
 * Build all data needed by the Skia field layer for one selected set.
 *
 * This is deliberately a pure, immutable boundary. Entity resolution,
 * position lookup, field projection, path projection, and transition math all
 * happen here rather than inside the per-frame Skia tree.
 */
export function buildDrillRenderScene(
  input: DrillRenderSceneInput,
): DrillRenderScene {
  const field = resolveRenderField(input.field);
  const resolvedEntities = input.document.entities.map((entity) =>
    freezeResolvedEntity(
      resolveDrillEntity(entity, input.document.entityRules),
    ),
  );
  const positionsByEntityId = new Map<number, DrillPositionForSet>();
  for (const position of input.document.positions) {
    if (position.setId !== input.selectedSourceSetId) continue;
    positionsByEntityId.set(position.entityId, position);
  }

  const entities: DrillRenderEntity[] = [];
  for (const resolved of resolvedEntities) {
    // The selected performer is represented by the target/transition layers,
    // never by the ordinary-entity layer.
    if (
      resolved.type === "performer" &&
      resolved.id === input.selectedPerformerEntityId
    ) {
      continue;
    }
    // TODO: Fix this once the drill schema has an explicit entity visibility
    // property. For now, imported label visibility controls whether the
    // performer/prop itself is rendered.
    if (!resolved.appearance.labelVisible) continue;
    const position = positionsByEntityId.get(resolved.id);
    if (!position) continue;
    entities.push(
      createRenderEntity(resolved, position, field, input.settings),
    );
  }

  const transitionScene = buildTransitionScene({
    document: input.document,
    selectedPerformerEntityId: input.selectedPerformerEntityId,
    selectedSourceSetId: input.selectedSourceSetId,
    settings: input.settings,
    geometryOptions: input.geometryOptions,
    epsilon: input.epsilon,
  });

  return freezeScene({
    selectedPerformerEntityId: input.selectedPerformerEntityId,
    selectedSourceSetId: input.selectedSourceSetId,
    current: transitionScene.current
      ? projectPoint(transitionScene.current, field)
      : null,
    entities,
    ...(transitionScene.previous
      ? {
          previous: projectImmediateTransition(
            transitionScene.previous,
            field,
            input.geometryOptions,
          ),
        }
      : {}),
    ...(transitionScene.next
      ? {
          next: projectImmediateTransition(
            transitionScene.next,
            field,
            input.geometryOptions,
          ),
        }
      : {}),
    previousConnectors: transitionScene.previousConnectors.map((transition) =>
      projectImmediateTransition(transition, field, input.geometryOptions),
    ),
    nextConnectors: transitionScene.nextConnectors.map((transition) =>
      projectImmediateTransition(transition, field, input.geometryOptions),
    ),
    previousDots: transitionScene.previousDots.map((dot) =>
      projectTransitionDot(dot, field),
    ),
    nextDots: transitionScene.nextDots.map((dot) =>
      projectTransitionDot(dot, field),
    ),
  });
}

export const deriveDrillRenderScene = buildDrillRenderScene;
export const buildSelectedSetRenderScene = buildDrillRenderScene;

/** The Drill settings master switch owns scene creation as well as visibility. */
export function shouldBuildDrillRenderScene(
  drillFeaturesEnabled: boolean,
): boolean {
  return drillFeaturesEnabled;
}

/**
 * Imported local rows carry an opaque SQLite id as well as the portable set
 * id. Rendering must always use the latter and never accidentally pass the
 * local row id into the source document.
 */
export function resolveSelectedSourceSetId(
  selectedSet?: Pick<DrillSet, "id" | "sourceSetId">,
): number | undefined {
  return selectedSet?.sourceSetId;
}

/** Project a Phase 3 grid path without changing its endpoint semantics. */
export function projectTransitionPathGeometry(
  geometry: TransitionPathGeometry,
  fieldInput: DrillRenderFieldInput,
): PhysicalTransitionPathGeometry {
  const field = resolveRenderField(fieldInput);
  switch (geometry.kind) {
    case "straight":
      return freezePhysicalGeometry({
        kind: "straight",
        start: projectPoint(geometry.start, field),
        end: projectPoint(geometry.end, field),
      });
    case "polyline":
      return freezePhysicalGeometry({
        kind: "polyline",
        points: geometry.points.map((point) => projectPoint(point, field)),
      });
    case "bezier":
      return freezePhysicalGeometry({
        kind: "bezier",
        start: projectPoint(geometry.start, field),
        controlPoints: [
          projectPoint(geometry.controlPoints[0], field),
          projectPoint(geometry.controlPoints[1], field),
        ],
        end: projectPoint(geometry.end, field),
      });
  }
}

export const projectDrillTransitionPath = projectTransitionPathGeometry;

/** Resolve a prop's physical dimensions using the schema's unit conversion. */
export function resolvePropPhysicalSize(entity: Pick<DrillEntity, "size">): {
  readonly widthMeters: number;
  readonly lengthMeters: number;
} {
  const size = entity.size ?? DEFAULT_PROP_SIZE;
  return Object.freeze({
    widthMeters: convertPropSizeValue(size.width, size.unit, "meters"),
    lengthMeters: convertPropSizeValue(size.length, size.unit, "meters"),
  });
}

function createRenderEntity(
  entity: ResolvedDrillEntity,
  position: DrillPositionForSet,
  field: ResolvedFieldDefinition,
  settings: DrillRenderSceneSettings,
): DrillRenderEntity {
  const labelText =
    settingsForEntity(entity.type, settings).showLabels &&
    entity.appearance.labelVisible
      ? entity.label
      : undefined;
  const nameText = settingsForEntity(entity.type, settings).showNames
    ? entity.name
    : undefined;
  const base = {
    entityId: entity.id,
    type: entity.type,
    symbol: entity.symbol,
    label: entity.label,
    ...(entity.name === undefined ? {} : { name: entity.name }),
    icon: entity.appearance.icon,
    color: entity.appearance.color,
    labelVisible: entity.appearance.labelVisible,
    ...(labelText === undefined ? {} : { labelText }),
    ...(nameText === undefined ? {} : { nameText }),
    position: projectPoint(position, field),
    ...(position.facingDegrees === undefined
      ? {}
      : { facingDegrees: position.facingDegrees }),
    opacity: 1 as const,
    resolvedEntity: entity,
  };

  if (entity.type === "prop") {
    const size = resolvePropPhysicalSize(entity);
    return {
      ...base,
      type: "prop",
      ...size,
    };
  }

  return {
    ...base,
    type: "performer",
    diameterMeters: DEFAULT_PERFORMER_DIAMETER_METERS,
  };
}

function settingsForEntity(
  type: DrillEntity["type"],
  settings: DrillRenderSceneSettings,
): { readonly showLabels: boolean; readonly showNames: boolean } {
  return type === "prop"
    ? {
        showLabels: settings.showPropLabels,
        showNames: settings.showPropNames,
      }
    : {
        showLabels: settings.showPerformerLabels,
        showNames: settings.showPerformerNames,
      };
}

function projectImmediateTransition(
  transition: ImmediateTransition,
  field: ResolvedFieldDefinition,
  geometryOptions?: TransitionGeometryOptions,
): PhysicalImmediateTransition {
  const projectedGeometry = projectTransitionPathGeometry(
    transition.geometry,
    field,
  );
  return withPhysicalTransitionMidpoint(
    {
      entityId: transition.entityId,
      fromSetId: transition.fromSetId,
      toSetId: transition.toSetId,
      start: projectPoint(transition.start, field),
      end: projectPoint(transition.end, field),
      geometry: projectedGeometry,
      lengthSteps: transition.lengthSteps,
    },
    projectedGeometry,
    geometryOptions,
  );
}

function projectTransitionDot(
  dot: TransitionDot,
  field: ResolvedFieldDefinition,
): PhysicalTransitionDot {
  return Object.freeze({
    setId: dot.setId,
    point: projectPoint(dot.point, field),
  });
}

function projectPoint(
  point: DrillGridPoint,
  field: ResolvedFieldDefinition,
): PhysicalFieldPoint {
  const projected = drillGridToPhysicalPoint(point, field);
  return Object.freeze({
    xMeters: projected.xMeters,
    yMeters: projected.yMeters,
  });
}

function resolveRenderField(
  fieldInput: DrillRenderFieldInput,
): ResolvedFieldDefinition {
  if (typeof fieldInput === "string") {
    return resolveFieldDefinition({ type: "preset", preset: fieldInput });
  }
  if ("id" in fieldInput && "physicalGeometry" in fieldInput) {
    return fieldInput;
  }
  return resolveFieldDefinition(fieldInput);
}

function freezeResolvedEntity(
  entity: ResolvedDrillEntity,
): ResolvedDrillEntity {
  return Object.freeze({
    ...entity,
    ...(entity.size === undefined
      ? {}
      : { size: Object.freeze({ ...entity.size }) }),
    appearance: Object.freeze({ ...entity.appearance }),
  });
}

function freezeScene(scene: {
  readonly selectedPerformerEntityId: number;
  readonly selectedSourceSetId: number;
  readonly current: PhysicalFieldPoint | null;
  readonly entities: readonly DrillRenderEntity[];
  readonly previous?: PhysicalImmediateTransition;
  readonly next?: PhysicalImmediateTransition;
  readonly previousConnectors: readonly PhysicalImmediateTransition[];
  readonly nextConnectors: readonly PhysicalImmediateTransition[];
  readonly previousDots: readonly PhysicalTransitionDot[];
  readonly nextDots: readonly PhysicalTransitionDot[];
}): DrillRenderScene {
  return Object.freeze({
    ...scene,
    current: scene.current ? Object.freeze({ ...scene.current }) : null,
    entities: Object.freeze(
      scene.entities.map((entity) => Object.freeze(entity)),
    ),
    previousConnectors: Object.freeze([...scene.previousConnectors]),
    nextConnectors: Object.freeze([...scene.nextConnectors]),
    previousDots: Object.freeze([...scene.previousDots]),
    nextDots: Object.freeze([...scene.nextDots]),
  });
}

function freezePhysicalGeometry(
  geometry: PhysicalTransitionPathGeometry,
): PhysicalTransitionPathGeometry {
  switch (geometry.kind) {
    case "straight":
      return Object.freeze({
        kind: geometry.kind,
        start: Object.freeze({ ...geometry.start }),
        end: Object.freeze({ ...geometry.end }),
      });
    case "polyline":
      return Object.freeze({
        kind: geometry.kind,
        points: Object.freeze(
          geometry.points.map((point) => Object.freeze({ ...point })),
        ),
      });
    case "bezier":
      return Object.freeze({
        kind: geometry.kind,
        start: Object.freeze({ ...geometry.start }),
        controlPoints: Object.freeze([
          Object.freeze({ ...geometry.controlPoints[0] }),
          Object.freeze({ ...geometry.controlPoints[1] }),
        ]) as readonly [PhysicalFieldPoint, PhysicalFieldPoint],
        end: Object.freeze({ ...geometry.end }),
      });
  }
}

interface DrillPositionForSet extends DrillGridPoint {
  readonly entityId: number;
  readonly setId: number;
  readonly facingDegrees?: number;
}
