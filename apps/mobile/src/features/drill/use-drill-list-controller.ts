import React from "react";
import { useFocusEffect } from "expo-router";
import {
  getDrillTerms,
  type Drill,
  type DrillRepository,
} from "@eight2five/mobile/drill";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  deleteDrillAndRefreshSettings,
  loadDrillList,
  renameNamedDrill,
  toError,
  type DrillListEntry,
} from "./drill-management";

export function useDrillListController() {
  const snapshot = useAppSettingsSnapshot();
  const store = useAppSettingsStore();
  const [entries, setEntries] = React.useState<readonly DrillListEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error>();
  const [busyDrillId, setBusyDrillId] = React.useState<string>();
  const mutationInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (snapshot.status !== "ready") return;
    try {
      setEntries(await loadDrillList(store.getDrillRepository()));
      setError(undefined);
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setLoading(false);
    }
  }, [snapshot.status, store]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const mutate = React.useCallback(
    async <T>(
      drillId: string,
      operation: (repository: DrillRepository) => Promise<T>,
    ) => {
      if (mutationInFlight.current) {
        throw new Error("Another drill update is in progress.");
      }
      mutationInFlight.current = true;
      setBusyDrillId(drillId);
      setError(undefined);
      try {
        const result = await operation(store.getDrillRepository());
        await refresh();
        return result;
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        mutationInFlight.current = false;
        setBusyDrillId(undefined);
      }
    },
    [refresh, store],
  );

  const rename = React.useCallback(
    async (drill: Drill, name: string) =>
      await mutate(drill.id, (repository) =>
        renameNamedDrill(repository, drill.id, name),
      ),
    [mutate],
  );

  const makeActive = React.useCallback(
    async (drill: Drill) => {
      if (mutationInFlight.current) {
        throw new Error("Another drill update is in progress.");
      }
      mutationInFlight.current = true;
      setBusyDrillId(drill.id);
      setError(undefined);
      try {
        await store.setActiveDrill(drill.id);
      } catch (cause) {
        const operationError = toError(cause);
        setError(operationError);
        throw operationError;
      } finally {
        mutationInFlight.current = false;
        setBusyDrillId(undefined);
      }
    },
    [store],
  );

  const remove = React.useCallback(
    async (drill: Drill) =>
      await mutate(drill.id, async (repository) => {
        await deleteDrillAndRefreshSettings(repository, drill.id, () =>
          store.reload(),
        );
      }),
    [mutate, store],
  );

  return {
    entries,
    loading: snapshot.status === "loading" || loading,
    error: error ?? snapshot.error,
    busyDrillId,
    activeDrillId: snapshot.settings.activeDrillId,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    refresh,
    rename,
    makeActive,
    remove,
  } as const;
}
