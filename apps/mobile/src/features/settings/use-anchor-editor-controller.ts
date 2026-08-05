import React from "react";
import { useFocusEffect } from "expo-router";
import type {
  AnchorFieldPosition,
  AnchorPositionUnit,
  StandardAnchorPositionDraft,
} from "@eight2five/mobile/field";
import type { ManagedDevice } from "@eight2five/mobile/pans-manager";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import { resolveEffectiveFieldPreset } from "../field/effective-field-preset";
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
  const settingsStore = useAppSettingsStore();
  const pans = useMobilePansSnapshot();
  const pansStore = useMobilePansStore();
  const [anchor, setAnchor] = React.useState<ManagedDevice>();
  const [fieldPreset, setFieldPreset] = React.useState(
    settings.settings.defaultFieldPreset,
  );
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
    if (pans.initialization !== "ready" || settings.status !== "ready") return;
    setLoading(true);
    setError(undefined);
    try {
      const [next, activeDrill] = await Promise.all([
        pansStore.getRuntime().repository.getDevice(anchorId),
        settings.settings.activeDrillId
          ? settingsStore
              .getDrillRepository()
              .getDrill(settings.settings.activeDrillId)
          : Promise.resolve(undefined),
      ]);
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
      const nextFieldPreset = resolveEffectiveFieldPreset(
        activeDrill,
        settings.settings.defaultFieldPreset,
      );
      const drafts = createAnchorEditorDrafts(position, nextFieldPreset);
      setAnchor(next);
      setFieldPreset(nextFieldPreset);
      setMarchingDraft(drafts.marching);
      setStandardDraft(drafts.standard);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setLoading(false);
    }
  }, [
    anchorId,
    pans.initialization,
    pansStore,
    settings.settings.activeDrillId,
    settings.settings.defaultFieldPreset,
    settings.status,
    settingsStore,
  ]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  const validation =
    mode === "marching"
      ? validateMarchingAnchorDraft(marchingDraft, fieldPreset)
      : validateStandardAnchorDraft(standardDraft, fieldPreset);
  const canWritePosition = Boolean(
    anchor &&
    (pans.connectionState === "connected" ||
      (pans.activeNetworkId && anchor.networkId === pans.activeNetworkId)),
  );

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
            fieldPreset,
          ),
        );
      } else {
        setMarchingDraft(
          createAnchorEditorDrafts(position, fieldPreset).marching,
        );
      }
    }
    setSaved(false);
    setModeState(nextMode);
  };

  const updateStandardReference = (
    reference: StandardAnchorPositionDraft["reference"],
  ) => {
    const position = validateStandardAnchorDraft(
      standardDraft,
      fieldPreset,
    ).position;
    setStandardDraft(
      position
        ? standardDraftFromPosition(
            position,
            reference,
            standardDraft.unit,
            fieldPreset,
          )
        : { ...standardDraft, reference },
    );
  };

  const updateStandardUnit = (unit: AnchorPositionUnit) => {
    const position = validateStandardAnchorDraft(
      standardDraft,
      fieldPreset,
    ).position;
    setStandardDraft(
      position
        ? standardDraftFromPosition(
            position,
            standardDraft.reference,
            unit,
            fieldPreset,
          )
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
    canWritePosition,
    anchor,
    fieldPreset,
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
