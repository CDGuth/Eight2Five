import React from "react";
import {
  Activity,
  Database,
  Radio,
  RefreshCw,
  SlidersHorizontal,
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
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import { buildDeveloperDiagnosticRows } from "./developer-diagnostics";
import { AnchorNumberInput } from "./standard-anchor-position-form";
import {
  SettingsMessage,
  SettingsSection,
  SettingsValueRow,
} from "./settings-components";

export function DeveloperPansSections() {
  const theme = useEight2FiveTheme();
  const store = useMobilePansStore();
  const pans = useMobilePansSnapshot();
  const [refreshing, setRefreshing] = React.useState(false);
  const [operationError, setOperationError] = React.useState<Error>();
  const [rssiDraft, setRssiDraft] = React.useState(() =>
    pans.discoveryRssiCutoff.toString(),
  );
  const rows = React.useMemo(() => buildDeveloperDiagnosticRows(pans), [pans]);
  const parsedRssi = Number(rssiDraft);
  const validRssi =
    Number.isInteger(parsedRssi) && parsedRssi >= -100 && parsedRssi <= -30;

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setOperationError(undefined);
    try {
      await store.refreshDiagnostics();
    } catch (cause) {
      setOperationError(toError(cause));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      {operationError ? (
        <SettingsMessage tone="error">{operationError.message}</SettingsMessage>
      ) : null}
      {pans.commissioningWarning ? (
        <SettingsMessage tone="warning">
          {pans.commissioningWarning}
        </SettingsMessage>
      ) : null}

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
              void store
                .setDiscoveryRssiCutoff(parsedRssi)
                .catch((cause) => setOperationError(toError(cause)))
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
    </>
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
