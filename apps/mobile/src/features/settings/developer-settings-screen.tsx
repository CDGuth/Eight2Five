import React from "react";
import { useRouter } from "expo-router";
import {
  Activity,
  Code2,
  Database,
  RefreshCw,
  Radio,
} from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import {
  useAppSettingsSnapshot,
  useAppSettingsStore,
} from "../../state/app-settings-store";
import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import { buildDeveloperDiagnosticRows } from "./developer-diagnostics";
import { disableDeveloperMode } from "./developer-mode-actions";
import {
  SettingsMessage,
  SettingsNavigationRow,
  SettingsScreenContainer,
  SettingsSection,
  SettingsSwitchRow,
  SettingsValueRow,
} from "./settings-components";

export function DeveloperSettingsScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const settingsStore = useAppSettingsStore();
  const pansStore = useMobilePansStore();
  const { status, settings, error: settingsError } = useAppSettingsSnapshot();
  const pans = useMobilePansSnapshot();
  const [refreshing, setRefreshing] = React.useState(false);
  const [operationError, setOperationError] = React.useState<Error>();
  const rows = React.useMemo(() => buildDeveloperDiagnosticRows(pans), [pans]);

  const disable = async () => {
    setOperationError(undefined);
    try {
      await disableDeveloperMode(settingsStore);
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    }
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setOperationError(undefined);
    try {
      await pansStore.refreshDiagnostics();
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    } finally {
      setRefreshing(false);
    }
  };

  if (!settings.developerModeEnabled) {
    return (
      <SettingsScreenContainer>
        <SettingsSection title="Developer Mode">
          <SettingsValueRow
            icon={Code2}
            title="Developer Mode"
            description="Advanced PANS configuration controls are hidden."
            value="Off"
          />
          <SettingsNavigationRow
            icon={Code2}
            title="Enable Developer Mode"
            description="Review the anchor-position safety warning first."
            onPress={() =>
              router.push("/(tabs)/settings/developer-confirmation")
            }
            testID="developer-mode-confirmation-link"
          />
        </SettingsSection>
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
          title="Developer Mode"
          description="Disabling hides controls and turns overlays off without changing hardware."
          value
          onChange={(enabled) => {
            if (!enabled) void disable();
          }}
          disabled={status !== "ready"}
          testID="developer-mode-setting"
        />
      </SettingsSection>

      <SettingsSection title="PANS Diagnostics">
        <SettingsValueRow
          icon={Radio}
          title="Connection"
          value={pans.connectionState}
        />
        <VStack style={{ gap: 8, padding: eight2FiveSpacing.md }}>
          {rows.slice(1).map((row) => (
            <HStack
              key={row.label}
              className="items-start justify-between"
              style={{ gap: 16 }}
            >
              <Text style={{ color: theme.textMuted }}>{row.label}</Text>
              <Text
                selectable
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.utilityRegular,
                  fontVariant: ["tabular-nums"],
                  textAlign: "right",
                }}
              >
                {row.value}
              </Text>
            </HStack>
          ))}
          <Button
            variant="outline"
            testID="refresh-developer-diagnostics-button"
            isDisabled={pans.connectionState !== "connected" || refreshing}
            onPress={() => void refresh()}
          >
            {refreshing ? <ButtonSpinner /> : <ButtonIcon as={RefreshCw} />}
            <ButtonText>Refresh Hardware Diagnostics</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>

      <SettingsSection title="Data Sources">
        <SettingsValueRow
          icon={Activity}
          title="Live position"
          description="Raw values are coalesced for this screen."
          value={pans.lastUpdateAt ? "Available" : "Waiting"}
        />
        <SettingsValueRow
          icon={Database}
          title="Cached anchors"
          description="Positions remain local until an explicit confirmed write."
          value={pans.knownAnchors.length.toString()}
        />
      </SettingsSection>
    </SettingsScreenContainer>
  );
}
