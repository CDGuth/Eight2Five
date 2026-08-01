import React from "react";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react-native";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Pressable } from "@eight2five/ui/components/pressable";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";

import {
  useMobilePansSnapshot,
  useMobilePansStore,
} from "../../pans/mobile-pans-context";
import {
  SettingsMessage,
  SettingsScreenContainer,
  SettingsSection,
  SettingsValueRow,
} from "./settings-components";

const BUSY_STATES = new Set(["scanning", "connecting", "reconnecting"]);

export function TagConnectionScreen() {
  const theme = useEight2FiveTheme();
  const store = useMobilePansStore();
  const snapshot = useMobilePansSnapshot();
  const [operation, setOperation] = React.useState<string>();
  const [error, setError] = React.useState<Error>();
  const busy = BUSY_STATES.has(snapshot.connectionState) || Boolean(operation);
  const candidates = snapshot.discoveries.filter(
    (device) => device.presence?.role !== "anchor",
  );

  const run = async (name: string, action: () => Promise<void>) => {
    if (operation) return;
    setOperation(name);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setOperation(undefined);
    }
  };

  return (
    <SettingsScreenContainer>
      {snapshot.initialization === "loading" ? (
        <SettingsMessage tone="info">Preparing PANS services…</SettingsMessage>
      ) : null}
      {snapshot.error || error ? (
        <SettingsMessage tone="error">
          {(error ?? snapshot.error)?.message}
        </SettingsMessage>
      ) : null}

      <SettingsSection title="Remembered Tag">
        <SettingsValueRow
          icon={connectionIcon(snapshot.connectionState)}
          title={
            snapshot.rememberedTag?.lastKnownConfig?.label ??
            snapshot.rememberedTag?.label ??
            "No tag selected"
          }
          description={snapshot.rememberedTag?.transportDeviceId}
          value={snapshot.connectionState}
        />
        {snapshot.rememberedTag?.nodeIdHex ? (
          <SettingsValueRow
            icon={Bluetooth}
            title="Node ID"
            value={snapshot.rememberedTag.nodeIdHex}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection title="Connection">
        <VStack
          style={{ gap: eight2FiveSpacing.sm, padding: eight2FiveSpacing.md }}
        >
          <Button
            testID="discover-tags-button"
            variant="outline"
            isDisabled={snapshot.initialization !== "ready" || busy}
            onPress={() => void run("discover", () => store.startDiscovery())}
            accessibilityLabel="Discover PANS tags"
          >
            {operation === "discover" ? (
              <ButtonSpinner />
            ) : (
              <ButtonIcon as={Bluetooth} />
            )}
            <ButtonText>Discover / Select</ButtonText>
          </Button>
          <HStack style={{ gap: eight2FiveSpacing.sm }}>
            <Button
              className="flex-1"
              testID="connect-tag-button"
              isDisabled={
                !snapshot.rememberedTag ||
                busy ||
                snapshot.connectionState === "connected"
              }
              onPress={() => void run("connect", () => store.connect())}
            >
              {operation === "connect" ? (
                <ButtonSpinner />
              ) : (
                <ButtonIcon as={BluetoothConnected} />
              )}
              <ButtonText>Connect</ButtonText>
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              testID="disconnect-tag-button"
              isDisabled={!snapshot.rememberedTag || Boolean(operation)}
              onPress={() => void run("disconnect", () => store.disconnect())}
            >
              <ButtonIcon as={BluetoothOff} />
              <ButtonText>Disconnect</ButtonText>
            </Button>
          </HStack>
          <Button
            variant="outline"
            testID="reconnect-tag-button"
            isDisabled={!snapshot.rememberedTag || busy}
            onPress={() => void run("reconnect", () => store.reconnect())}
          >
            <ButtonIcon as={RefreshCw} />
            <ButtonText>Reconnect</ButtonText>
          </Button>
          <Button
            variant="outline"
            testID="forget-tag-button"
            isDisabled={!snapshot.rememberedTag || Boolean(operation)}
            onPress={() => void run("forget", () => store.forgetTag())}
          >
            <ButtonIcon as={Trash2} />
            <ButtonText>Forget Tag</ButtonText>
          </Button>
        </VStack>
      </SettingsSection>

      {snapshot.connectionState === "scanning" || candidates.length > 0 ? (
        <SettingsSection title="Nearby Tags">
          {candidates.length === 0 ? (
            <HStack style={{ gap: 10, padding: eight2FiveSpacing.md }}>
              <Icon as={RefreshCw} style={{ color: theme.accent }} />
              <Text style={{ color: theme.textMuted }}>
                Scanning for compatible tags…
              </Text>
            </HStack>
          ) : (
            candidates.map((device) => (
              <Pressable
                key={device.transportDeviceId}
                testID={`select-tag-${device.transportDeviceId}`}
                accessibilityRole="button"
                accessibilityLabel={`Select ${device.name ?? device.transportDeviceId}`}
                onPress={() =>
                  void run("select", async () => {
                    await store.selectTag(device.transportDeviceId);
                    await store.stopDiscovery();
                  })
                }
              >
                <HStack
                  className="items-center"
                  style={{ gap: 12, padding: eight2FiveSpacing.md }}
                >
                  <Icon as={Bluetooth} style={{ color: theme.accent }} />
                  <VStack className="flex-1">
                    <Text style={{ color: theme.text }}>
                      {device.name ?? "PANS Tag"}
                    </Text>
                    <Text
                      size="sm"
                      selectable
                      style={{ color: theme.textMuted }}
                    >
                      {device.transportDeviceId}
                    </Text>
                  </VStack>
                  <Text
                    size="sm"
                    style={{
                      color: theme.textMuted,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {device.rssi} dBm
                  </Text>
                </HStack>
              </Pressable>
            ))
          )}
        </SettingsSection>
      ) : null}

      {snapshot.connectionState === "error" ? (
        <HStack style={{ gap: 10 }}>
          <Icon as={TriangleAlert} style={{ color: theme.warning }} />
          <Text selectable style={{ color: theme.textMuted }}>
            Move closer to the tag, verify Bluetooth is enabled, then reconnect.
          </Text>
        </HStack>
      ) : null}
    </SettingsScreenContainer>
  );
}

function connectionIcon(state: string) {
  if (state === "connected") return BluetoothConnected;
  if (state === "disconnected" || state === "error") return BluetoothOff;
  return Bluetooth;
}
