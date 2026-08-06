import React from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BluetoothConnected,
  Edit3,
  Network,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Trash2,
  TriangleAlert,
} from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Input, InputField } from "@eight2five/ui/components/input";
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
import { ownTagDiscoveryWhileFocused } from "./tag-connection-lifecycle";
import {
  SettingsMessage,
  SettingsNavigationRow,
  SettingsScreenContainer,
  SettingsSection,
  SettingsSelectRow,
  SettingsValueRow,
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

/**
 * Shared route/modal entry point. Modal content owns discovery for its mounted
 * lifetime instead of depending on navigation focus, which keeps it usable
 * when rendered through the field HUD modal portal.
 */
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
  const router = useRouter();
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

  return (
    <TagConnectionBody
      lifecycleError={lifecycleError}
      onOpenNetworks={() => router.push("/(tabs)/settings/networks" as never)}
    />
  );
}

function MountedTagConnectionContent() {
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const [lifecycleError, setLifecycleError] = React.useState<Error>();

  React.useEffect(() => {
    return ownTagDiscoveryWhileFocused(
      store,
      snapshot.initialization === "ready",
      store.getSnapshot().connectionState === "connected",
      setLifecycleError,
    );
  }, [snapshot.initialization, store]);

  return <TagConnectionBody modal lifecycleError={lifecycleError} />;
}

function TagConnectionBody({
  modal = false,
  lifecycleError,
  onOpenNetworks,
}: {
  readonly modal?: boolean;
  readonly lifecycleError?: Error;
  readonly onOpenNetworks?: () => void;
}) {
  const theme = useEight2FiveTheme();
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const { settings } = useAppSettingsSnapshot();
  const developerMode = settings.developerModeEnabled;
  const [operation, setOperation] = React.useState(false);
  const [error, setError] = React.useState<Error>();
  const [labelEdit, setLabelEdit] = React.useState<{
    readonly deviceId?: string;
    readonly value: string;
  }>({ value: "" });
  const candidates = React.useMemo(
    () =>
      selectVisibleDiscoveries(snapshot.discoveries, {
        developerMode,
        cutoff: snapshot.discoveryRssiCutoff,
      }),
    [developerMode, snapshot.discoveries, snapshot.discoveryRssiCutoff],
  );

  const selectedLabel =
    snapshot.rememberedTag?.lastKnownConfig?.label ??
    snapshot.rememberedTag?.label ??
    "";
  const labelDraft =
    labelEdit.deviceId === snapshot.rememberedTag?.id
      ? labelEdit.value
      : selectedLabel;

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

      <SettingsSection title="Nearby Tags">
        {candidates.length === 0 ? (
          <Text
            style={{ color: theme.textMuted, padding: eight2FiveSpacing.md }}
          >
            {snapshot.connectionState === "scanning"
              ? "Looking for nearby tags…"
              : "No nearby tags meet the signal requirement."}
          </Text>
        ) : (
          candidates.map((device) => {
            const strength = signalStrengthForRssi(
              device.rssi,
              snapshot.discoveryRssiCutoff,
            );
            const role = device.presence?.role;
            return (
              <Pressable
                key={device.transportDeviceId}
                testID={`select-tag-${device.transportDeviceId}`}
                accessibilityRole="button"
                accessibilityLabel={`Connect to ${device.name ?? "nearby tag"}`}
                disabled={operation || (!developerMode && role !== "tag")}
                onPress={() =>
                  void run(async () => {
                    if (role === "tag") {
                      await store.selectConfigureAndConnectTag(
                        device.transportDeviceId,
                      );
                    } else if (developerMode) {
                      await store.persistDiscoveredAnchor(
                        device.transportDeviceId,
                      );
                    }
                  })
                }
              >
                <HStack
                  className="items-center"
                  style={{ gap: 12, padding: eight2FiveSpacing.md }}
                >
                  {developerMode ? (
                    <Text
                      style={{
                        color: theme.textMuted,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {device.rssi} dBm
                    </Text>
                  ) : (
                    <Icon
                      as={SIGNAL_ICONS[strength]}
                      style={{ color: theme.accent }}
                    />
                  )}
                  <VStack className="flex-1">
                    <Text style={{ color: theme.text }}>
                      {device.name ?? "Unnamed tag"}
                    </Text>
                    {developerMode ? (
                      <Text
                        size="sm"
                        selectable
                        style={{ color: theme.textMuted }}
                      >
                        {role ?? "unknown"} · {device.transportDeviceId}
                      </Text>
                    ) : null}
                  </VStack>
                </HStack>
              </Pressable>
            );
          })
        )}
      </SettingsSection>

      {developerMode ? (
        <SettingsSection title="Advanced">
          <SettingsSelectRow<string>
            icon={Network}
            title="Active network"
            description="A selected network is verified on tags during connection."
            value={snapshot.activeNetworkId ?? "none"}
            choices={[
              { label: "None", value: "none" },
              ...snapshot.networks.map((network) => ({
                label: network.name,
                value: network.id,
              })),
            ]}
            onChange={(value) =>
              void run(() =>
                store.setActiveNetwork(value === "none" ? undefined : value),
              )
            }
            disabled={operation}
            testID="active-network-setting"
          />
          {!modal && onOpenNetworks ? (
            <SettingsNavigationRow
              icon={Network}
              title="Manage networks and anchors"
              onPress={onOpenNetworks}
              testID="network-management-link"
            />
          ) : null}
          {snapshot.rememberedTag ? (
            <VStack style={{ gap: 10, padding: eight2FiveSpacing.md }}>
              <Input>
                <InputField
                  value={labelDraft}
                  maxLength={16}
                  accessibilityLabel="Broadcast name"
                  onChangeText={(value) =>
                    setLabelEdit({
                      deviceId: snapshot.rememberedTag?.id,
                      value,
                    })
                  }
                />
              </Input>
              <Button
                variant="outline"
                testID="rename-selected-tag-button"
                isDisabled={operation}
                onPress={() =>
                  void run(() => store.renameSelectedTag(labelDraft))
                }
              >
                <ButtonIcon as={Edit3} />
                <ButtonText>Change Broadcast Name</ButtonText>
              </Button>
              <SettingsValueRow
                icon={Network}
                title="Device ID"
                value={snapshot.rememberedTag.transportDeviceId}
              />
            </VStack>
          ) : null}
        </SettingsSection>
      ) : null}

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

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
