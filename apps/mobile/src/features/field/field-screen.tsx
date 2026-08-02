import React from "react";
import {
  EMPTY_FIELD_LIVE_POSITION_STATE,
  drillGridPointToFieldPoint,
  shouldShowFieldGuidance,
  shouldShowFieldTarget,
  type FieldAnchorGeometry,
  type FieldAnchorOverlayOptions,
  type FieldLivePositionInput,
  type FieldPoint,
} from "@eight2five/mobile/field";
import { formatSetName } from "@eight2five/mobile/drill";
import {
  FIELD_FIVE_YARD_GRID_COLOR,
  FieldCanvas,
} from "@eight2five/mobile/field/render";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { FieldOverlayLayout } from "./field-overlay-layout";
import { useFieldScreenController } from "./use-field-screen-controller";
import { CoordinatePanel } from "./coordinate-panel/coordinate-panel";
import { areCoordinatePanelControlsDisabled } from "./coordinate-panel/coordinate-panel-state";
import { PageDial } from "./page-dial/page-dial";

const EMPTY_ANCHORS: readonly FieldAnchorGeometry[] = Object.freeze([]);

function setLivePositionValue(
  sharedValue: SharedValue<FieldPoint | null>,
  position: FieldPoint | null,
): void {
  sharedValue.value = position;
}

export function FieldScreen({
  livePosition,
  anchors = EMPTY_ANCHORS,
  anchorOverlayOptions,
}: {
  readonly livePosition?: FieldLivePositionInput;
  readonly anchors?: readonly FieldAnchorGeometry[];
  readonly anchorOverlayOptions?: FieldAnchorOverlayOptions;
}) {
  const theme = useEight2FiveTheme();
  const controller = useFieldScreenController();
  const liveState = livePosition?.state ?? EMPTY_FIELD_LIVE_POSITION_STATE;
  const fallbackLivePosition = useSharedValue<FieldPoint | null>(
    liveState.position ?? null,
  );
  const livePositionValue = livePosition?.positionValue ?? fallbackLivePosition;
  const liveXMeters = liveState.position?.xMeters;
  const liveYMeters = liveState.position?.yMeters;
  React.useEffect(() => {
    if (livePosition?.positionValue) return;
    setLivePositionValue(
      fallbackLivePosition,
      liveXMeters === undefined || liveYMeters === undefined
        ? null
        : { xMeters: liveXMeters, yMeters: liveYMeters },
    );
  }, [
    fallbackLivePosition,
    livePosition?.positionValue,
    liveXMeters,
    liveYMeters,
  ]);
  const drillOverlayState = {
    drillFeaturesEnabled: controller.settings.drillFeaturesEnabled,
    hasActiveDrill: Boolean(controller.activeDrill),
    hasSelectedPage: Boolean(controller.selectedPage),
    hasLivePosition: Boolean(liveState.position) && !liveState.isStale,
    guidanceEnabled: controller.settings.guidanceEnabled,
  };
  const targetPosition =
    shouldShowFieldTarget(drillOverlayState) && controller.selectedPage
      ? drillGridPointToFieldPoint(controller.selectedPage.position)
      : undefined;
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
      anchor: theme.accent,
      anchorRange: colorWithAlpha(theme.accent, "24"),
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
          livePosition={livePositionValue}
          targetPosition={targetPosition}
          guidanceVisible={shouldShowFieldGuidance(drillOverlayState)}
          anchors={anchors}
          anchorOverlayOptions={anchorOverlayOptions}
        />
      }
      hud={
        <CoordinatePanel
          landscape={controller.landscape}
          live={liveState}
          drillFeaturesEnabled={controller.settings.drillFeaturesEnabled}
          drills={controller.drills}
          activeDrill={controller.activeDrill}
          selectedPage={controller.selectedPage}
          previousPage={controller.previousPage}
          terminology="sets"
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
                selectedLabel={
                  controller.selectedPage
                    ? formatSetName(controller.selectedPage)
                    : undefined
                }
                pageCount={controller.pages.length}
                terminology="sets"
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

function colorWithAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}
