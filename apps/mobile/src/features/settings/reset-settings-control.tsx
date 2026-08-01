import React from "react";
import { Alert } from "react-native";
import { RotateCcw } from "lucide-react-native";
import { Pressable } from "@eight2five/ui/components/pressable";

import { useTabBarVisibility } from "../../navigation/tab-bar-visibility-context";
import { useAppSettingsStore } from "../../state/app-settings-store";
import { RESET_SETTINGS_MESSAGE, resetAppSettings } from "./settings-actions";
import { SettingsRowContent } from "./settings-components";

export function ResetSettingsControl({
  disabled,
  onError,
}: {
  disabled?: boolean;
  onError(error: Error): void;
}) {
  const store = useAppSettingsStore();
  const { reconfigureDrillFeatures } = useTabBarVisibility();
  const [resetting, setResetting] = React.useState(false);

  const reset = async () => {
    setResetting(true);
    try {
      await resetAppSettings(store, reconfigureDrillFeatures);
    } catch (cause) {
      onError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setResetting(false);
    }
  };

  const confirmReset = () => {
    Alert.alert("Reset App Settings?", RESET_SETTINGS_MESSAGE, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => void reset(),
      },
    ]);
  };

  return (
    <Pressable
      testID="reset-app-settings"
      disabled={disabled || resetting}
      onPress={confirmReset}
      accessibilityRole="button"
      accessibilityLabel="Reset App Settings"
    >
      <SettingsRowContent icon={RotateCcw} title="Reset App Settings" danger />
    </Pressable>
  );
}
