import React from "react";
import { Navigation, Route } from "lucide-react-native";
import type { TransitionMetricMode } from "@eight2five/mobile/settings";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
  SettingsSelectRow,
  SettingsSwitchRow,
} from "./settings-components";

const TRANSITION_CHOICES = [
  { label: "Step Size", value: "step-size" },
  { label: "Crossing Counts", value: "crossing-counts" },
] as const;

export function AdvancedSettingsScreen() {
  const store = useAppSettingsStore();
  const { status, settings, error: loadError } = useAppSettingsSnapshot();
  const [operationError, setOperationError] = React.useState<Error>();
  const disabled = status !== "ready";

  const update = async (
    partial:
      | { guidanceEnabled: boolean }
      | { transitionMetricMode: TransitionMetricMode },
  ) => {
    setOperationError(undefined);
    try {
      await store.update(partial);
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
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
    </SettingsScreenContainer>
  );
}
