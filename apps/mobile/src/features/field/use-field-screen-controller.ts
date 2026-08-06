import React from "react";
import { useFocusEffect } from "expo-router";
import { useWindowDimensions } from "react-native";
import type { FieldViewport } from "@eight2five/mobile/field";
import {
  buildDrillRenderScene,
  resolveSelectedSourceSetId,
  shouldBuildDrillRenderScene,
  type Drill,
  type DrillDocument,
  type DrillSet,
  type DrillRenderScene,
} from "@eight2five/mobile/drill";

import { useFieldOrientation } from "../../navigation/use-field-orientation";
import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import { resolveEffectiveFieldPreset } from "./effective-field-preset";

let committedFieldViewport: FieldViewport | undefined;

/**
 * Owns viewport commits outside the renderer. The module-level session value is
 * deliberate: native-tab presentation changes may remount the route, but they
 * must not reset the performer's field center or zoom.
 */
export function useFieldScreenController() {
  const orientation = useFieldOrientation();
  const { width, height } = useWindowDimensions();
  const snapshot = useAppSettingsSnapshot();
  const store = useAppSettingsStore();
  const [initialViewport] = React.useState(() => committedFieldViewport);
  const [drills, setDrills] = React.useState<readonly Drill[]>([]);
  const [drillEntries, setDrillEntries] = React.useState<
    readonly { readonly drill: Drill; readonly pageCount: number }[]
  >([]);
  const [activeDrill, setActiveDrill] = React.useState<Drill>();
  const [activeDrillDocument, setActiveDrillDocument] =
    React.useState<DrillDocument>();
  const [pages, setPages] = React.useState<readonly DrillSet[]>([]);
  const [loadingDrills, setLoadingDrills] = React.useState(true);
  const [fieldError, setFieldError] = React.useState<Error>();
  const [selectionBusy, setSelectionBusy] = React.useState(false);
  const [optimisticSelection, setOptimisticSelection] = React.useState<{
    readonly activeDrillId: string | null;
    readonly pageId: string;
  }>();
  const refreshGeneration = React.useRef(0);
  const pageSelectionGeneration = React.useRef(0);
  const commitViewport = React.useCallback((viewport: FieldViewport) => {
    committedFieldViewport = viewport;
  }, []);

  const refreshDrills = React.useCallback(async () => {
    if (snapshot.status !== "ready") return;
    const generation = ++refreshGeneration.current;
    setLoadingDrills(true);
    try {
      const repository = store.getDrillRepository();
      const activeDrillId = snapshot.settings.activeDrillId;
      const nextDrills = await repository.listDrills();
      const [nextActiveDrill, nextPages, nextDocument, pageCounts] =
        await Promise.all([
          activeDrillId ? repository.getDrill(activeDrillId) : undefined,
          activeDrillId ? repository.listSets(activeDrillId) : [],
          activeDrillId
            ? repository.getDrillDocument(activeDrillId)
            : undefined,
          Promise.all(
            nextDrills.map(async (drill) => ({
              drill,
              pageCount: (await repository.listSets(drill.id)).length,
            })),
          ),
        ]);
      if (generation !== refreshGeneration.current) return;
      setDrills(nextDrills);
      setDrillEntries(pageCounts);
      setActiveDrill(nextActiveDrill);
      setActiveDrillDocument(nextDocument);
      setPages(nextPages);
      setFieldError(undefined);
    } catch (cause) {
      if (generation !== refreshGeneration.current) return;
      setFieldError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      if (generation === refreshGeneration.current) setLoadingDrills(false);
    }
  }, [snapshot.settings.activeDrillId, snapshot.status, store]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshDrills();
    }, [refreshDrills]),
  );

  const selectActiveDrill = React.useCallback(
    async (drillId: string | null) => {
      if (selectionBusy || snapshot.status !== "ready") return;
      setSelectionBusy(true);
      setFieldError(undefined);
      try {
        await store.setActiveDrill(drillId);
      } catch (cause) {
        setFieldError(
          cause instanceof Error ? cause : new Error(String(cause)),
        );
      } finally {
        setSelectionBusy(false);
      }
    },
    [selectionBusy, snapshot.status, store],
  );

  const toggleMetricMode = React.useCallback(async () => {
    if (snapshot.status !== "ready") return;
    try {
      await store.update({
        transitionMetricMode:
          snapshot.settings.transitionMetricMode === "step-size"
            ? "crossing-counts"
            : "step-size",
      });
    } catch (cause) {
      setFieldError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }, [snapshot.settings.transitionMetricMode, snapshot.status, store]);

  const toggleCountDisplayMode = React.useCallback(async () => {
    if (snapshot.status !== "ready") return;
    try {
      await store.update({
        countDisplayMode:
          snapshot.settings.countDisplayMode === "counts"
            ? "measures"
            : "counts",
      });
    } catch (cause) {
      setFieldError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }, [snapshot.settings.countDisplayMode, snapshot.status, store]);

  const selectPageAtIndex = React.useCallback(
    async (index: number) => {
      const page = pages[index];
      if (!page || snapshot.status !== "ready") return;
      const generation = ++pageSelectionGeneration.current;
      setOptimisticSelection({
        activeDrillId: snapshot.settings.activeDrillId,
        pageId: page.id,
      });
      setFieldError(undefined);
      try {
        await store.setSelectedDrillSet(page.id);
        if (generation === pageSelectionGeneration.current) {
          setOptimisticSelection(undefined);
        }
      } catch (cause) {
        if (generation === pageSelectionGeneration.current) {
          setOptimisticSelection(undefined);
          setFieldError(
            cause instanceof Error ? cause : new Error(String(cause)),
          );
        }
      }
    },
    [pages, snapshot.settings.activeDrillId, snapshot.status, store],
  );

  const selectPerformer = React.useCallback(
    async (performerEntityId: number) => {
      if (!activeDrill || selectionBusy || snapshot.status !== "ready") {
        return false;
      }
      setSelectionBusy(true);
      setFieldError(undefined);
      try {
        await store
          .getDrillRepository()
          .setSelectedPerformer(activeDrill.id, performerEntityId);
        await refreshDrills();
        return true;
      } catch (cause) {
        setFieldError(
          cause instanceof Error ? cause : new Error(String(cause)),
        );
        return false;
      } finally {
        setSelectionBusy(false);
      }
    },
    [activeDrill, refreshDrills, selectionBusy, snapshot.status, store],
  );

  const effectiveSelectedPageId =
    optimisticSelection?.activeDrillId === snapshot.settings.activeDrillId
      ? optimisticSelection.pageId
      : snapshot.settings.selectedDrillSetId;
  const selectedIndex = pages.findIndex(
    (page) => page.id === effectiveSelectedPageId,
  );
  const selectedPage = selectedIndex >= 0 ? pages[selectedIndex] : undefined;
  const fieldPreset = resolveEffectiveFieldPreset(
    activeDrill,
    snapshot.settings.defaultFieldPreset,
  );
  const selectedSourceSetId = resolveSelectedSourceSetId(selectedPage);
  const selectedPerformerEntityId = activeDrill?.selectedPerformerEntityId;
  const drillScene = React.useMemo<DrillRenderScene | undefined>(() => {
    if (
      !shouldBuildDrillRenderScene(snapshot.settings.drillFeaturesEnabled) ||
      !activeDrillDocument ||
      selectedSourceSetId === undefined ||
      selectedPerformerEntityId === undefined
    ) {
      return undefined;
    }
    return buildDrillRenderScene({
      document: activeDrillDocument,
      field: fieldPreset,
      selectedPerformerEntityId,
      selectedSourceSetId,
      settings: {
        showPerformerLabels: snapshot.settings.showPerformerLabels,
        showPerformerNames: snapshot.settings.showPerformerNames,
        showPropLabels: snapshot.settings.showPropLabels,
        showPropNames: snapshot.settings.showPropNames,
        markerEnabled: snapshot.settings.showTransitionMarkers,
        showAll: snapshot.settings.showAllTransitionSets,
        previousTotalCount: snapshot.settings.previousTransitionSetCount,
        nextTotalCount: snapshot.settings.nextTransitionSetCount,
      },
    });
  }, [
    activeDrillDocument,
    fieldPreset,
    selectedPerformerEntityId,
    selectedSourceSetId,
    snapshot.settings.nextTransitionSetCount,
    snapshot.settings.previousTransitionSetCount,
    snapshot.settings.drillFeaturesEnabled,
    snapshot.settings.showAllTransitionSets,
    snapshot.settings.showPerformerLabels,
    snapshot.settings.showPerformerNames,
    snapshot.settings.showPropLabels,
    snapshot.settings.showPropNames,
    snapshot.settings.showTransitionMarkers,
  ]);

  return {
    width,
    height,
    landscape: orientation.landscape,
    defaultViewport: initialViewport,
    commitViewport,
    settingsStatus: snapshot.status,
    settings: snapshot.settings,
    drills,
    drillEntries,
    activeDrill,
    activeDrillDocument,
    drillScene,
    pages,
    selectedIndex,
    selectedPage,
    previousPage: selectedIndex > 0 ? pages[selectedIndex - 1] : undefined,
    fieldPreset,
    loadingDrills,
    selectionBusy,
    error: fieldError ?? snapshot.error,
    selectActiveDrill,
    toggleMetricMode,
    toggleCountDisplayMode,
    selectPageAtIndex,
    selectPerformer,
    refreshDrills,
  } as const;
}

export function resetFieldViewportSessionForTests(): void {
  committedFieldViewport = undefined;
}
