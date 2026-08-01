import { getDrillTerms } from "@eight2five/mobile/drill";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";

/** Initial route-level contract; persistence actions are added in Phase 2. */
export function useDrillListController() {
  const snapshot = useAppSettingsSnapshot();
  return {
    status: snapshot.status,
    settings: snapshot.settings,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    error: snapshot.error,
  } as const;
}
