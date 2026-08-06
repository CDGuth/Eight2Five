import React from "react";
import { Montserrat_400Regular } from "@expo-google-fonts/montserrat/400Regular";
import {
  Circle,
  DashPathEffect,
  Group,
  Path,
  Skia,
  Text,
  useFont,
  type SkFont,
  type SkPath,
} from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { PhysicalFieldPoint } from "@eight2five/drill-schema";

import type {
  DrillRenderEntity,
  DrillRenderScene,
  PhysicalImmediateTransition,
  PhysicalTransitionPathGeometry,
} from "../../drill/render-scene";
import type { FieldPoint } from "../types";
import { resolveCurrentTargetPosition } from "./field-overlay-types";
import {
  createDrillShapeGeometry,
  getDrillLabelTransformPolicy,
  getDrillShapeTransformPolicy,
  type DrillShapeIcon,
} from "./drill-shape-policy";
import type { FieldRenderPalette } from "./field-render-tokens";
import {
  DRILL_MARKER_COLORS,
  DRILL_MARKER_SIZE_METERS,
} from "./field-render-tokens";

const EMPTY_ENTITIES: readonly DrillRenderEntity[] = Object.freeze([]);
const EMPTY_DOTS = Object.freeze([]) as readonly {
  readonly setId: number;
  readonly point: PhysicalFieldPoint;
}[];
const EMPTY_TRANSITIONS = Object.freeze(
  [],
) as readonly PhysicalImmediateTransition[];
const LABEL_FONT_SIZE_PX = 12;
const LABEL_LINE_HEIGHT_PX = 14;
const MARKER_STROKE_PX = 2;
const CONNECTOR_STROKE_PX = 1.25;
const DASH_LENGTH_PX = 6;
const DASH_GAP_PX = 4;
const EXTRA_TRANSITION_OPACITY = 0.68;

export interface FieldDrillLayerProps {
  readonly scene?: DrillRenderScene;
  /** Used only for legacy/manual drills that have no complete source document. */
  readonly fallbackTargetPosition?: FieldPoint;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
}

/**
 * Draws the selected-set model in explicit z-order. Static field and anchors
 * are owned by the parent scene; guidance and the live position are drawn
 * after this layer so they remain visible above every drill entity.
 */
export const FieldDrillLayer = React.memo(function FieldDrillLayer({
  scene,
  fallbackTargetPosition,
  metersPerPixel,
  palette,
}: FieldDrillLayerProps) {
  const labelFont = useFont(Montserrat_400Regular, LABEL_FONT_SIZE_PX);
  const entities = scene?.entities ?? EMPTY_ENTITIES;
  const previousConnectors = scene?.previousConnectors ?? EMPTY_TRANSITIONS;
  const nextConnectors = scene?.nextConnectors ?? EMPTY_TRANSITIONS;
  const previousDots = scene?.previousDots ?? EMPTY_DOTS;
  const nextDots = scene?.nextDots ?? EMPTY_DOTS;
  const targetPoint = resolveCurrentTargetPosition({
    fullDrillSceneAvailable: scene !== undefined,
    sceneCurrent: scene?.current,
    legacyFallback: fallbackTargetPosition,
  });

  return (
    <>
      {entities.map((entity) => (
        <OrdinaryEntity
          key={`entity-${entity.entityId}`}
          entity={entity}
          labelFont={labelFont}
          metersPerPixel={metersPerPixel}
          palette={palette}
        />
      ))}
      {previousConnectors.map((transition) => (
        <ExtraTransitionConnector
          key={`previous-connector-${transition.fromSetId}-${transition.toSetId}`}
          transition={transition}
          kind="previous"
          metersPerPixel={metersPerPixel}
        />
      ))}
      {nextConnectors.map((transition) => (
        <ExtraTransitionConnector
          key={`next-connector-${transition.fromSetId}-${transition.toSetId}`}
          transition={transition}
          kind="next"
          metersPerPixel={metersPerPixel}
        />
      ))}
      {previousDots.map((dot) => (
        <ExtraDot
          key={`previous-dot-${dot.setId}`}
          point={dot.point}
          color={DRILL_MARKER_COLORS.red}
        />
      ))}
      {nextDots.map((dot) => (
        <ExtraDot
          key={`next-dot-${dot.setId}`}
          point={dot.point}
          color={DRILL_MARKER_COLORS.green}
        />
      ))}
      {scene?.previous ? (
        <ImmediateTransitionLayer
          transition={scene.previous}
          kind="previous"
          metersPerPixel={metersPerPixel}
        />
      ) : null}
      {scene?.next ? (
        <ImmediateTransitionLayer
          transition={scene.next}
          kind="next"
          metersPerPixel={metersPerPixel}
        />
      ) : null}
      {targetPoint ? (
        <CurrentTargetMarker
          point={targetPoint}
          metersPerPixel={metersPerPixel}
        />
      ) : null}
    </>
  );
});

function OrdinaryEntity({
  entity,
  labelFont,
  metersPerPixel,
  palette,
}: {
  readonly entity: DrillRenderEntity;
  readonly labelFont: SkFont | null;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
}) {
  const icon = entity.icon as string;
  const width =
    entity.type === "prop" ? entity.widthMeters : entity.diameterMeters;
  const height =
    entity.type === "prop" ? entity.lengthMeters : entity.diameterMeters;
  const shapeGeometry = React.useMemo(
    () => createDrillShapeGeometry(icon as DrillShapeIcon, width, height),
    [height, icon, width],
  );
  const shapePath = React.useMemo(
    () =>
      shapeGeometry.kind === "path"
        ? createShapePath(shapeGeometry.points)
        : null,
    [shapeGeometry],
  );
  const transformPolicy = React.useMemo(
    () => getDrillShapeTransformPolicy(entity.facingDegrees),
    [entity.facingDegrees],
  );
  const transform = React.useMemo(
    () => [
      { translateX: entity.position.xMeters },
      { translateY: entity.position.yMeters },
      ...(transformPolicy.rotationRadians === 0
        ? []
        : [{ rotate: transformPolicy.rotationRadians }]),
    ],
    [
      entity.position.xMeters,
      entity.position.yMeters,
      transformPolicy.rotationRadians,
    ],
  );
  const outlineWidth = useDerivedValue(() => metersPerPixel.value);

  return (
    <>
      <Group
        transform={transform}
        origin={transformPolicy.origin}
        opacity={entity.opacity}
      >
        {shapePath ? (
          <>
            <Path path={shapePath} color={entity.color} style="fill" />
            {entity.type === "prop" ? (
              <Path
                path={shapePath}
                color={palette.fieldLines}
                style="stroke"
                strokeWidth={outlineWidth}
                opacity={0.8}
              />
            ) : null}
          </>
        ) : (
          <Circle
            cx={0}
            cy={0}
            r={shapeGeometry.kind === "circle" ? shapeGeometry.radius : 0}
            color={entity.color}
          />
        )}
      </Group>
      <EntityLabel
        entity={entity}
        font={labelFont}
        metersPerPixel={metersPerPixel}
        color={palette.fieldLines}
      />
    </>
  );
}

function EntityLabel({
  entity,
  font,
  metersPerPixel,
  color,
}: {
  readonly entity: DrillRenderEntity;
  readonly font: SkFont | null;
  readonly metersPerPixel: SharedValue<number>;
  readonly color: string;
}) {
  const lines = React.useMemo(
    () =>
      [
        entity.labelText ? { key: "label", text: entity.labelText } : null,
        entity.nameText ? { key: "name", text: entity.nameText } : null,
      ].filter((line): line is { key: string; text: string } => line !== null),
    [entity.labelText, entity.nameText],
  );
  const labelTransform = useDerivedValue(() => {
    const labelScale = getDrillLabelTransformPolicy(metersPerPixel.value);
    return [
      { translateX: entity.position.xMeters },
      { translateY: entity.position.yMeters },
      { scaleX: labelScale.scaleX },
      // The camera has a negative Y scale. This restores upright screen text
      // and makes the label size independent of zoom.
      { scaleY: labelScale.scaleY },
    ];
  });

  if (!font || lines.length === 0) return null;
  const widths = lines.map((line) => font.measureText(line.text).width);
  const startY = -LABEL_LINE_HEIGHT_PX * (lines.length + 0.15);

  return (
    <Group transform={labelTransform} opacity={entity.opacity}>
      {lines.map((line, index) => (
        <Text
          key={line.key}
          x={-widths[index] / 2}
          y={startY + index * LABEL_LINE_HEIGHT_PX}
          text={line.text}
          font={font}
          color={color}
        />
      ))}
    </Group>
  );
}

function ExtraDot({
  point,
  color,
}: {
  readonly point: PhysicalFieldPoint;
  readonly color: string;
}) {
  return (
    <Circle
      cx={point.xMeters}
      cy={point.yMeters}
      r={DRILL_MARKER_SIZE_METERS.midpointDiameter / 2}
      color={color}
      opacity={EXTRA_TRANSITION_OPACITY}
    />
  );
}

function ExtraTransitionConnector({
  transition,
  kind,
  metersPerPixel,
}: {
  readonly transition: PhysicalImmediateTransition;
  readonly kind: "previous" | "next";
  readonly metersPerPixel: SharedValue<number>;
}) {
  const connectorPath = React.useMemo(
    () => createPhysicalPath(transition.geometry),
    [transition.geometry],
  );
  const connectorStrokeWidth = useDerivedValue(
    () => metersPerPixel.value * CONNECTOR_STROKE_PX,
  );
  return (
    <Path
      path={connectorPath}
      color={
        kind === "previous"
          ? DRILL_MARKER_COLORS.red
          : DRILL_MARKER_COLORS.green
      }
      opacity={EXTRA_TRANSITION_OPACITY}
      style="stroke"
      strokeWidth={connectorStrokeWidth}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

function ImmediateTransitionLayer({
  transition,
  kind,
  metersPerPixel,
}: {
  readonly transition: PhysicalImmediateTransition;
  readonly kind: "previous" | "next";
  readonly metersPerPixel: SharedValue<number>;
}) {
  const connectorPath = React.useMemo(
    () => createPhysicalPath(transition.geometry),
    [transition.geometry],
  );
  const markerDiameter = DRILL_MARKER_SIZE_METERS.transitionDiameter;
  const markerPath = React.useMemo(
    () => createCirclePath(markerDiameter / 2),
    [markerDiameter],
  );
  const markerPoint = kind === "previous" ? transition.start : transition.end;
  const markerTransform = React.useMemo(
    () => [
      { translateX: markerPoint.xMeters },
      { translateY: markerPoint.yMeters },
    ],
    [markerPoint.xMeters, markerPoint.yMeters],
  );
  const markerStrokeWidth = useDerivedValue(
    () => metersPerPixel.value * MARKER_STROKE_PX,
  );
  const connectorStrokeWidth = useDerivedValue(
    () => metersPerPixel.value * CONNECTOR_STROKE_PX,
  );
  const dashIntervals = useDerivedValue(() => [
    metersPerPixel.value * DASH_LENGTH_PX,
    metersPerPixel.value * DASH_GAP_PX,
  ]);
  const connectorColor =
    kind === "previous" ? DRILL_MARKER_COLORS.red : DRILL_MARKER_COLORS.green;
  const centerRadius = markerDiameter * 0.18;

  return (
    <>
      <Path
        path={connectorPath}
        color={connectorColor}
        style="stroke"
        strokeWidth={connectorStrokeWidth}
        strokeCap="round"
        strokeJoin="round"
      />
      <Group transform={markerTransform} origin={{ x: 0, y: 0 }} opacity={1}>
        {kind === "previous" ? (
          <Path
            path={markerPath}
            color={connectorColor}
            style="stroke"
            strokeWidth={markerStrokeWidth}
          >
            <DashPathEffect intervals={dashIntervals} />
          </Path>
        ) : (
          <>
            <Circle
              cx={0}
              cy={0}
              r={markerDiameter / 2}
              color={connectorColor}
              style="fill"
            />
            <Path
              path={markerPath}
              color={connectorColor}
              style="stroke"
              strokeWidth={markerStrokeWidth}
            />
          </>
        )}
        <Circle cx={0} cy={0} r={centerRadius} color={connectorColor} />
      </Group>
      <Circle
        cx={transition.midpoint.xMeters}
        cy={transition.midpoint.yMeters}
        r={DRILL_MARKER_SIZE_METERS.midpointDiameter / 2}
        color={connectorColor}
      />
    </>
  );
}

function CurrentTargetMarker({
  point,
  metersPerPixel,
}: {
  readonly point: PhysicalFieldPoint | FieldPoint;
  readonly metersPerPixel: SharedValue<number>;
}) {
  const diameter = DRILL_MARKER_SIZE_METERS.currentDiameter;
  const ringPath = React.useMemo(
    () => createCirclePath(diameter / 2),
    [diameter],
  );
  const transform = React.useMemo(
    () => [{ translateX: point.xMeters }, { translateY: point.yMeters }],
    [point.xMeters, point.yMeters],
  );
  const strokeWidth = useDerivedValue(
    () => metersPerPixel.value * MARKER_STROKE_PX,
  );

  return (
    <Group transform={transform} origin={{ x: 0, y: 0 }} opacity={1}>
      {/* The ring is intentionally not filled; its interior stays transparent. */}
      <Path
        path={ringPath}
        color={DRILL_MARKER_COLORS.yellow}
        style="stroke"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={0}
        cy={0}
        r={diameter * 0.14}
        color={DRILL_MARKER_COLORS.yellow}
      />
    </Group>
  );
}

function createPhysicalPath(geometry: PhysicalTransitionPathGeometry): SkPath {
  const builder = Skia.PathBuilder.Make();
  switch (geometry.kind) {
    case "straight":
      builder
        .moveTo(geometry.start.xMeters, geometry.start.yMeters)
        .lineTo(geometry.end.xMeters, geometry.end.yMeters);
      break;
    case "polyline": {
      const first = geometry.points[0];
      if (!first) return builder.build();
      builder.moveTo(first.xMeters, first.yMeters);
      for (const point of geometry.points.slice(1)) {
        builder.lineTo(point.xMeters, point.yMeters);
      }
      break;
    }
    case "bezier":
      builder
        .moveTo(geometry.start.xMeters, geometry.start.yMeters)
        .cubicTo(
          geometry.controlPoints[0].xMeters,
          geometry.controlPoints[0].yMeters,
          geometry.controlPoints[1].xMeters,
          geometry.controlPoints[1].yMeters,
          geometry.end.xMeters,
          geometry.end.yMeters,
        );
      break;
  }
  return builder.build();
}

function createCirclePath(radius: number): SkPath {
  return Skia.PathBuilder.Make().addCircle(0, 0, radius).build();
}

function createShapePath(
  points: readonly { readonly x: number; readonly y: number }[],
): SkPath {
  const builder = Skia.PathBuilder.Make();
  const first = points[0];
  if (!first) return builder.build();
  builder.moveTo(first.x, first.y);
  for (const point of points.slice(1)) builder.lineTo(point.x, point.y);
  return builder.close().build();
}
