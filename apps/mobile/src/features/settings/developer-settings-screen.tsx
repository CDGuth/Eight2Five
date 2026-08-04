import React from "react";
import { useRouter } from "expo-router";
import {
  Activity,
  CircleDashed,
  Code2,
  Database,
  Grid3X3,
  MapPinned,
  RefreshCw,
  Radio,
  Triangle,
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
import { parseComfortableAnchorRange } from "./comfortable-anchor-range";
import { disableDeveloperMode } from "./developer-mode-actions";
import { AnchorNumberInput } from "./standard-anchor-position-form";
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
  const [rangeDraft, setRangeDraft] = React.useState(() =>
    settings.comfortableAnchorRangeMeters.toString(),
  );
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

  const updateOverlay = async (partial: {
    showCachedAnchorGeometry?: boolean;
    showComfortableAnchorRange?: boolean;
    showPerimeterStepGrid?: boolean;
    comfortableAnchorRangeMeters?: number;
  }) => {
    setOperationError(undefined);
    try {
      await settingsStore.update(partial);
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    }
  };

  const rangeValidation = parseComfortableAnchorRange(rangeDraft);

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

      <SettingsSection title="Anchor Configuration">
        <SettingsNavigationRow
          icon={Triangle}
          title="Cached Anchors"
          description="Review and explicitly edit network anchor positions."
          onPress={() => router.push("/(tabs)/settings/anchors")}
          testID="cached-anchors-link"
        />
      </SettingsSection>

      <SettingsSection title="Field Overlays">
        <SettingsSwitchRow
          icon={Grid3X3}
          title="Show perimeter step grid"
          description="Continue the active marching coordinate grid beyond the physical field boundary."
          value={settings.showPerimeterStepGrid}
          onChange={(showPerimeterStepGrid) =>
            void updateOverlay({ showPerimeterStepGrid })
          }
          testID="show-perimeter-step-grid-setting"
        />
        <SettingsSwitchRow
          icon={MapPinned}
          title="Show cached anchor geometry"
          description="Draw locally cached anchors for the active PANS network."
          value={settings.showCachedAnchorGeometry}
          onChange={(showCachedAnchorGeometry) =>
            void updateOverlay({ showCachedAnchorGeometry })
          }
          testID="show-cached-anchor-geometry-setting"
        />
        <SettingsSwitchRow
          icon={CircleDashed}
          title="Show comfortable anchor range"
          description="Draw an approximate planning range, not guaranteed RF coverage."
          value={
            settings.showCachedAnchorGeometry &&
            settings.showComfortableAnchorRange
          }
          onChange={(showComfortableAnchorRange) =>
            void updateOverlay({ showComfortableAnchorRange })
          }
          disabled={!settings.showCachedAnchorGeometry}
          testID="show-comfortable-anchor-range-setting"
        />
        <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
          <AnchorNumberInput
            label="Comfortable range (meters)"
            value={rangeDraft}
            error={rangeValidation.error}
            helper="Stored in meters. Must be greater than 0 and no more than 200 m."
            disabled={!settings.showCachedAnchorGeometry}
            onChange={setRangeDraft}
          />
          <Button
            variant="outline"
            testID="apply-comfortable-anchor-range-button"
            isDisabled={
              !settings.showCachedAnchorGeometry ||
              rangeValidation.value === undefined ||
              rangeValidation.value === settings.comfortableAnchorRangeMeters
            }
            onPress={() => {
              if (rangeValidation.value !== undefined) {
                void updateOverlay({
                  comfortableAnchorRangeMeters: rangeValidation.value,
                });
              }
            }}
          >
            <ButtonText>Apply Comfortable Range</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>
    </SettingsScreenContainer>
  );
}
