import React from "react";
import {
  EMPTY_FIELD_LIVE_POSITION_STATE,
  drillGridPointToFieldPoint,
  shouldShowFieldGuidanceForScene,
  shouldShowFieldTarget,
  resolveCurrentTargetPosition,
  type FieldAnchorGeometry,
  type FieldAnchorOverlayOptions,
  type FieldLivePositionInput,
  type FieldPoint,
} from "@eight2five/mobile/field";
import { formatSetName, getDrillTerms } from "@eight2five/mobile/drill";
import {
  FIELD_FOUR_STEP_GRID_COLOR,
  FieldCanvas,
} from "@eight2five/mobile/field/render";
import { useEight2FiveTheme } from "@eight2five/ui/theme";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { FieldOverlayLayout } from "./field-overlay-layout";
import { useFieldScreenController } from "./use-field-screen-controller";
import { DrillSelectionDialog } from "../drill/components/drill-selection-dialog";
import { PerformerSelectionDialog } from "../drill/components/performer-selection-dialog";
import { DrillPill } from "./drill-pill/drill-pill";
import {
  INITIAL_FIELD_HUD_STATE,
  reduceFieldHudState,
} from "./field-hud-state";
import { LiveOnlyPill, LivePositionSquare } from "./live-position-hud";
import { PageDial } from "./page-dial/page-dial";
import { TagConnectionDialog } from "./tag-connection-dialog";

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
  const [hudState, dispatchHud] = React.useReducer(
    reduceFieldHudState,
    INITIAL_FIELD_HUD_STATE,
  );
  const [drillDialogOpen, setDrillDialogOpen] = React.useState(false);
  const [performerDialogOpen, setPerformerDialogOpen] = React.useState(false);
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const pansLiveState = livePosition?.state ?? EMPTY_FIELD_LIVE_POSITION_STATE;
  const mockLivePositionEnabled =
    controller.settings.developerModeEnabled &&
    controller.settings.mockLivePositionEnabled;
  const mockPosition = React.useMemo(
    () =>
      mockLivePositionEnabled
        ? drillGridPointToFieldPoint(
            {
              xSteps: controller.settings.mockLivePositionXSteps,
              ySteps: controller.settings.mockLivePositionYSteps,
            },
            controller.fieldPreset,
          )
        : null,
    [
      controller.fieldPreset,
      controller.settings.mockLivePositionXSteps,
      controller.settings.mockLivePositionYSteps,
      mockLivePositionEnabled,
    ],
  );
  const liveState = mockPosition
    ? {
        ...pansLiveState,
        position: mockPosition,
        isStale: false,
        interpolationActive: false,
      }
    : pansLiveState;
  const fallbackLivePosition = useSharedValue<FieldPoint | null>(
    pansLiveState.position ?? null,
  );
  const mockLivePosition = useSharedValue<FieldPoint | null>(mockPosition);
  const livePositionValue = mockLivePositionEnabled
    ? mockLivePosition
    : (livePosition?.positionValue ?? fallbackLivePosition);
  const liveXMeters = pansLiveState.position?.xMeters;
  const liveYMeters = pansLiveState.position?.yMeters;
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
  React.useEffect(() => {
    setLivePositionValue(mockLivePosition, mockPosition);
  }, [mockLivePosition, mockPosition]);
  const activeDrillId = controller.settings.activeDrillId;
  React.useEffect(() => {
    dispatchHud({ type: "collapse-drill-pill" });
  }, [activeDrillId]);
  const drillOverlayState = {
    drillFeaturesEnabled: controller.settings.drillFeaturesEnabled,
    hasActiveDrill: Boolean(controller.activeDrill),
    hasSelectedPage: Boolean(controller.selectedPage),
    hasLivePosition: Boolean(liveState.position) && !liveState.isStale,
    guidanceEnabled: controller.settings.guidanceEnabled,
  };
  const fallbackTargetPosition =
    shouldShowFieldTarget(drillOverlayState) && controller.selectedPage
      ? drillGridPointToFieldPoint(
          controller.selectedPage.position,
          controller.fieldPreset,
        )
      : undefined;
  const drillScene = controller.settings.drillFeaturesEnabled
    ? controller.drillScene
    : undefined;
  const targetPolicy = {
    fullDrillSceneAvailable: drillScene !== undefined,
    sceneHasCurrent:
      drillScene?.current !== undefined && drillScene?.current !== null,
    legacyFallbackAvailable: fallbackTargetPosition !== undefined,
  } as const;
  const targetPosition = resolveCurrentTargetPosition({
    fullDrillSceneAvailable: targetPolicy.fullDrillSceneAvailable,
    sceneCurrent: drillScene?.current,
    legacyFallback: fallbackTargetPosition,
  });
  const guidanceVisible = shouldShowFieldGuidanceForScene(
    drillOverlayState,
    targetPolicy,
  );
  const controlsDisabled =
    controller.settingsStatus !== "ready" ||
    controller.loadingDrills ||
    controller.selectionBusy;
  const canExpandDrillPill = Boolean(
    controller.activeDrill && controller.pages.length > 0,
  );
  const terms = getDrillTerms(controller.settings.drillTerminology);
  const palette = React.useMemo(
    () => ({
      canvasBackground: theme.background,
      stepGrid: theme.textSubtle,
      fieldBackground: theme.surfaceRaised,
      fourStepGrid: FIELD_FOUR_STEP_GRID_COLOR,
      fieldLines: theme.textMuted,
      fieldNumbers: theme.textMuted,
      livePosition: theme.accent,
      guidance: theme.accent,
      anchor: theme.accent,
      anchorRange: colorWithAlpha(theme.accent, "24"),
    }),
    [theme],
  );

  return (
    <>
      <FieldOverlayLayout
        width={controller.width}
        height={controller.height}
        landscape={controller.landscape}
        controlPairVisible={controller.settings.drillFeaturesEnabled}
        field={
          <FieldCanvas
            defaultViewport={controller.defaultViewport}
            onViewportChange={controller.commitViewport}
            palette={palette}
            fieldPreset={controller.fieldPreset}
            livePosition={livePositionValue}
            targetPosition={targetPosition}
            drillScene={drillScene}
            guidanceVisible={guidanceVisible}
            anchors={anchors}
            anchorOverlayOptions={anchorOverlayOptions}
            showAuxiliaryFieldMarks={
              controller.settings.showAuxiliaryFieldMarks
            }
            showPerimeterStepGrid={
              controller.settings.developerModeEnabled &&
              controller.settings.showPerimeterStepGrid
            }
          />
        }
        hud={(metrics) =>
          controller.settings.drillFeaturesEnabled ? (
            <DrillPill
              width={metrics.hudWidth}
              landscape={controller.landscape}
              listMaxHeight={metrics.hudListMaxHeight}
              pages={controller.pages}
              selectedIndex={controller.selectedIndex}
              terminology={controller.settings.drillTerminology}
              countDisplayMode={hudState.countDisplayMode}
              metricMode={controller.settings.transitionMetricMode}
              fieldPreset={controller.fieldPreset}
              expanded={canExpandDrillPill && hudState.drillPillExpanded}
              controlsDisabled={controlsDisabled}
              error={controller.error}
              onToggleCounts={() =>
                dispatchHud({ type: "toggle-count-display" })
              }
              onToggleMetric={() => void controller.toggleMetricMode()}
              onToggleExpanded={
                canExpandDrillPill
                  ? () => dispatchHud({ type: "toggle-drill-pill" })
                  : undefined
              }
              onSelectIndex={(index) =>
                void controller.selectPageAtIndex(index)
              }
            />
          ) : (
            <LiveOnlyPill
              width={metrics.hudWidth}
              live={liveState}
              fieldPreset={controller.fieldPreset}
              onOpenTagConnection={() => setTagDialogOpen(true)}
            />
          )
        }
        live={
          controller.settings.drillFeaturesEnabled
            ? (diameter) => (
                <LivePositionSquare
                  diameter={diameter}
                  live={liveState}
                  target={targetPosition}
                  fieldPreset={controller.fieldPreset}
                  greenThresholdSteps={
                    controller.settings.distanceGreenThresholdSteps
                  }
                  yellowThresholdSteps={
                    controller.settings.distanceYellowThresholdSteps
                  }
                  onOpenTagConnection={() => setTagDialogOpen(true)}
                />
              )
            : undefined
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
                  terminology={controller.settings.drillTerminology}
                  activeColor={theme.accent}
                  trackColor={theme.border}
                  foregroundColor={theme.text}
                  onSelectIndex={(index) =>
                    void controller.selectPageAtIndex(index)
                  }
                  onSelectDrill={() => setDrillDialogOpen(true)}
                  onSelectPerformer={
                    controller.activeDrillDocument
                      ? () => setPerformerDialogOpen(true)
                      : undefined
                  }
                />
              )
            : undefined
        }
      />
      <DrillSelectionDialog
        entries={controller.drillEntries}
        terms={terms}
        activeDrillId={controller.settings.activeDrillId}
        isOpen={controller.settings.drillFeaturesEnabled && drillDialogOpen}
        disabled={controlsDisabled}
        onClose={() => setDrillDialogOpen(false)}
        onSelect={(drillId) => {
          setDrillDialogOpen(false);
          void controller.selectActiveDrill(drillId);
        }}
      />
      <PerformerSelectionDialog
        key={`field-performer:${controller.activeDrill?.id ?? "none"}:${controller.activeDrill?.selectedPerformerEntityId ?? "none"}`}
        document={controller.activeDrillDocument}
        isOpen={controller.settings.drillFeaturesEnabled && performerDialogOpen}
        importing={controller.selectionBusy}
        error={controller.error}
        selectedPerformerEntityId={
          controller.activeDrill?.selectedPerformerEntityId
        }
        title="Select performer"
        confirmLabel="Save"
        onClose={() => setPerformerDialogOpen(false)}
        onConfirm={async (performerEntityId) => {
          const saved = await controller.selectPerformer(performerEntityId);
          if (saved) setPerformerDialogOpen(false);
        }}
      />
      <TagConnectionDialog
        isOpen={tagDialogOpen}
        onClose={() => setTagDialogOpen(false)}
      />
    </>
  );
}

function colorWithAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}
