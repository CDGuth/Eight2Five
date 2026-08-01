import { getDrillTerms } from "@eight2five/mobile/drill";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";

/** Shared controller boundary for create and existing-drill routes. */
export function useDrillEditorController(drillId?: string) {
  const snapshot = useAppSettingsSnapshot();
  return {
    drillId,
    status: snapshot.status,
    settings: snapshot.settings,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    error: snapshot.error,
  } as const;
}
