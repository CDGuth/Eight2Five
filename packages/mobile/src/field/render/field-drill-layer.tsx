import React from "react";
import { Montserrat_400Regular } from "@expo-google-fonts/montserrat/400Regular";
import { Montserrat_500Medium } from "@expo-google-fonts/montserrat/500Medium";
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
import type { FieldCameraPerspective } from "../camera/field-camera-types";
import type { FieldPoint } from "../types";
import { resolveCurrentTargetPosition } from "./field-overlay-types";
import {
  createDrillShapeGeometry,
  getDrillLabelTransformPolicy,
  getDrillLabelVerticalOffsetUnits,
  getDrillShapeTransformPolicy,
  type DrillShapeIcon,
} from "./drill-shape-policy";
import type { FieldRenderPalette } from "./field-render-tokens";
import {
  DRILL_MARKER_COLORS,
  DRILL_MARKER_SIZE_METERS,
  FIELD_CONNECTOR_STROKE_PX,
  FIELD_NUMBER_OPACITY,
  getClampedFieldTextScale,
} from "./field-render-tokens";
import { STANDARD_STEP_METERS } from "../units";

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
const PERFORMER_LABEL_MIN_SCREEN_FONT_SIZE_PX = 15;
const PERFORMER_LABEL_MAX_SCREEN_FONT_SIZE_PX = 30;
const ACTIVE_PERFORMER_LABEL_SCALE_MULTIPLIER = 1.25;
const MARKER_STROKE_METERS = STANDARD_STEP_METERS * 0.12;
const DASH_LENGTH_METERS = STANDARD_STEP_METERS * 0.25;
const DASH_GAP_METERS = STANDARD_STEP_METERS * 0.15;
const EXTRA_TRANSITION_OPACITY = 0.68;

export interface FieldDrillLayerProps {
  readonly scene?: DrillRenderScene;
  /** Used only for legacy/manual drills that have no complete source document. */
  readonly fallbackTargetPosition?: FieldPoint;
  readonly guidanceOverlay?: React.ReactNode;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
  readonly perspective: FieldCameraPerspective;
}

/**
 * Draws the selected-set model in explicit z-order. The optional guidance
 * overlay is placed above ordinary performer/prop shapes but below their labels
 * and every current/previous/next set marker.
 */
export const FieldDrillLayer = React.memo(function FieldDrillLayer({
  scene,
  fallbackTargetPosition,
  guidanceOverlay,
  metersPerPixel,
  palette,
  perspective,
}: FieldDrillLayerProps) {
  const propLabelFont = useFont(Montserrat_400Regular, LABEL_FONT_SIZE_PX);
  const performerLabelFont = useFont(Montserrat_500Medium, LABEL_FONT_SIZE_PX);
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
        <OrdinaryEntityShape
          key={`entity-shape-${entity.entityId}`}
          entity={entity}
          metersPerPixel={metersPerPixel}
          palette={palette}
        />
      ))}
      {guidanceOverlay}
      {entities.map((entity) => (
        <OrdinaryEntityLabel
          key={`entity-label-${entity.entityId}`}
          entity={entity}
          labelFont={
            entity.type === "performer" ? performerLabelFont : propLabelFont
          }
          metersPerPixel={metersPerPixel}
          palette={palette}
          perspective={perspective}
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
      {targetPoint ? <CurrentTargetMarker point={targetPoint} /> : null}
      {targetPoint && scene?.currentEntity ? (
        <EntityLabel
          entity={scene.currentEntity}
          font={performerLabelFont}
          color={palette.fieldLines}
          perspective={perspective}
          metersPerPixel={metersPerPixel}
          markerHalfHeightMeters={DRILL_MARKER_SIZE_METERS.currentDiameter / 2}
          minimumScreenFontSizePx={PERFORMER_LABEL_MIN_SCREEN_FONT_SIZE_PX}
          scaleMultiplier={ACTIVE_PERFORMER_LABEL_SCALE_MULTIPLIER}
          opacityMultiplier={FIELD_NUMBER_OPACITY}
        />
      ) : null}
    </>
  );
});

function OrdinaryEntityShape({
  entity,
  metersPerPixel,
  palette,
}: {
  readonly entity: DrillRenderEntity;
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
  );
}

function OrdinaryEntityLabel({
  entity,
  labelFont,
  metersPerPixel,
  palette,
  perspective,
}: {
  readonly entity: DrillRenderEntity;
  readonly labelFont: SkFont | null;
  readonly metersPerPixel: SharedValue<number>;
  readonly palette: FieldRenderPalette;
  readonly perspective: FieldCameraPerspective;
}) {
  const height =
    entity.type === "prop" ? entity.lengthMeters : entity.diameterMeters;
  return (
    <EntityLabel
      entity={entity}
      font={labelFont}
      color={palette.fieldLines}
      perspective={perspective}
      metersPerPixel={metersPerPixel}
      markerHalfHeightMeters={height / 2}
      minimumScreenFontSizePx={
        entity.type === "performer"
          ? PERFORMER_LABEL_MIN_SCREEN_FONT_SIZE_PX
          : undefined
      }
      opacityMultiplier={entity.type === "performer" ? FIELD_NUMBER_OPACITY : 1}
    />
  );
}

function EntityLabel({
  entity,
  font,
  color,
  perspective,
  metersPerPixel,
  markerHalfHeightMeters,
  minimumScreenFontSizePx = 10,
  scaleMultiplier = 1,
  opacityMultiplier = 1,
}: {
  readonly entity: DrillRenderEntity;
  readonly font: SkFont | null;
  readonly color: string;
  readonly perspective: FieldCameraPerspective;
  readonly metersPerPixel: SharedValue<number>;
  readonly markerHalfHeightMeters: number;
  readonly minimumScreenFontSizePx?: number;
  readonly scaleMultiplier?: number;
  readonly opacityMultiplier?: number;
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
    const scale =
      getClampedFieldTextScale(
        metersPerPixel.value,
        LABEL_FONT_SIZE_PX,
        minimumScreenFontSizePx,
        entity.type === "performer"
          ? PERFORMER_LABEL_MAX_SCREEN_FONT_SIZE_PX
          : undefined,
      ) * scaleMultiplier;
    const labelScale = getDrillLabelTransformPolicy(perspective, scale);
    return [{ scaleX: labelScale.scaleX }, { scaleY: labelScale.scaleY }];
  });

  const bounds = font ? lines.map((line) => font.measureText(line.text)) : [];
  const widths = bounds.map((lineBounds) => lineBounds.width);
  const startY = -LABEL_LINE_HEIGHT_PX * (lines.length + 0.15);
  const lastLineIndex = lines.length - 1;
  const lastLineBounds = bounds[lastLineIndex];
  const paintedBottomUnits = lastLineBounds
    ? startY +
      lastLineIndex * LABEL_LINE_HEIGHT_PX +
      lastLineBounds.y +
      lastLineBounds.height
    : 0;
  const labelOffsetTransform = useDerivedValue(() => {
    const scale =
      getClampedFieldTextScale(
        metersPerPixel.value,
        LABEL_FONT_SIZE_PX,
        minimumScreenFontSizePx,
        entity.type === "performer"
          ? PERFORMER_LABEL_MAX_SCREEN_FONT_SIZE_PX
          : undefined,
      ) * scaleMultiplier;
    const translateY = getDrillLabelVerticalOffsetUnits(
      scale,
      markerHalfHeightMeters,
      paintedBottomUnits,
    );
    return [{ translateY }];
  });

  if (!font || lines.length === 0) return null;

  return (
    <Group
      origin={{ x: entity.position.xMeters, y: entity.position.yMeters }}
      transform={labelTransform}
      opacity={entity.opacity * opacityMultiplier}
    >
      <Group transform={labelOffsetTransform}>
        {lines.map((line, index) => (
          <Text
            key={line.key}
            x={entity.position.xMeters - widths[index] / 2}
            y={entity.position.yMeters + startY + index * LABEL_LINE_HEIGHT_PX}
            text={line.text}
            font={font}
            color={color}
          />
        ))}
      </Group>
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
  const radius = DRILL_MARKER_SIZE_METERS.midpointDiameter / 2;
  return (
    <Circle
      cx={point.xMeters}
      cy={point.yMeters}
      r={radius}
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
    () => metersPerPixel.value * FIELD_CONNECTOR_STROKE_PX,
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
  const markerPoint = kind === "previous" ? transition.start : transition.end;
  const markerRadius = DRILL_MARKER_SIZE_METERS.transitionDiameter / 2;
  const midpointRadius = DRILL_MARKER_SIZE_METERS.midpointDiameter / 2;
  const centerRadius = DRILL_MARKER_SIZE_METERS.transitionDiameter * 0.18;
  const connectorStrokeWidth = useDerivedValue(
    () => metersPerPixel.value * FIELD_CONNECTOR_STROKE_PX,
  );
  const dashIntervals = [DASH_LENGTH_METERS, DASH_GAP_METERS];
  const connectorColor =
    kind === "previous" ? DRILL_MARKER_COLORS.red : DRILL_MARKER_COLORS.green;

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
      {kind === "previous" ? (
        <Circle
          cx={markerPoint.xMeters}
          cy={markerPoint.yMeters}
          r={markerRadius}
          color={connectorColor}
          style="stroke"
          strokeWidth={MARKER_STROKE_METERS}
        >
          <DashPathEffect intervals={dashIntervals} />
        </Circle>
      ) : (
        <>
          <Circle
            cx={markerPoint.xMeters}
            cy={markerPoint.yMeters}
            r={markerRadius}
            color={connectorColor}
            style="fill"
          />
          <Circle
            cx={markerPoint.xMeters}
            cy={markerPoint.yMeters}
            r={markerRadius}
            color={connectorColor}
            style="stroke"
            strokeWidth={MARKER_STROKE_METERS}
          />
        </>
      )}
      <Circle
        cx={markerPoint.xMeters}
        cy={markerPoint.yMeters}
        r={centerRadius}
        color={connectorColor}
      />
      <Circle
        cx={transition.midpoint.xMeters}
        cy={transition.midpoint.yMeters}
        r={midpointRadius}
        color={connectorColor}
      />
    </>
  );
}

function CurrentTargetMarker({
  point,
}: {
  readonly point: PhysicalFieldPoint | FieldPoint;
}) {
  const radius = DRILL_MARKER_SIZE_METERS.currentDiameter / 2;
  const centerRadius = DRILL_MARKER_SIZE_METERS.currentDiameter * 0.14;

  return (
    <>
      {/* The ring is intentionally not filled; its interior stays transparent. */}
      <Circle
        cx={point.xMeters}
        cy={point.yMeters}
        r={radius}
        color={DRILL_MARKER_COLORS.yellow}
        style="stroke"
        strokeWidth={MARKER_STROKE_METERS}
      />
      <Circle
        cx={point.xMeters}
        cy={point.yMeters}
        r={centerRadius}
        color={DRILL_MARKER_COLORS.yellow}
      />
    </>
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
