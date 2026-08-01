import React from "react";
import { useFocusEffect } from "expo-router";
import { useWindowDimensions } from "react-native";
import type { FieldViewport } from "@eight2five/mobile/field";
import type { Drill, DrillPage } from "@eight2five/mobile/drill";

import { useFieldOrientation } from "../../navigation/use-field-orientation";
import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";

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
  const [activeDrill, setActiveDrill] = React.useState<Drill>();
  const [pages, setPages] = React.useState<readonly DrillPage[]>([]);
  const [loadingDrills, setLoadingDrills] = React.useState(true);
  const [fieldError, setFieldError] = React.useState<Error>();
  const [selectionBusy, setSelectionBusy] = React.useState(false);
  const refreshGeneration = React.useRef(0);
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
      const [nextDrills, nextActiveDrill, nextPages] = await Promise.all([
        repository.listDrills(),
        activeDrillId ? repository.getDrill(activeDrillId) : undefined,
        activeDrillId ? repository.listPages(activeDrillId) : [],
      ]);
      if (generation !== refreshGeneration.current) return;
      setDrills(nextDrills);
      setActiveDrill(nextActiveDrill);
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

  const selectedIndex = pages.findIndex(
    (page) => page.id === snapshot.settings.selectedDrillPageId,
  );
  const selectedPage = selectedIndex >= 0 ? pages[selectedIndex] : undefined;

  return {
    width,
    height,
    landscape: orientation.landscape,
    defaultViewport: initialViewport,
    commitViewport,
    settingsStatus: snapshot.status,
    settings: snapshot.settings,
    drills,
    activeDrill,
    pages,
    selectedIndex,
    selectedPage,
    previousPage: selectedIndex > 0 ? pages[selectedIndex - 1] : undefined,
    loadingDrills,
    selectionBusy,
    error: fieldError ?? snapshot.error,
    selectActiveDrill,
    toggleMetricMode,
    refreshDrills,
  } as const;
}

export function resetFieldViewportSessionForTests(): void {
  committedFieldViewport = undefined;
}
