import React from "react";
import { useRouter } from "expo-router";
import {
  Code2,
  Eye,
  ListChecks,
  Navigation,
  Radio,
  Route,
} from "lucide-react-native";
import type {
  AppSettingsUpdate,
  FieldPerspective,
  TransitionMetricMode,
} from "@eight2five/mobile/settings";

import { useTabBarVisibility } from "../../navigation/tab-bar-visibility-context";
import { useMobilePansSnapshot } from "../../pans/mobile-pans-context";
import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import { ResetSettingsControl } from "./reset-settings-control";
import { updateDrillFeatures } from "./settings-actions";
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

const TRANSITION_CHOICES = [
  { label: "Step Size", value: "step-size" },
  { label: "Crossing Counts", value: "crossing-counts" },
] as const;

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
          description="Show drill sets, targets, guidance, and controls."
          value={settings.drillFeaturesEnabled}
          onChange={(enabled) => void setDrillFeatures(enabled)}
          disabled={disabled}
          testID="drill-features-setting"
        />
      </SettingsSection>

      <SettingsSection title="Field">
        <SettingsSelectRow<FieldPerspective>
          icon={Eye}
          title="Field perspective"
          description="Choose the default semantic field view."
          value={settings.fieldPerspective}
          choices={PERSPECTIVE_CHOICES}
          onChange={(fieldPerspective) => void update({ fieldPerspective })}
          disabled={disabled}
          testID="field-perspective-setting"
        />
      </SettingsSection>

      <SettingsSection title="Transitions">
        <SettingsSelectRow<TransitionMetricMode>
          icon={Route}
          title="Transition metric"
          description="Show Step Size or yard-line crossing counts."
          value={settings.transitionMetricMode}
          choices={TRANSITION_CHOICES}
          onChange={(transitionMetricMode) =>
            void update({ transitionMetricMode })
          }
          disabled={disabled}
          testID="transition-metric-setting"
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
