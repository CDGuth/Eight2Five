import React from "react";
import {
  FIELD_FIVE_YARD_GRID_COLOR,
  FieldCanvas,
} from "@eight2five/mobile/field/render";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

import { FieldOverlayLayout } from "./field-overlay-layout";
import { useFieldScreenController } from "./use-field-screen-controller";

export function FieldScreen() {
  const theme = useEight2FiveTheme();
  const controller = useFieldScreenController();
  const palette = React.useMemo(
    () => ({
      canvasBackground: theme.background,
      stepGrid: theme.textSubtle,
      fieldBackground: theme.surfaceRaised,
      fiveYardGrid: FIELD_FIVE_YARD_GRID_COLOR,
      fieldLines: theme.textMuted,
      fieldNumbers: theme.textMuted,
      livePosition: theme.accent,
      target: "#D29B22",
      guidance: theme.accent,
      anchor: theme.warning,
      anchorRange: theme.warningSoft,
    }),
    [theme],
  );

  return (
    <FieldOverlayLayout
      width={controller.width}
      height={controller.height}
      landscape={controller.landscape}
      field={
        <FieldCanvas
          defaultViewport={controller.defaultViewport}
          onViewportChange={controller.commitViewport}
          palette={palette}
        />
      }
    />
  );
}
