import React from "react";
import { useRouter } from "expo-router";
import {
  BookOpenText,
  Code2,
  Eye,
  ListChecks,
  Map,
  Navigation,
  Palette,
  Radio,
  Route,
  Rows3,
} from "lucide-react-native";
import type {
  AppearanceMode,
  AppSettingsUpdate,
  FieldPerspective,
  TransitionMetricMode,
} from "@eight2five/mobile/settings";
import type { DrillTerminology } from "@eight2five/mobile/drill";
import {
  FIELD_PRESET_IDS,
  getFieldPreset,
  type FieldPresetId,
} from "@eight2five/drill-schema";

import { useTabBarVisibility } from "../../navigation/tab-bar-visibility-context";
import { useMobilePansSnapshot } from "../../pans/mobile-pans-context";
import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import { ResetSettingsControl } from "./reset-settings-control";
import { updateDrillFeatures } from "./settings-actions";
import { shouldShowTransitionCountControls } from "./settings-screen-policy";
import {
  SettingsMessage,
  SettingsNavigationRow,
  SettingsScreenContainer,
  SettingsSection,
  SettingsSelectRow,
  SettingsSwitchRow,
  SettingsValueRow,
} from "./settings-components";

const PERSPECTIVE_CHOICES = [
  { label: "Director", value: "director" },
  { label: "Performer", value: "performer" },
] as const;

const APPEARANCE_CHOICES = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

const TERMINOLOGY_CHOICES = [
  { label: "Sets", value: "sets" },
  { label: "Pages", value: "pages" },
] as const;

const FIELD_PRESET_CHOICES = FIELD_PRESET_IDS.map((value) => ({
  label: getFieldPreset(value).name,
  value,
})) satisfies readonly { label: string; value: FieldPresetId }[];

const TRANSITION_CHOICES = [
  { label: "Step Size", value: "step-size" },
  { label: "xCounts", value: "crossing-counts" },
] as const;

const TRANSITION_COUNT_CHOICES = Array.from({ length: 51 }, (_, count) => ({
  label: String(count),
  value: String(count),
}));

export function SettingsScreen() {
  const router = useRouter();
  const store = useAppSettingsStore();
  const { status, settings, error: loadError } = useAppSettingsSnapshot();
  const { reconfigureDrillFeatures } = useTabBarVisibility();
  const pans = useMobilePansSnapshot();
  const [operationError, setOperationError] = React.useState<Error>();
  const disabled = status !== "ready";

  const update = async (partial: AppSettingsUpdate) => {
    setOperationError(undefined);
    try {
      await store.update(partial);
    } catch (cause) {
      setOperationError(toError(cause));
    }
  };

  const setDrillFeatures = async (enabled: boolean) => {
    setOperationError(undefined);
    try {
      await updateDrillFeatures(store, reconfigureDrillFeatures, enabled);
    } catch (cause) {
      setOperationError(toError(cause));
    }
  };

  return (
    <SettingsScreenContainer>
      {status === "loading" ? (
        <SettingsMessage tone="info">Loading app settings…</SettingsMessage>
      ) : null}
      {loadError || operationError ? (
        <SettingsMessage tone="error">
          {(operationError ?? loadError)?.message}
        </SettingsMessage>
      ) : null}

      <SettingsSection title="Appearance">
        <SettingsSelectRow<AppearanceMode>
          icon={Palette}
          title="App appearance"
          description="Follow the system appearance or always use a light or dark theme."
          value={settings.appearanceMode}
          choices={APPEARANCE_CHOICES}
          onChange={(appearanceMode) => void update({ appearanceMode })}
          disabled={disabled}
          testID="appearance-mode-setting"
        />
      </SettingsSection>

      <SettingsSection title="PANS">
        <SettingsNavigationRow
          icon={Radio}
          title="Tag connection"
          description={
            pans.rememberedTag?.lastKnownConfig?.label ??
            "Select and manage the performer tag."
          }
          onPress={() => router.push("/(tabs)/settings/tag")}
          testID="tag-connection-link"
        />
        <SettingsValueRow
          icon={Radio}
          title="Connection state"
          value={pans.connectionState}
        />
      </SettingsSection>

      <SettingsSection title="Drill">
        <SettingsSwitchRow
          icon={ListChecks}
          title="Drill features"
          description="Show drill positions, targets, guidance, and controls."
          value={settings.drillFeaturesEnabled}
          onChange={(enabled) => void setDrillFeatures(enabled)}
          disabled={disabled}
          testID="drill-features-setting"
        />
        <SettingsSelectRow<DrillTerminology>
          icon={BookOpenText}
          title="Drill terminology"
          description="Choose the name used for drill positions."
          value={settings.drillTerminology}
          choices={TERMINOLOGY_CHOICES}
          onChange={(drillTerminology) => void update({ drillTerminology })}
          disabled={disabled}
          testID="drill-terminology-setting"
        />
      </SettingsSection>

      <SettingsSection title="Field">
        <SettingsSelectRow<FieldPresetId>
          icon={Map}
          title="Default marching field"
          description="Used when no drill is loaded and for new manual drills. A loaded drill overrides this default."
          value={settings.defaultFieldPreset}
          choices={FIELD_PRESET_CHOICES}
          onChange={(defaultFieldPreset) => void update({ defaultFieldPreset })}
          disabled={disabled}
          testID="default-field-preset-setting"
        />
        <SettingsSelectRow<FieldPerspective>
          icon={Eye}
          title="Field perspective"
          description="Choose how the field is oriented."
          value={settings.fieldPerspective}
          choices={PERSPECTIVE_CHOICES}
          onChange={(fieldPerspective) => void update({ fieldPerspective })}
          disabled={disabled}
          testID="field-perspective-setting"
        />
        <SettingsSwitchRow
          icon={Rows3}
          title="Auxiliary field marks"
          description="Show sideline one-yard extensions and the two long hash guide lines. Inbounds hash ticks remain visible."
          value={settings.showAuxiliaryFieldMarks}
          onChange={(showAuxiliaryFieldMarks) =>
            void update({ showAuxiliaryFieldMarks })
          }
          disabled={disabled}
          testID="auxiliary-field-marks-setting"
        />
      </SettingsSection>

      <SettingsSection title="Transitions">
        <SettingsSelectRow<TransitionMetricMode>
          icon={Route}
          title="Step size metric"
          description="Show Step Size or xCounts."
          value={settings.transitionMetricMode}
          choices={TRANSITION_CHOICES}
          onChange={(transitionMetricMode) =>
            void update({ transitionMetricMode })
          }
          disabled={disabled}
          testID="transition-metric-setting"
        />
        <SettingsSwitchRow
          icon={ListChecks}
          title="Transition markers"
          description="Show the selected performer's previous, next, and additional position markers."
          value={settings.showTransitionMarkers}
          onChange={(showTransitionMarkers) =>
            void update({ showTransitionMarkers })
          }
          disabled={disabled}
          testID="show-transition-markers-setting"
        />
        <SettingsSwitchRow
          icon={Rows3}
          title="Show all transition sets"
          description="Show every available previous and next position."
          value={settings.showAllTransitionSets}
          onChange={(showAllTransitionSets) =>
            void update({ showAllTransitionSets })
          }
          disabled={disabled}
          testID="show-all-transition-sets-setting"
        />
        {shouldShowTransitionCountControls(settings.showAllTransitionSets) ? (
          <>
            <SettingsSelectRow<string>
              icon={Route}
              title="Previous transition positions"
              description="Total positions, including the immediate previous marker."
              value={String(settings.previousTransitionSetCount)}
              choices={TRANSITION_COUNT_CHOICES}
              onChange={(value) =>
                void update({ previousTransitionSetCount: Number(value) })
              }
              disabled={disabled}
              testID="previous-transition-set-count-setting"
            />
            <SettingsSelectRow<string>
              icon={Route}
              title="Next transition positions"
              description="Total positions, including the immediate next marker."
              value={String(settings.nextTransitionSetCount)}
              choices={TRANSITION_COUNT_CHOICES}
              onChange={(value) =>
                void update({ nextTransitionSetCount: Number(value) })
              }
              disabled={disabled}
              testID="next-transition-set-count-setting"
            />
          </>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Drill entities">
        <SettingsSwitchRow
          icon={Eye}
          title="Performer labels"
          description="Show labels for other performers on the field."
          value={settings.showPerformerLabels}
          onChange={(showPerformerLabels) =>
            void update({ showPerformerLabels })
          }
          disabled={disabled}
          testID="show-performer-labels-setting"
        />
        <SettingsSwitchRow
          icon={Rows3}
          title="Performer names"
          description="Show an optional performer name below the label."
          value={settings.showPerformerNames}
          onChange={(showPerformerNames) => void update({ showPerformerNames })}
          disabled={disabled}
          testID="show-performer-names-setting"
        />
        <SettingsSwitchRow
          icon={Eye}
          title="Prop labels"
          description="Show labels for props on the field."
          value={settings.showPropLabels}
          onChange={(showPropLabels) => void update({ showPropLabels })}
          disabled={disabled}
          testID="show-prop-labels-setting"
        />
        <SettingsSwitchRow
          icon={Rows3}
          title="Prop names"
          description="Show an optional prop name below the label."
          value={settings.showPropNames}
          onChange={(showPropNames) => void update({ showPropNames })}
          disabled={disabled}
          testID="show-prop-names-setting"
        />
      </SettingsSection>

      <SettingsSection title="Guidance">
        <SettingsSwitchRow
          icon={Navigation}
          title="Field guidance"
          description="Show field-relative movement guidance to the target."
          value={settings.guidanceEnabled}
          onChange={(guidanceEnabled) => void update({ guidanceEnabled })}
          disabled={disabled}
          testID="guidance-enabled-setting"
        />
      </SettingsSection>

      <SettingsSection title="Application">
        <SettingsNavigationRow
          icon={Code2}
          title="Developer Settings"
          description={settings.developerModeEnabled ? "Enabled" : "Disabled"}
          onPress={() => router.push("/(tabs)/settings/developer")}
          testID="developer-settings-link"
        />
      </SettingsSection>

      <SettingsSection title="Reset">
        <ResetSettingsControl disabled={disabled} onError={setOperationError} />
      </SettingsSection>
    </SettingsScreenContainer>
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
