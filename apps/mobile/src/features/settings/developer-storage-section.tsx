import React from "react";
import { Alert } from "react-native";
import { Database } from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import { SpinningLoaderIcon } from "../../components/spinning-loader-icon";
import { useAppSettingsStore } from "../../state/app-settings-store";
import { SettingsMessage, SettingsSection } from "./settings-components";

export function DeveloperStorageSection() {
  const theme = useEight2FiveTheme();
  const store = useAppSettingsStore();
  const [rebuilding, setRebuilding] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  const rebuild = async () => {
    if (rebuilding) return;
    setRebuilding(true);
    setError(undefined);
    try {
      await store.rebuildDatabase();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setRebuilding(false);
    }
  };

  const confirm = () => {
    Alert.alert(
      "Rebuild app database?",
      "This deletes all locally stored drills and app settings, then recreates the app database from the current schema. PANS device and network data is not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rebuild",
          style: "destructive",
          onPress: () => void rebuild(),
        },
      ],
    );
  };

  return (
    <>
      {error ? (
        <SettingsMessage tone="error">{error.message}</SettingsMessage>
      ) : null}
      <SettingsSection title="Development Storage">
        <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
          <Text style={{ color: theme.textMuted }}>
            Delete the app SQLite database and recreate it from the current
            schema. This clears local drills and app settings but does not
            delete PANS device or network data.
          </Text>
          <Button
            variant="destructive"
            testID="rebuild-mobile-database-button"
            isDisabled={rebuilding}
            onPress={confirm}
          >
            {rebuilding ? <SpinningLoaderIcon /> : <ButtonIcon as={Database} />}
            <ButtonText>Rebuild App Database</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>
    </>
  );
}
