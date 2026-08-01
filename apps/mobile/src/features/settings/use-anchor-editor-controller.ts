import React from "react";
import { useFocusEffect } from "expo-router";
import type {
  AnchorFieldPosition,
  AnchorPositionUnit,
  StandardAnchorPositionDraft,
} from "@eight2five/mobile/field";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import {
  createAnchorEditorDrafts,
  convertMarchingHeightUnit,
  standardDraftFromPosition,
  validateMarchingAnchorDraft,
  validateStandardAnchorDraft,
  type AnchorEditorMode,
  type MarchingAnchorDraft,
} from "./anchor-editor-form";

export function useAnchorEditorController(anchorId: string) {
  const settings = useAppSettingsSnapshot();
  const pans = useMobilePansSnapshot();
  const pansStore = useMobilePansStore();
  const [anchor, setAnchor] = React.useState<ManagedDevice>();
  const [mode, setModeState] = React.useState<AnchorEditorMode>("marching");
  const [marchingDraft, setMarchingDraft] = React.useState(
    () => createAnchorEditorDrafts().marching,
  );
  const [standardDraft, setStandardDraft] = React.useState(
    () => createAnchorEditorDrafts().standard,
  );
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  const load = React.useCallback(async () => {
    if (pans.initialization !== "ready") return;
    setLoading(true);
    setError(undefined);
    try {
      const next = await pansStore.getRuntime().repository.getDevice(anchorId);
      if (
        !next ||
        (next.role !== "anchor" && next.lastKnownConfig?.role !== "anchor")
      ) {
        throw new Error("The cached anchor could not be found.");
      }
      const position =
        next.lastKnownConfig?.role === "anchor"
          ? next.lastKnownConfig.position
          : undefined;
      const drafts = createAnchorEditorDrafts(position);
      setAnchor(next);
      setMarchingDraft(drafts.marching);
      setStandardDraft(drafts.standard);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setLoading(false);
    }
  }, [anchorId, pans.initialization, pansStore]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  const validation =
    mode === "marching"
      ? validateMarchingAnchorDraft(marchingDraft)
      : validateStandardAnchorDraft(standardDraft);

  const setMode = (nextMode: AnchorEditorMode) => {
    if (nextMode === mode) return;
    const position = validation.position;
    if (position) {
      if (nextMode === "standard") {
        setStandardDraft(
          standardDraftFromPosition(
            position,
            standardDraft.reference,
            standardDraft.unit,
          ),
        );
      } else {
        setMarchingDraft(createAnchorEditorDrafts(position).marching);
      }
    }
    setSaved(false);
    setModeState(nextMode);
  };

  const updateStandardReference = (
    reference: StandardAnchorPositionDraft["reference"],
  ) => {
    const position = validateStandardAnchorDraft(standardDraft).position;
    setStandardDraft(
      position
        ? standardDraftFromPosition(position, reference, standardDraft.unit)
        : { ...standardDraft, reference },
    );
  };

  const updateStandardUnit = (unit: AnchorPositionUnit) => {
    const position = validateStandardAnchorDraft(standardDraft).position;
    setStandardDraft(
      position
        ? standardDraftFromPosition(position, standardDraft.reference, unit)
        : { ...standardDraft, unit },
    );
  };

  const save = async (position: AnchorFieldPosition) => {
    if (saving || !settings.settings.developerModeEnabled) return;
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      await pansStore.writeAnchorPosition(anchorId, position);
      setSaved(true);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setSaving(false);
    }
  };

  return {
    developerModeEnabled: settings.settings.developerModeEnabled,
    connectionState: pans.connectionState,
    anchor,
    mode,
    marchingDraft,
    standardDraft,
    validation,
    loading,
    saving,
    saved,
    error,
    setMode,
    setMarchingDraft: (draft: MarchingAnchorDraft) => {
      setSaved(false);
      setMarchingDraft(draft);
    },
    setStandardDraft: (draft: StandardAnchorPositionDraft) => {
      setSaved(false);
      setStandardDraft(draft);
    },
    updateStandardReference,
    updateStandardUnit,
    updateMarchingHeightUnit: (heightUnit: MarchingAnchorDraft["heightUnit"]) =>
      setMarchingDraft((draft) => convertMarchingHeightUnit(draft, heightUnit)),
    save,
    reload: load,
  } as const;
}
