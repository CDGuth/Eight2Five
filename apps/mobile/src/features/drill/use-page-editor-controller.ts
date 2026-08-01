import React from "react";
import { useFocusEffect } from "expo-router";
import { getDrillTerms, type DrillPage } from "@eight2five/mobile/drill";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import { toError } from "./drill-management";
import {
  createDefaultPageDraft,
  pageToDraft,
  type MarchingCoordinateDraft,
} from "./page-form";
import {
  getPageCreationOrdinal,
  savePageDraft,
  type PagePlacement,
} from "./page-management";

export function usePageEditorController(
  drillId: string,
  pageId: string,
  placement: PagePlacement = "append",
  relativePageId?: string,
) {
  const snapshot = useAppSettingsSnapshot();
  const store = useAppSettingsStore();
  const [page, setPage] = React.useState<DrillPage>();
  const [pages, setPages] = React.useState<readonly DrillPage[]>([]);
  const [draft, setDraft] = React.useState<MarchingCoordinateDraft>();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<Error>();
  const saveInFlight = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (snapshot.status !== "ready") return;
    try {
      const repository = store.getDrillRepository();
      const nextPages = await repository.listPages(drillId);
      setPages(nextPages);
      if (pageId === "new") {
        const ordinal = getPageCreationOrdinal(
          nextPages,
          placement,
          relativePageId,
        );
        // Count-based labels are only an editable suggestion; existing labels
        // are never parsed or assumed to form a numeric sequence.
        setDraft(
          createDefaultPageDraft({
            ordinal,
            suggestedLabel: String(nextPages.length + 1),
          }),
        );
        setPage(undefined);
      } else {
        const nextPage = await repository.getPage(pageId);
        if (!nextPage || nextPage.drillId !== drillId) {
          throw new Error("This drill entry no longer exists in the drill.");
        }
        setPage(nextPage);
        setDraft(pageToDraft(nextPage));
      }
      setError(undefined);
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setLoading(false);
    }
  }, [drillId, pageId, placement, relativePageId, snapshot.status, store]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const save = React.useCallback(async () => {
    if (!draft) throw new Error("The page form is not ready.");
    if (saveInFlight.current) throw new Error("A save is already in progress.");
    saveInFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const saved = await savePageDraft({
        repository: store.getDrillRepository(),
        drillId,
        pageId,
        pages,
        placement,
        relativePageId,
        draft,
      });
      setPage(saved);
      return saved;
    } catch (cause) {
      const operationError = toError(cause);
      setError(operationError);
      throw operationError;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [draft, drillId, pageId, pages, placement, relativePageId, store]);

  return {
    drillId,
    pageId,
    page,
    draft,
    setDraft,
    loading: snapshot.status === "loading" || loading,
    saving,
    terms: getDrillTerms(snapshot.settings.drillTerminology),
    error: error ?? snapshot.error,
    save,
  } as const;
}
