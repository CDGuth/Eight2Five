import React from "react";
import {
  EMPTY_FIELD_LIVE_POSITION_STATE,
  type FieldLivePositionInput,
} from "@eight2five/mobile/field";
import {
  FIELD_FIVE_YARD_GRID_COLOR,
  FieldCanvas,
} from "@eight2five/mobile/field/render";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

import { FieldOverlayLayout } from "./field-overlay-layout";
import { useFieldScreenController } from "./use-field-screen-controller";
import { CoordinatePanel } from "./coordinate-panel/coordinate-panel";
import { areCoordinatePanelControlsDisabled } from "./coordinate-panel/coordinate-panel-state";
import { PageDial } from "./page-dial/page-dial";

export function FieldScreen({
  livePosition,
}: {
  readonly livePosition?: FieldLivePositionInput;
}) {
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
      hud={
        <CoordinatePanel
          landscape={controller.landscape}
          live={livePosition?.state ?? EMPTY_FIELD_LIVE_POSITION_STATE}
          drillFeaturesEnabled={controller.settings.drillFeaturesEnabled}
          drills={controller.drills}
          activeDrill={controller.activeDrill}
          selectedPage={controller.selectedPage}
          previousPage={controller.previousPage}
          terminology={controller.settings.drillTerminology}
          metricMode={controller.settings.transitionMetricMode}
          controlsDisabled={areCoordinatePanelControlsDisabled({
            settingsReady: controller.settingsStatus === "ready",
            loadingDrills: controller.loadingDrills,
            selectionBusy: controller.selectionBusy,
          })}
          error={controller.error}
          onSelectDrill={(drillId) =>
            void controller.selectActiveDrill(drillId)
          }
          onToggleMetric={() => void controller.toggleMetricMode()}
        />
      }
      dial={
        controller.settings.drillFeaturesEnabled
          ? (diameter) => (
              <PageDial
                diameter={diameter}
                selectedIndex={controller.selectedIndex}
                selectedLabel={controller.selectedPage?.label}
                pageCount={controller.pages.length}
                terminology={controller.settings.drillTerminology}
                activeColor={theme.accent}
                trackColor={FIELD_FIVE_YARD_GRID_COLOR}
                onSelectIndex={(index) =>
                  void controller.selectPageAtIndex(index)
                }
              />
            )
          : undefined
      }
    />
  );
}
