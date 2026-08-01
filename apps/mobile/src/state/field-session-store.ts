import React from "react";
import type { AppSettings } from "@eight2five/mobile/settings";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "./app-settings-store";

export interface FieldSessionSelection {
  readonly activeDrillId: string | null;
  readonly selectedDrillPageId: string | null;
}

export function selectFieldSession(
  settings: AppSettings,
): FieldSessionSelection {
  return {
    activeDrillId: settings.activeDrillId,
    selectedDrillPageId: settings.selectedDrillPageId,
  };
}

/** Persisted field-session selection facade used by Field and Drill screens. */
export function useFieldSession() {
  const store = useAppSettingsStore();
  const { status, settings } = useAppSettingsSnapshot();
  const selection = selectFieldSession(settings);

  return React.useMemo(
    () => ({
      status,
      activeDrillId: selection.activeDrillId,
      selectedDrillPageId: selection.selectedDrillPageId,
      setActiveDrill: (id: string | null) => store.setActiveDrill(id),
      setSelectedDrillPage: (id: string | null) =>
        store.setSelectedDrillPage(id),
    }),
    [selection.activeDrillId, selection.selectedDrillPageId, status, store],
  );
}
