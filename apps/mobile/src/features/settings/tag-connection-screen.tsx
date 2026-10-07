import React from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BluetoothConnected,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Trash2,
  TriangleAlert,
} from "lucide-react-native";
import { Button, ButtonIcon } from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { ScrollView } from "@eight2five/ui/components/scroll-view";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import { useAppSettingsSnapshot } from "../../state/app-settings-store";
import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import {
  selectVisibleDiscoveries,
  signalStrengthForRssi,
  type SignalStrength,
} from "../../pans/mobile-pans-ui";
import { ConnectionStatusRow } from "./connection-status-row";
import { NetworkDeviceManager } from "./network-device-manager";
import { ownTagDiscoveryWhileFocused } from "./tag-connection-lifecycle";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
} from "./settings-components";

const SIGNAL_ICONS: Record<SignalStrength, typeof Signal> = {
  full: Signal,
  high: SignalHigh,
  medium: SignalMedium,
  low: SignalLow,
};

export function TagConnectionScreen() {
  return <FocusedTagConnectionContent />;
}

/** Shared route/modal entry point. Mounted modal content owns discovery itself. */
export function TagConnectionContent({
  modal = false,
}: {
  readonly modal?: boolean;
}) {
  return modal ? (
    <MountedTagConnectionContent />
  ) : (
    <FocusedTagConnectionContent />
  );
}

function FocusedTagConnectionContent() {
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const [lifecycleError, setLifecycleError] = React.useState<Error>();

  useFocusEffect(
    React.useCallback(() => {
      setLifecycleError(undefined);
      return ownTagDiscoveryWhileFocused(
        store,
        snapshot.initialization === "ready",
        store.getSnapshot().connectionState === "connected",
        setLifecycleError,
      );
    }, [snapshot.initialization, store]),
  );

  return <TagConnectionBody lifecycleError={lifecycleError} />;
}

function MountedTagConnectionContent() {
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const [lifecycleError, setLifecycleError] = React.useState<Error>();

  React.useEffect(
    () =>
      ownTagDiscoveryWhileFocused(
        store,
        snapshot.initialization === "ready",
        store.getSnapshot().connectionState === "connected",
        setLifecycleError,
      ),
    [snapshot.initialization, store],
  );

  return <TagConnectionBody modal lifecycleError={lifecycleError} />;
}

function TagConnectionBody({
  modal = false,
  lifecycleError,
}: {
  readonly modal?: boolean;
  readonly lifecycleError?: Error;
}) {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const { settings } = useAppSettingsSnapshot();
  const developerMode = settings.developerModeEnabled;
  const [operation, setOperation] = React.useState(false);
  const [error, setError] = React.useState<Error>();
  const candidates = React.useMemo(
    () =>
      selectVisibleDiscoveries(snapshot.discoveries, {
        developerMode: false,
        cutoff: snapshot.discoveryRssiCutoff,
      }).filter((device) => device.presence?.role === "tag"),
    [snapshot.discoveries, snapshot.discoveryRssiCutoff],
  );

  const run = async (action: () => Promise<void>) => {
    if (operation) return;
    setOperation(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(toError(cause));
    } finally {
      setOperation(false);
    }
  };

  const content = (
    <>
      {snapshot.error || lifecycleError || error ? (
        <SettingsMessage tone="error">
          {(error ?? lifecycleError ?? snapshot.error)?.message}
        </SettingsMessage>
      ) : null}

      <SettingsSection title="Connection">
        <ConnectionStatusRow state={snapshot.connectionState} />
        {snapshot.rememberedTag ? (
          <HStack
            className="items-center"
            style={{ gap: 12, padding: eight2FiveSpacing.md }}
          >
            <Icon as={BluetoothConnected} style={{ color: theme.success }} />
            <Text className="flex-1" style={{ color: theme.text }}>
              {snapshot.rememberedTag.lastKnownConfig?.label ??
                snapshot.rememberedTag.label ??
                "Selected tag"}
            </Text>
            <Button
              variant="outline"
              size="sm"
              testID="clear-selected-tag-button"
              isDisabled={operation}
              accessibilityLabel="Remove selected tag"
              onPress={() => void run(() => store.clearSelectedTag())}
            >
              <ButtonIcon as={Trash2} />
            </Button>
          </HStack>
        ) : null}
      </SettingsSection>

      {developerMode ? (
        <SettingsSection title="Networks & Devices">
          <VStack style={{ padding: eight2FiveSpacing.md }}>
            <NetworkDeviceManager
              onConnectTag={(transportDeviceId) =>
                store.selectConfigureAndConnectTag(transportDeviceId)
              }
              onEditAnchorPosition={(anchorId) =>
                router.push(`/(tabs)/settings/anchor/${anchorId}` as never)
              }
            />
          </VStack>
        </SettingsSection>
      ) : (
        <NearbyTagList
          candidates={candidates}
          cutoff={snapshot.discoveryRssiCutoff}
          scanning={snapshot.connectionState === "scanning"}
          disabled={operation}
          onSelect={(transportDeviceId) =>
            void run(() =>
              store.selectConfigureAndConnectTag(transportDeviceId),
            )
          }
        />
      )}

      {snapshot.connectionState === "error" ? (
        <HStack style={{ gap: 10 }}>
          <Icon as={TriangleAlert} style={{ color: theme.warning }} />
          <Text selectable style={{ color: theme.textMuted }}>
            Move closer, verify Bluetooth is available, and try again.
          </Text>
        </HStack>
      ) : null}
    </>
  );

  if (!modal)
    return <SettingsScreenContainer>{content}</SettingsScreenContainer>;
  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        gap: eight2FiveSpacing.lg,
        paddingBottom: eight2FiveSpacing.md,
      }}
      testID="tag-connection-modal-content"
    >
      {content}
    </ScrollView>
  );
}

function NearbyTagList({
  candidates,
  cutoff,
  scanning,
  disabled,
  onSelect,
}: {
  readonly candidates: ReturnType<typeof selectVisibleDiscoveries>;
  readonly cutoff: number;
  readonly scanning: boolean;
  readonly disabled: boolean;
  readonly onSelect: (transportDeviceId: string) => void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <SettingsSection title="Nearby Tags">
      {candidates.length === 0 ? (
        <Text style={{ color: theme.textMuted, padding: eight2FiveSpacing.md }}>
          {scanning
            ? "Looking for nearby tags…"
            : "No nearby tags meet the signal requirement."}
        </Text>
      ) : (
        candidates.map((device) => {
          const strength = signalStrengthForRssi(device.rssi, cutoff);
          return (
            <Pressable
              key={device.transportDeviceId}
              testID={`select-tag-${device.transportDeviceId}`}
              accessibilityRole="button"
              accessibilityLabel={`Connect to ${device.name ?? "nearby tag"}`}
              disabled={disabled}
              onPress={() => onSelect(device.transportDeviceId)}
            >
              <HStack
                className="items-center"
                style={{ gap: 12, padding: eight2FiveSpacing.md }}
              >
                <Icon
                  as={SIGNAL_ICONS[strength]}
                  style={{ color: theme.accent }}
                />
                <Text className="flex-1" style={{ color: theme.text }}>
                  {device.name ?? "Unnamed tag"}
                </Text>
              </HStack>
            </Pressable>
          );
        })
      )}
    </SettingsSection>
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
