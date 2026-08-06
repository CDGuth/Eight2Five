import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  Activity,
  CircleDotDashed,
  Code2,
  Crosshair,
  Database,
  Grid3X3,
  MapPinned,
  Network,
  RefreshCw,
  Radio,
  SlidersHorizontal,
  Triangle,
} from "lucide-react-native";
import {
  Button,
  ButtonIcon,
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

import { SpinningLoaderIcon } from "../../components/spinning-loader-icon";
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
import {
  disableDeveloperMode,
  enableDeveloperMode,
} from "./developer-mode-actions";
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
  const [rebuildingDatabase, setRebuildingDatabase] = React.useState(false);
  const [operationError, setOperationError] = React.useState<Error>();
  const [rangeDraft, setRangeDraft] = React.useState(() =>
    settings.comfortableAnchorRangeMeters.toString(),
  );
  const [rssiDraft, setRssiDraft] = React.useState(() =>
    pans.discoveryRssiCutoff.toString(),
  );
  const [mockXDraft, setMockXDraft] = React.useState(() =>
    settings.mockLivePositionXSteps.toString(),
  );
  const [mockYDraft, setMockYDraft] = React.useState(() =>
    settings.mockLivePositionYSteps.toString(),
  );
  const rows = React.useMemo(() => buildDeveloperDiagnosticRows(pans), [pans]);

  const setDeveloperMode = async (enabled: boolean) => {
    setOperationError(undefined);
    try {
      if (enabled) {
        await enableDeveloperMode(settingsStore);
      } else {
        await disableDeveloperMode(settingsStore);
      }
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

  const rebuildDatabase = async () => {
    if (rebuildingDatabase) return;
    setRebuildingDatabase(true);
    setOperationError(undefined);
    try {
      await settingsStore.rebuildDatabase();
    } catch (cause) {
      setOperationError(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    } finally {
      setRebuildingDatabase(false);
    }
  };

  const confirmDatabaseRebuild = () => {
    Alert.alert(
      "Rebuild app database?",
      "This deletes all locally stored drills and app settings, then recreates the app database from the current schema. PANS device and network data is not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rebuild",
          style: "destructive",
          onPress: () => void rebuildDatabase(),
        },
      ],
    );
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
  const mockX = parseStaticPositionCoordinate(mockXDraft);
  const mockY = parseStaticPositionCoordinate(mockYDraft);
  const parsedRssi = Number(rssiDraft);
  const validRssi =
    Number.isInteger(parsedRssi) && parsedRssi >= -100 && parsedRssi <= -30;

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
        {status === "error" ? (
          <SettingsSection title="Development Storage">
            <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
              <Text style={{ color: theme.textMuted }}>
                If the app database cannot open after a schema change, rebuild
                it from the current schema. This clears local drills and app
                settings but leaves PANS device and network data alone.
              </Text>
              <Button
                variant="destructive"
                testID="rebuild-mobile-database-button"
                isDisabled={rebuildingDatabase}
                onPress={confirmDatabaseRebuild}
              >
                {rebuildingDatabase ? (
                  <SpinningLoaderIcon />
                ) : (
                  <ButtonIcon as={Database} />
                )}
                <ButtonText>Rebuild App Database</ButtonText>
              </Button>
            </VStack>
          </SettingsSection>
        ) : null}
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
      {pans.commissioningWarning ? (
        <SettingsMessage tone="warning">
          {pans.commissioningWarning}
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
            {refreshing ? (
              <SpinningLoaderIcon />
            ) : (
              <ButtonIcon as={RefreshCw} />
            )}
            <ButtonText>Refresh Hardware Diagnostics</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>

      <SettingsSection title="Discovery">
        <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
          <AnchorNumberInput
            label="Minimum signal (dBm)"
            value={rssiDraft}
            error={validRssi ? undefined : "Enter an integer from -100 to -30."}
            helper="Nearby device rows below this signal are hidden."
            disabled={false}
            onChange={setRssiDraft}
          />
          <Button
            variant="outline"
            testID="apply-discovery-rssi-cutoff-button"
            isDisabled={!validRssi || parsedRssi === pans.discoveryRssiCutoff}
            onPress={() =>
              void pansStore
                .setDiscoveryRssiCutoff(parsedRssi)
                .catch((cause) =>
                  setOperationError(
                    cause instanceof Error ? cause : new Error(String(cause)),
                  ),
                )
            }
          >
            <ButtonIcon as={SlidersHorizontal} />
            <ButtonText>Apply Signal Cutoff</ButtonText>
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

      <SettingsSection title="Live Position Mock">
        <SettingsSwitchRow
          icon={Crosshair}
          title="Mock live position"
          description="Replace the field UI's live position with a fixed development coordinate. Hardware status remains real."
          value={settings.mockLivePositionEnabled}
          onChange={(mockLivePositionEnabled) =>
            void settingsStore
              .update({ mockLivePositionEnabled })
              .catch((cause) =>
                setOperationError(
                  cause instanceof Error ? cause : new Error(String(cause)),
                ),
              )
          }
          testID="mock-live-position-setting"
        />
        {settings.mockLivePositionEnabled ? (
          <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
            <AnchorNumberInput
              label="X (8-to-5 steps from 50)"
              value={mockXDraft}
              error={mockX.error}
              helper="Negative is Side 1; positive is Side 2 when viewed from the front sideline."
              disabled={false}
              onChange={setMockXDraft}
            />
            <AnchorNumberInput
              label="Y (8-to-5 steps from front sideline)"
              value={mockYDraft}
              error={mockY.error}
              helper="Zero is the front sideline; positive values move toward the back sideline."
              disabled={false}
              onChange={setMockYDraft}
            />
            <Button
              variant="outline"
              testID="apply-mock-live-position-button"
              isDisabled={
                mockX.value === undefined ||
                mockY.value === undefined ||
                (mockX.value === settings.mockLivePositionXSteps &&
                  mockY.value === settings.mockLivePositionYSteps)
              }
              onPress={() => {
                if (mockX.value === undefined || mockY.value === undefined)
                  return;
                void settingsStore
                  .update({
                    mockLivePositionXSteps: mockX.value,
                    mockLivePositionYSteps: mockY.value,
                  })
                  .catch((cause) =>
                    setOperationError(
                      cause instanceof Error ? cause : new Error(String(cause)),
                    ),
                  );
              }}
            >
              <ButtonIcon as={Crosshair} />
              <ButtonText>Apply Mock Position</ButtonText>
            </Button>
          </VStack>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Development Storage">
        <VStack style={{ gap: 12, padding: eight2FiveSpacing.md }}>
          <Text style={{ color: theme.textMuted }}>
            Delete the disposable app SQLite database and recreate it from the
            current schema. This clears local drills and app settings but does
            not delete PANS device or network data.
          </Text>
          <Button
            variant="destructive"
            testID="rebuild-mobile-database-button"
            isDisabled={rebuildingDatabase}
            onPress={confirmDatabaseRebuild}
          >
            {rebuildingDatabase ? (
              <SpinningLoaderIcon />
            ) : (
              <ButtonIcon as={Database} />
            )}
            <ButtonText>Rebuild App Database</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>

      <SettingsSection title="Anchor Configuration">
        <SettingsNavigationRow
          icon={Network}
          title="Networks"
          description="Create profiles, select the active network, and commission anchors."
          onPress={() => router.push("/(tabs)/settings/networks" as never)}
          testID="networks-link"
        />
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
          icon={CircleDotDashed}
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

function parseStaticPositionCoordinate(value: string): {
  readonly value?: number;
  readonly error?: string;
} {
  const normalized = value.trim();
  if (!normalized) return { error: "Enter a coordinate." };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { error: "Enter a finite number." };
  if (Math.abs(parsed) > 1000) {
    return { error: "Enter a value between -1000 and 1000 steps." };
  }
  return { value: parsed };
}
