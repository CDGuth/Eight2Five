import { getDrillTerms } from "@eight2five/mobile/drill";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";

/** Controller boundary for append, insert, and existing-page edit routes. */
export function usePageEditorController(drillId: string, pageId: string) {
  const snapshot = useAppSettingsSnapshot();
  return {
    drillId,
    pageId,
    status: snapshot.status,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    error: snapshot.error,
  } as const;
}
