import React from "react";
import { useRouter } from "expo-router";
import { Code2, Network, Triangle } from "lucide-react-native";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  disableDeveloperMode,
  enableDeveloperMode,
} from "./developer-mode-actions";
import {
  DeveloperFieldOverlaySection,
  DeveloperMockPositionSection,
} from "./developer-field-sections";
import { DeveloperPansSections } from "./developer-pans-sections";
import { DeveloperStorageSection } from "./developer-storage-section";
import {
  SettingsMessage,
  SettingsNavigationRow,
  SettingsScreenContainer,
  SettingsSection,
  SettingsSwitchRow,
} from "./settings-components";

export function DeveloperSettingsScreen() {
  const router = useRouter();
  const store = useAppSettingsStore();
  const { status, settings, error: settingsError } = useAppSettingsSnapshot();
  const [operationError, setOperationError] = React.useState<Error>();

  const setDeveloperMode = async (enabled: boolean) => {
    setOperationError(undefined);
    try {
      if (enabled) await enableDeveloperMode(store);
      else await disableDeveloperMode(store);
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    }
  };

  if (!settings.developerModeEnabled) {
    return (
      <SettingsScreenContainer>
        {settingsError || operationError ? (
          <SettingsMessage tone="error">
            {(operationError ?? settingsError)?.message}
          </SettingsMessage>
        ) : null}
        <SettingsSection title="Developer Mode">
          <SettingsSwitchRow
            icon={Code2}
            title="Developer Settings"
            description="Show advanced positioning, field, and PANS configuration controls."
            value={false}
            onChange={(enabled) => {
              if (enabled) void setDeveloperMode(true);
            }}
            disabled={status !== "ready"}
            testID="developer-mode-setting"
          />
        </SettingsSection>
        {status === "error" ? <DeveloperStorageSection /> : null}
      </SettingsScreenContainer>
    );
  }

  return (
    <SettingsScreenContainer>
      {settingsError || operationError ? (
        <SettingsMessage tone="error">
          {(operationError ?? settingsError)?.message}
        </SettingsMessage>
      ) : null}

      <SettingsSection title="Developer Mode">
        <SettingsSwitchRow
          icon={Code2}
          title="Developer Settings"
          description="Disabling hides advanced controls and resets developer-only UI overrides."
          value
          onChange={(enabled) => void setDeveloperMode(enabled)}
          disabled={status !== "ready"}
          testID="developer-mode-setting"
        />
      </SettingsSection>

      <DeveloperPansSections />
      <DeveloperMockPositionSection />
      <DeveloperStorageSection />

      <SettingsSection title="PANS Configuration">
        <SettingsNavigationRow
          icon={Network}
          title="Networks & Devices"
          description="Group nearby and cached PANS devices by network and edit explicit commissioning settings."
          onPress={() => router.push("/(tabs)/settings/networks" as never)}
          testID="networks-link"
        />
        <SettingsNavigationRow
          icon={Triangle}
          title="Cached Anchors"
          description="Review and explicitly edit anchor positions."
          onPress={() => router.push("/(tabs)/settings/anchors")}
          testID="cached-anchors-link"
        />
      </SettingsSection>

      <DeveloperFieldOverlaySection />
    </SettingsScreenContainer>
  );
}
