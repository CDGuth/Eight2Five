import React from "react";
import { Alert } from "react-native";
import {
  Crosshair,
  Network,
  Pencil,
  Radio,
  Save,
  ShieldCheck,
  X,
} from "lucide-react-native";
import {
  formatPanId,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  type ManagedNetwork,
} from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Heading } from "@eight2five/ui/components/heading";
import { HStack } from "@eight2five/ui/components/hstack";
import { Icon } from "@eight2five/ui/components/icon";
import { Input, InputField } from "@eight2five/ui/components/input";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@eight2five/ui/components/modal";
import { Text } from "@eight2five/ui/components/text";
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";

import { SpinningLoaderIcon } from "../../components/spinning-loader-icon";
import { SettingsMessage, SettingsSelectRow } from "./settings-components";

export function PansDeviceDialog({
  device,
  discovery,
  networks,
  isOpen,
  onClose,
  onRename,
  onAssignNetwork,
  onConvertToAnchor,
  onConvertToPerformerTag,
  onSetInitiator,
  onEditAnchorPosition,
}: {
  readonly device?: ManagedDevice;
  readonly discovery?: DiscoveredDeviceSnapshot;
  readonly networks: readonly ManagedNetwork[];
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onRename: (deviceId: string, label: string) => Promise<void>;
  readonly onAssignNetwork: (
    deviceId: string,
    networkId: string,
  ) => Promise<void>;
  readonly onConvertToAnchor: (
    transportDeviceId: string,
    targetNetworkId?: string,
  ) => Promise<void>;
  readonly onConvertToPerformerTag: (deviceId: string) => Promise<void>;
  readonly onSetInitiator: (
    networkId: string,
    anchorId: string,
  ) => Promise<void>;
  readonly onEditAnchorPosition: (anchorId: string) => void;
}) {
  const theme = useEight2FiveTheme();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  const config = device?.lastKnownConfig;
  const role =
    config?.role ?? device?.role ?? discovery?.presence?.role ?? "unknown";
  const label =
    config?.label ?? device?.label ?? discovery?.name ?? "Unnamed PANS device";
  const available = Boolean(discovery && !discovery.stale);
  const currentNetwork =
    networks.find((network) => network.id === device?.networkId) ??
    networks.find(
      (network) =>
        config?.panId !== undefined && network.panId === config.panId,
    );
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [labelDraft, setLabelDraft] = React.useState(label);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    } finally {
      setBusy(false);
    }
  };

  const saveLabel = () => {
    if (!device || !labelDraft.trim()) return;
    void run(async () => {
      await onRename(device.id, labelDraft);
      setEditingLabel(false);
    });
  };

  const confirmConvertToAnchor = () => {
    if (!discovery) return;
    Alert.alert(
      "Convert device to anchor?",
      "This writes the production anchor role/profile to the PANS device and interrupts any current tag use.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert to Anchor",
          style: "destructive",
          onPress: () =>
            void run(() =>
              onConvertToAnchor(
                discovery.transportDeviceId,
                currentNetwork?.id,
              ),
            ),
        },
      ],
    );
  };

  const confirmConvertToPerformerTag = () => {
    if (!device) return;
    Alert.alert(
      "Convert device to performer tag?",
      "This writes the production performer-tag role/profile to the PANS device and disables anchor-only behavior.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert to Tag",
          style: "destructive",
          onPress: () => void run(() => onConvertToPerformerTag(device.id)),
        },
      ],
    );
  };

  const networkChoices = React.useMemo(
    () => [
      { label: "Choose a network", value: "none" },
      ...networks.map((network) => ({
        label: `${network.name} (${formatPanId(network.panId)})`,
        value: network.id,
      })),
    ],
    [networks],
  );

  return (
    <Modal isOpen={isOpen} onClose={busy ? undefined : onClose} size="lg">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader className="items-center justify-between">
          <Heading size="md">Device Settings</Heading>
          <ModalCloseButton
            accessibilityLabel="Close device settings"
            disabled={busy}
          >
            <Icon as={X} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody>
          <VStack style={{ gap: eight2FiveSpacing.md }}>
            {error ? (
              <SettingsMessage tone="error">{error.message}</SettingsMessage>
            ) : null}

            <VStack style={{ gap: eight2FiveSpacing.sm }}>
              <HStack
                className="items-center"
                style={{ gap: eight2FiveSpacing.sm }}
              >
                <VStack className="flex-1" style={{ gap: 2 }}>
                  <Text
                    style={{
                      color: theme.text,
                      fontFamily: eight2FiveFonts.styleSemibold,
                      fontSize: 18,
                    }}
                  >
                    {label}
                  </Text>
                  <Text selectable size="sm" style={{ color: theme.textMuted }}>
                    {device?.transportDeviceId ??
                      discovery?.transportDeviceId ??
                      "Unavailable"}
                  </Text>
                </VStack>
                {device ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    testID="edit-device-broadcast-name-button"
                    accessibilityLabel="Edit broadcast name"
                    isDisabled={busy}
                    onPress={() => setEditingLabel((value) => !value)}
                  >
                    <ButtonIcon as={Pencil} style={{ color: theme.accent }} />
                  </Button>
                ) : null}
              </HStack>

              {editingLabel && device ? (
                <HStack
                  className="items-center"
                  style={{ gap: eight2FiveSpacing.sm }}
                >
                  <Input className="flex-1" isDisabled={busy}>
                    <InputField
                      testID="device-broadcast-name-input"
                      value={labelDraft}
                      editable={!busy}
                      accessibilityLabel="PANS broadcast name"
                      onChangeText={setLabelDraft}
                    />
                  </Input>
                  <Button
                    size="sm"
                    testID="save-device-broadcast-name-button"
                    isDisabled={
                      busy ||
                      !labelDraft.trim() ||
                      labelDraft.trim() === label.trim()
                    }
                    onPress={saveLabel}
                  >
                    {busy ? <SpinningLoaderIcon /> : <ButtonIcon as={Save} />}
                    <ButtonText>Save</ButtonText>
                  </Button>
                </HStack>
              ) : null}
            </VStack>

            <VStack style={{ gap: 8 }}>
              <AutomaticValue
                label="Availability"
                value={available ? "Nearby" : "Cached only"}
              />
              <AutomaticValue label="Role" value={role} />
              <AutomaticValue
                label="Network"
                value={currentNetwork?.name ?? "Unassigned / unverified"}
              />
              <AutomaticValue
                label="PAN ID"
                value={
                  config?.panId === undefined
                    ? "Unavailable"
                    : formatPanId(config.panId)
                }
              />
              <AutomaticValue
                label="UWB mode"
                value={config?.uwbMode ?? "Unavailable"}
              />
              <AutomaticValue
                label="LED"
                value={formatBoolean(config?.ledEnabled)}
              />
              <AutomaticValue
                label="Firmware updates"
                value={formatBoolean(config?.firmwareUpdateEnabled)}
              />
              {config?.role === "tag" ? (
                <>
                  <AutomaticValue
                    label="Location engine"
                    value={formatBoolean(config.locationEngineEnabled)}
                  />
                  <AutomaticValue
                    label="Low-power mode"
                    value={formatBoolean(config.lowPowerModeEnabled)}
                  />
                  <AutomaticValue
                    label="Stationary detection"
                    value={formatBoolean(config.stationaryDetectionEnabled)}
                  />
                  <AutomaticValue
                    label="Location data mode"
                    value={config.locationDataMode?.toString() ?? "Unavailable"}
                  />
                </>
              ) : null}
              {config?.role === "anchor" ? (
                <AutomaticValue
                  label="Initiator"
                  value={formatBoolean(config.initiatorEnabled)}
                />
              ) : null}
            </VStack>

            {device && networks.length > 0 ? (
              <SettingsSelectRow<string>
                icon={Network}
                title="Assign to network"
                description="Explicitly writes the selected network PAN ID to this device. Other production profile settings remain automatic."
                value={currentNetwork?.id ?? "none"}
                choices={networkChoices}
                onChange={(networkId) => {
                  if (networkId === "none" || networkId === currentNetwork?.id)
                    return;
                  void run(() => onAssignNetwork(device.id, networkId));
                }}
                disabled={busy}
                testID="device-network-assignment"
              />
            ) : null}

            {device && role === "anchor" ? (
              <VStack style={{ gap: eight2FiveSpacing.sm }}>
                <Button
                  variant="outline"
                  testID="edit-anchor-position-button"
                  isDisabled={busy}
                  onPress={() => onEditAnchorPosition(device.id)}
                >
                  <ButtonIcon as={Crosshair} />
                  <ButtonText>Edit Anchor Position</ButtonText>
                </Button>
                {currentNetwork ? (
                  <Button
                    variant="outline"
                    testID="set-device-initiator-button"
                    isDisabled={
                      busy ||
                      (config?.role === "anchor" && config.initiatorEnabled)
                    }
                    onPress={() =>
                      void run(() =>
                        onSetInitiator(currentNetwork.id, device.id),
                      )
                    }
                  >
                    <ButtonIcon as={ShieldCheck} />
                    <ButtonText>
                      {config?.role === "anchor" && config.initiatorEnabled
                        ? "Network Initiator"
                        : "Set as Network Initiator"}
                    </ButtonText>
                  </Button>
                ) : null}
              </VStack>
            ) : null}

            {role !== "anchor" && discovery ? (
              <Button
                variant="outline"
                testID="convert-device-to-anchor-button"
                isDisabled={busy}
                onPress={confirmConvertToAnchor}
              >
                <ButtonIcon as={Radio} />
                <ButtonText>Convert to Anchor…</ButtonText>
              </Button>
            ) : null}

            {role === "anchor" && device ? (
              <Button
                variant="outline"
                testID="convert-device-to-performer-tag-button"
                isDisabled={busy || !available}
                onPress={confirmConvertToPerformerTag}
              >
                <ButtonIcon as={Radio} />
                <ButtonText>Convert to Performer Tag…</ButtonText>
              </Button>
            ) : null}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" isDisabled={busy} onPress={onClose}>
            <ButtonText>Close</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AutomaticValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack className="items-start justify-between" style={{ gap: 16 }}>
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text
        selectable
        size="sm"
        style={{ color: theme.text, textAlign: "right" }}
      >
        {value}
      </Text>
    </HStack>
  );
}

function formatBoolean(value: boolean | undefined): string {
  return value === undefined ? "Unavailable" : value ? "On" : "Off";
}
