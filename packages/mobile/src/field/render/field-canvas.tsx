import React from "react";
import {
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Canvas, Fill } from "@shopify/react-native-skia";
import { GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { setFieldCamera } from "../camera/field-camera-math";
import type { FieldPresetId } from "@eight2five/drill-schema";

import {
  createStandardFootballFieldTemplate,
  type StandardFootballFieldTemplate,
} from "../template";
import type { FieldPoint } from "../types";
import {
  getFieldCameraBounds,
  getFieldGridBounds,
  getInitialFieldViewport,
} from "../camera/field-camera-policy";
import type {
  FieldCamera,
  FieldViewport,
  FieldViewportSize,
} from "../camera/field-camera-types";
import { useFieldGestures } from "../camera/use-field-gestures";
import { createFieldPaths } from "./create-field-paths";
import { FieldScene } from "./field-scene";
import {
  HIDDEN_FIELD_ANCHOR_OVERLAY,
  type FieldAnchorGeometry,
  type FieldAnchorOverlayOptions,
} from "./field-overlay-types";
import {
  DEFAULT_FIELD_RENDER_PALETTE,
  type FieldRenderPalette,
} from "./field-render-tokens";

export interface FieldCanvasProps {
  readonly template?: StandardFootballFieldTemplate;
  readonly fieldPreset?: FieldPresetId;
  readonly camera?: FieldCamera;
  readonly defaultViewport?: FieldViewport;
  readonly onViewportChange?: (viewport: FieldViewport) => void;
  readonly palette?: FieldRenderPalette;
  readonly livePosition?: SharedValue<FieldPoint | null>;
  readonly targetPosition?: FieldPoint;
  readonly guidanceVisible?: boolean;
  readonly anchors?: readonly FieldAnchorGeometry[];
  readonly anchorOverlayOptions?: FieldAnchorOverlayOptions;
  readonly showPerimeterStepGrid?: boolean;
  readonly showAuxiliaryFieldMarks?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

const EMPTY_FIELD_ANCHORS: readonly FieldAnchorGeometry[] = Object.freeze([]);

export function FieldCanvas({
  template: explicitTemplate,
  fieldPreset = "football-nfhs",
  camera: externalCamera,
  defaultViewport,
  onViewportChange,
  palette = DEFAULT_FIELD_RENDER_PALETTE,
  livePosition: externalLivePosition,
  targetPosition,
  guidanceVisible = false,
  anchors = EMPTY_FIELD_ANCHORS,
  anchorOverlayOptions = HIDDEN_FIELD_ANCHOR_OVERLAY,
  showPerimeterStepGrid = false,
  showAuxiliaryFieldMarks = true,
  style,
  testID = "field-canvas",
}: FieldCanvasProps) {
  const template = React.useMemo(
    () => explicitTemplate ?? createStandardFootballFieldTemplate(fieldPreset),
    [explicitTemplate, fieldPreset],
  );
  const midpoint = {
    xMeters: (template.bounds.minXMeters + template.bounds.maxXMeters) / 2,
    yMeters: (template.bounds.minYMeters + template.bounds.maxYMeters) / 2,
  };
  const centerXMeters = useSharedValue(
    defaultViewport?.centerXMeters ?? midpoint.xMeters,
  );
  const centerYMeters = useSharedValue(
    defaultViewport?.centerYMeters ?? midpoint.yMeters,
  );
  const metersPerPixel = useSharedValue(
    defaultViewport?.metersPerPixel ?? 0.12,
  );
  const internalCamera = React.useMemo<FieldCamera>(
    () => ({ centerXMeters, centerYMeters, metersPerPixel }),
    [centerXMeters, centerYMeters, metersPerPixel],
  );
  const camera = externalCamera ?? internalCamera;
  const canvasSize = useSharedValue<FieldViewportSize>({ width: 0, height: 0 });
  const emptyLivePosition = useSharedValue<FieldPoint | null>(null);
  const livePosition = externalLivePosition ?? emptyLivePosition;
  const initialized = React.useRef(Boolean(externalCamera || defaultViewport));
  const paths = React.useMemo(() => createFieldPaths(template), [template]);
  const cameraBounds = React.useMemo(
    () => getFieldCameraBounds(template),
    [template],
  );
  const gridBounds = React.useMemo(
    () => getFieldGridBounds(template),
    [template],
  );
  const { gesture } = useFieldGestures({
    camera,
    canvasSize,
    cameraBounds,
    gridBounds,
    onViewportChange,
    testID,
  });

  const onLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      if (initialized.current) return;
      const size = event.nativeEvent.layout;
      if (size.width <= 0 || size.height <= 0) return;
      const initial = getInitialFieldViewport(size, template);
      setFieldCamera(camera, initial);
      initialized.current = true;
      onViewportChange?.(initial);
    },
    [camera, onViewportChange, template],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Marching field"
        accessibilityHint="Pan with one finger and pinch with two fingers to inspect the field."
        onLayout={onLayout}
        style={[
          {
            flex: 1,
            overflow: "hidden",
            backgroundColor: palette.canvasBackground,
          },
          style,
        ]}
      >
        <Canvas
          style={{ flex: 1 }}
          onSize={canvasSize}
          testID={`${testID}-skia`}
        >
          <Fill color={palette.canvasBackground} />
          <FieldScene
            camera={camera}
            canvasSize={canvasSize}
            template={template}
            paths={paths}
            palette={palette}
            livePosition={livePosition}
            targetPosition={targetPosition}
            guidanceVisible={guidanceVisible}
            anchors={anchors}
            anchorOverlayOptions={anchorOverlayOptions}
            showPerimeterStepGrid={showPerimeterStepGrid}
            showAuxiliaryFieldMarks={showAuxiliaryFieldMarks}
          />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
