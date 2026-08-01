import React from "react";
import { Group } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { StandardHighSchoolFieldTemplate } from "../template";
import type {
  FieldCamera,
  FieldViewportSize,
} from "../camera/field-camera-types";
import type { FieldPaths } from "./create-field-paths";
import { FieldStaticLayer } from "./field-static-layer";
import type { FieldRenderPalette } from "./field-render-tokens";

interface FieldSceneProps {
  readonly camera: FieldCamera;
  readonly canvasSize: SharedValue<FieldViewportSize>;
  readonly template: StandardHighSchoolFieldTemplate;
  readonly paths: FieldPaths;
  readonly palette: FieldRenderPalette;
  readonly children?: React.ReactNode;
}

export function FieldScene({
  camera,
  canvasSize,
  template,
  paths,
  palette,
  children,
}: FieldSceneProps) {
  const cameraTransform = useDerivedValue(() => [
    { translateX: canvasSize.value.width / 2 },
    { translateY: canvasSize.value.height / 2 },
    { scaleX: 1 / camera.metersPerPixel.value },
    { scaleY: -1 / camera.metersPerPixel.value },
    { translateX: -camera.centerXMeters.value },
    { translateY: -camera.centerYMeters.value },
  ]);

  return (
    <Group transform={cameraTransform}>
      <FieldStaticLayer
        template={template}
        paths={paths}
        metersPerPixel={camera.metersPerPixel}
        palette={palette}
      />
      {children}
    </Group>
  );
}
