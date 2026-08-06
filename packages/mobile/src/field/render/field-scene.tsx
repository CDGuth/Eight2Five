import React from "react";
import { Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { StandardFootballFieldTemplate } from "../template";
import type { FieldPoint } from "../types";
import type {
  FieldCamera,
  FieldCameraPerspective,
  FieldViewportSize,
} from "../camera/field-camera-types";
import type { FieldPaths } from "./create-field-paths";
import { FieldStaticLayer } from "./field-static-layer";
import { FieldAnchorLayer } from "./field-anchor-layer";
import { FieldGuidanceLayer } from "./field-guidance-layer";
import { FieldPositionLayer } from "./field-position-layer";
import type {
  FieldAnchorGeometry,
  FieldAnchorOverlayOptions,
} from "./field-overlay-types";
import type { FieldRenderPalette } from "./field-render-tokens";
import type { DrillRenderScene } from "../../drill/render-scene";
import { FieldDrillLayer } from "./field-drill-layer";

interface FieldSceneProps {
  readonly camera: FieldCamera;
  readonly canvasSize: SharedValue<FieldViewportSize>;
  readonly template: StandardFootballFieldTemplate;
  readonly paths: FieldPaths;
  readonly palette: FieldRenderPalette;
  readonly perspective: FieldCameraPerspective;
  readonly livePosition: SharedValue<FieldPoint | null>;
  readonly targetPosition?: FieldPoint;
  readonly drillScene?: DrillRenderScene;
  readonly guidanceVisible: boolean;
  readonly anchors: readonly FieldAnchorGeometry[];
  readonly anchorOverlayOptions: FieldAnchorOverlayOptions;
  readonly showPerimeterStepGrid: boolean;
  readonly showAuxiliaryFieldMarks: boolean;
}

export function FieldScene({
  camera,
  canvasSize,
  template,
  paths,
  palette,
  perspective,
  livePosition,
  targetPosition,
  drillScene,
  guidanceVisible,
  anchors,
  anchorOverlayOptions,
  showPerimeterStepGrid,
  showAuxiliaryFieldMarks,
}: FieldSceneProps) {
  const cameraTransform = useDerivedValue(() => {
    const scale = 1 / camera.metersPerPixel.value;
    const performerView = perspective === "performer";
    return [
      { translateX: canvasSize.value.width / 2 },
      { translateY: canvasSize.value.height / 2 },
      { scaleX: performerView ? -scale : scale },
      { scaleY: performerView ? scale : -scale },
      { translateX: -camera.centerXMeters.value },
      { translateY: -camera.centerYMeters.value },
    ];
  });

  return (
    <Group transform={cameraTransform}>
      <FieldStaticLayer
        template={template}
        paths={paths}
        metersPerPixel={camera.metersPerPixel}
        palette={palette}
        perspective={perspective}
        showPerimeterStepGrid={showPerimeterStepGrid}
        showAuxiliaryFieldMarks={showAuxiliaryFieldMarks}
      />
      <FieldAnchorLayer
        anchors={anchors}
        options={anchorOverlayOptions}
        metersPerPixel={camera.metersPerPixel}
        palette={palette}
      />
      <FieldDrillLayer
        scene={drillScene}
        fallbackTargetPosition={targetPosition}
        metersPerPixel={camera.metersPerPixel}
        palette={palette}
        perspective={perspective}
      />
      {guidanceVisible && targetPosition ? (
        <FieldGuidanceLayer
          livePosition={livePosition}
          targetPosition={targetPosition}
          metersPerPixel={camera.metersPerPixel}
          color={palette.guidance}
        />
      ) : null}
      <FieldPositionLayer
        livePosition={livePosition}
        metersPerPixel={camera.metersPerPixel}
        palette={palette}
      />
    </Group>
  );
}
