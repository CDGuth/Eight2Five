import React from "react";
import { useFocusEffect } from "expo-router";
import {
  getDrillTerms,
  type Drill,
  type DrillPage,
} from "@eight2five/mobile/drill";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  createNamedDrill,
  deleteDrillAndRefreshSettings,
  renameNamedDrill,
  toError,
} from "./drill-management";
import {
  deletePageAndRefreshSettings,
  movePage,
  type PageMoveDirection,
} from "./page-management";

export function useDrillEditorController(drillId?: string) {
  const snapshot = useAppSettingsSnapshot();
  const store = useAppSettingsStore();
  const [drill, setDrill] = React.useState<Drill>();
  const [pages, setPages] = React.useState<readonly DrillPage[]>([]);
  const [loading, setLoading] = React.useState(Boolean(drillId));
  const [saving, setSaving] = React.useState(false);
  const [busyPageId, setBusyPageId] = React.useState<string>();
  const [error, setError] = React.useState<Error>();
  const operationInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (!drillId || snapshot.status !== "ready") return;
    try {
      const repository = store.getDrillRepository();
      const [nextDrill, nextPages] = await Promise.all([
        repository.getDrill(drillId),
        repository.listPages(drillId),
      ]);
      if (!nextDrill) throw new Error("This drill no longer exists.");
      setDrill(nextDrill);
      setPages(nextPages);
      setError(undefined);
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setLoading(false);
    }
  }, [drillId, snapshot.status, store]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const saveName = React.useCallback(
    async (name: string) => {
      if (operationInFlight.current) {
        throw new Error("A save is already in progress.");
      }
      operationInFlight.current = true;
      setSaving(true);
      setError(undefined);
      try {
        const repository = store.getDrillRepository();
        const saved = drillId
          ? await renameNamedDrill(repository, drillId, name)
          : await createNamedDrill(repository, name);
        setDrill(saved);
        return saved;
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        operationInFlight.current = false;
        setSaving(false);
      }
    },
    [drillId, store],
  );

  const makeActive = React.useCallback(async () => {
    if (!drillId) return;
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await store.setActiveDrill(drillId);
    } catch (cause) {
      const operationError = toError(cause);
      setError(operationError);
      throw operationError;
    } finally {
      operationInFlight.current = false;
      setSaving(false);
    }
  }, [drillId, store]);

  const remove = React.useCallback(async () => {
    if (!drillId) return;
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await deleteDrillAndRefreshSettings(
        store.getDrillRepository(),
        drillId,
        () => store.reload(),
      );
    } catch (cause) {
      const operationError = toError(cause);
      setError(operationError);
      throw operationError;
    } finally {
      operationInFlight.current = false;
      setSaving(false);
    }
  }, [drillId, store]);

  const selectPage = React.useCallback(
    async (page: DrillPage) => {
      if (snapshot.settings.activeDrillId !== drillId) {
        const operationError = new Error(
          "Make this drill active before selecting one of its entries.",
        );
        setError(operationError);
        throw operationError;
      }
      if (operationInFlight.current) return;
      operationInFlight.current = true;
      setBusyPageId(page.id);
      setError(undefined);
      try {
        await store.setSelectedDrillPage(page.id);
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        operationInFlight.current = false;
        setBusyPageId(undefined);
      }
    },
    [drillId, snapshot.settings.activeDrillId, store],
  );

  const move = React.useCallback(
    async (page: DrillPage, direction: PageMoveDirection) => {
      if (!drillId || operationInFlight.current) return;
      operationInFlight.current = true;
      setBusyPageId(page.id);
      setError(undefined);
      try {
        setPages(
          await movePage(
            store.getDrillRepository(),
            drillId,
            pages,
            page.id,
            direction,
          ),
        );
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        operationInFlight.current = false;
        setBusyPageId(undefined);
      }
    },
    [drillId, pages, store],
  );

  const removePage = React.useCallback(
    async (page: DrillPage) => {
      if (!drillId || operationInFlight.current) return;
      operationInFlight.current = true;
      setBusyPageId(page.id);
      setError(undefined);
      try {
        await deletePageAndRefreshSettings(
          store.getDrillRepository(),
          page.id,
          () => store.reload(),
        );
        setPages(await store.getDrillRepository().listPages(drillId));
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        operationInFlight.current = false;
        setBusyPageId(undefined);
      }
    },
    [drillId, store],
  );

  return {
    drillId,
    drill,
    pages,
    loading: snapshot.status === "loading" || loading,
    saving,
    busyPageId,
    active: snapshot.settings.activeDrillId === drillId,
    selectedPageId: snapshot.settings.selectedDrillPageId,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    error: error ?? snapshot.error,
    refresh,
    saveName,
    makeActive,
    remove,
    selectPage,
    move,
    removePage,
  } as const;
}
