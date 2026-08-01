import React from "react";
import { useRouter } from "expo-router";
import { Code2, TriangleAlert, X } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing } from "@eight2five/ui/theme";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  DEVELOPER_MODE_WARNING,
  enableDeveloperMode,
} from "./developer-mode-actions";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
  SettingsValueRow,
} from "./settings-components";

export function DeveloperConfirmationScreen() {
  const router = useRouter();
  const store = useAppSettingsStore();
  const { status, settings } = useAppSettingsSnapshot();
  const [enabling, setEnabling] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  const enable = async () => {
    if (enabling || settings.developerModeEnabled) return;
    setEnabling(true);
    setError(undefined);
    try {
      await enableDeveloperMode(store);
      router.replace("/(tabs)/settings/developer");
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setEnabling(false);
    }
  };

  return (
    <SettingsScreenContainer>
      {error ? (
        <SettingsMessage tone="error">{error.message}</SettingsMessage>
      ) : null}
      <SettingsSection title="Advanced Configuration">
        <SettingsValueRow
          icon={TriangleAlert}
          title="Anchor position safety"
          description={DEVELOPER_MODE_WARNING}
          value={settings.developerModeEnabled ? "Enabled" : "Off"}
        />
      </SettingsSection>
      <VStack style={{ gap: eight2FiveSpacing.sm }}>
        <Button
          variant="outline"
          testID="cancel-developer-mode-button"
          isDisabled={enabling}
          onPress={() => router.back()}
        >
          <ButtonIcon as={X} />
          <ButtonText>Cancel</ButtonText>
        </Button>
        <Button
          testID="enable-developer-mode-button"
          isDisabled={
            status !== "ready" || enabling || settings.developerModeEnabled
          }
          onPress={() => void enable()}
        >
          {enabling ? <ButtonSpinner /> : <ButtonIcon as={Code2} />}
          <ButtonText>Enable Developer Mode</ButtonText>
        </Button>
      </VStack>
    </SettingsScreenContainer>
  );
}
