import React from "react";
import type {
  ManagedNetwork,
  MigrateNetworkProfilePanResult,
  PansBatchOperationItem,
} from "@eight2five/mobile/pans-manager";
import { formatPanId } from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Divider } from "@eight2five/ui/components/divider";
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
import {
  Popover,
  PopoverArrow,
  PopoverBackdrop,
  PopoverBody,
  PopoverContent,
} from "@eight2five/ui/components/popover";
import { Text } from "@eight2five/ui/components/text";
import { Textarea, TextareaInput } from "@eight2five/ui/components/textarea";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";
import { Info, X } from "lucide-react-native";

import {
  useManagedDevices,
  useManagedNetworks,
  usePansDiscoveryList,
} from "./manager-context";
import { useRepositoryNetworkActions } from "./actions/repository-network-actions";
import { useDeviceConfigurationActions } from "./actions/device-configuration-actions";
import { displayError } from "./manager-utils";
import {
  reviewNetworkEdit,
  stablePanMigrationOperationId,
} from "./network-edit-form";
import { SettingInfoCard } from "./components/setting-help";

export interface NetworkEditModalProps {
  network?: ManagedNetwork;
  isOpen: boolean;
  onClose(): void;
}

export function NetworkEditModal({
  network,
  isOpen,
  onClose,
}: NetworkEditModalProps) {
  const theme = useEight2FiveTheme();
  const networks = useManagedNetworks();
  const devices = useManagedDevices();
  const discoveries = usePansDiscoveryList();
  const { saveNetworkLocalDetails, deleteNetwork: deleteNetworkProfile } =
    useRepositoryNetworkActions();
  const { migrateNetworkPan } = useDeviceConfigurationActions();
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [panInput, setPanInput] = React.useState("");
  const [targetPanId, setTargetPanId] = React.useState<number>();
  const [operationId, setOperationId] = React.useState<string>();
  const [progress, setProgress] = React.useState<
    Record<string, PansBatchOperationItem>
  >({});
  const [result, setResult] = React.useState<MigrateNetworkProfilePanResult>();
  const [error, setError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);
  const [migrating, setMigrating] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const abortController = React.useRef<AbortController | undefined>(undefined);
  const loadedNetworkId = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!isOpen || !network || loadedNetworkId.current === network.id) return;
    loadedNetworkId.current = network.id;
    setName(network.name);
    setNotes(network.notes ?? "");
    setPanInput(String(network.panId));
    setTargetPanId(undefined);
    setOperationId(undefined);
    setProgress({});
    setResult(undefined);
    setError(undefined);
    setConfirmingDelete(false);
  }, [isOpen, network]);

  React.useEffect(() => {
    if (isOpen) return;
    loadedNetworkId.current = undefined;
    abortController.current?.abort();
  }, [isOpen]);

  if (!network) return null;

  const members = devices.filter((device) => device.networkId === network.id);
  const availableCount = members.filter((device) =>
    discoveries.some(
      (discovery) =>
        discovery.transportDeviceId === device.transportDeviceId &&
        !discovery.stale,
    ),
  ).length;
  const reviewing = targetPanId !== undefined && targetPanId !== network.panId;

  const reviewOrSave = async () => {
    setSaving(true);
    setError(undefined);
    setResult(undefined);
    try {
      const review = reviewNetworkEdit(
        network,
        panInput,
        networks,
        members.length,
        availableCount,
      );
      await saveNetworkLocalDetails({
        networkId: network.id,
        name,
        notes,
      });
      if (!review.confirmation) {
        setTargetPanId(undefined);
        setOperationId(undefined);
        onClose();
        return;
      }
      setTargetPanId(review.targetPanId);
      setOperationId((current) =>
        stablePanMigrationOperationId(current, () =>
          createPanMigrationOperationId(network.id, review.targetPanId),
        ),
      );
    } catch (saveError) {
      setError(displayError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const confirmMigration = async () => {
    if (targetPanId === undefined || !operationId) return;
    setMigrating(true);
    setError(undefined);
    const controller = new AbortController();
    abortController.current = controller;
    try {
      const nextResult = await migrateNetworkPan({
        networkId: network.id,
        targetPanId,
        operationId,
        signal: controller.signal,
        onItemChange: (item) =>
          setProgress((current) => ({ ...current, [item.deviceId]: item })),
      });
      setResult(nextResult);
      if (nextResult.error) setError(nextResult.error.message);
    } catch (migrationError) {
      setError(displayError(migrationError));
    } finally {
      if (abortController.current === controller)
        abortController.current = undefined;
      setMigrating(false);
    }
  };

  const deleteNetwork = async () => {
    setDeleting(true);
    setError(undefined);
    try {
      await deleteNetworkProfile(network.id);
      onClose();
    } catch (deleteError) {
      setError(displayError(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      testID="network-edit-modal-root"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      avoidKeyboard
    >
      <ModalBackdrop />
      <ModalContent
        testID="network-edit-modal"
        className="shadow-none"
        style={{
          maxHeight: "90%",
          backgroundColor: theme.background,
          borderColor: theme.border,
          borderRadius: eight2FiveRadii.md,
        }}
      >
        <ModalHeader>
          <Heading size="lg" style={{ color: theme.text }}>
            Edit network
          </Heading>
          <ModalCloseButton accessibilityLabel="Close network editor">
            <Icon as={X} style={{ color: theme.icon }} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody
          scrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: eight2FiveSpacing.md }}
        >
          {!reviewing ? (
            <>
              <VStack style={{ gap: eight2FiveSpacing.xs }}>
                <HStack
                  className="items-center"
                  style={{ gap: eight2FiveSpacing.xs }}
                >
                  <FieldLabel>Network name</FieldLabel>
                  <Popover
                    placement="bottom"
                    trigger={(triggerProps) => (
                      <Button
                        {...triggerProps}
                        testID="network-name-info"
                        size="icon"
                        variant="ghost"
                        accessibilityLabel="About network names"
                      >
                        <ButtonIcon as={Info} style={{ color: theme.icon }} />
                      </Button>
                    )}
                  >
                    <PopoverBackdrop />
                    <PopoverContent
                      className="shadow-none"
                      style={{
                        backgroundColor: theme.surfaceRaised,
                        borderColor: theme.border,
                      }}
                    >
                      <PopoverArrow />
                      <PopoverBody>
                        <Text selectable style={{ color: theme.text }}>
                          {
                            "The network name is stored only in this app. PANS devices identify the network using the Network ID."
                          }
                        </Text>
                      </PopoverBody>
                    </PopoverContent>
                  </Popover>
                </HStack>
                <Input style={fieldStyle(theme)}>
                  <InputField
                    testID="network-name-input"
                    value={name}
                    onChangeText={setName}
                    style={{ color: theme.text }}
                  />
                </Input>
              </VStack>
              <VStack style={{ gap: eight2FiveSpacing.xs }}>
                <FieldLabel>PANS Network ID</FieldLabel>
                <Input style={fieldStyle(theme)}>
                  <InputField
                    testID="network-pan-input"
                    value={panInput}
                    onChangeText={setPanInput}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    style={{ color: theme.text }}
                  />
                </Input>
              </VStack>
              <VStack style={{ gap: eight2FiveSpacing.xs }}>
                <FieldLabel>Notes</FieldLabel>
                <Textarea style={fieldStyle(theme)}>
                  <TextareaInput
                    testID="network-notes-input"
                    value={notes}
                    onChangeText={setNotes}
                    style={{ color: theme.text }}
                  />
                </Textarea>
              </VStack>
              <VStack style={{ gap: eight2FiveSpacing.sm }}>
                <Heading size="md" style={{ color: theme.text }}>
                  Destructive actions
                </Heading>
                <SettingInfoCard tone="warning">
                  Deleting this saved profile removes its app settings and
                  position logs. Device hardware is not changed; cached devices
                  move to Unassigned if no remaining profile matches their PAN.
                </SettingInfoCard>
                {confirmingDelete ? (
                  <VStack style={{ gap: eight2FiveSpacing.sm }}>
                    <Text
                      selectable
                      accessibilityRole="alert"
                      style={{ color: theme.danger }}
                    >
                      Delete “{network.name}” from this phone? PANS hardware PAN
                      IDs will remain unchanged.
                    </Text>
                    <HStack
                      className="flex-wrap"
                      style={{ gap: eight2FiveSpacing.sm }}
                    >
                      <Button
                        testID="confirm-delete-network"
                        variant="destructive"
                        isDisabled={deleting}
                        onPress={() => void deleteNetwork()}
                      >
                        {deleting ? (
                          <ButtonSpinner color={theme.raw.white} />
                        ) : null}
                        <ButtonText>Delete saved network</ButtonText>
                      </Button>
                      <Button
                        variant="outline"
                        isDisabled={deleting}
                        onPress={() => setConfirmingDelete(false)}
                      >
                        <ButtonText>Cancel deletion</ButtonText>
                      </Button>
                    </HStack>
                  </VStack>
                ) : (
                  <Button
                    testID="request-delete-network"
                    variant="destructive"
                    onPress={() => setConfirmingDelete(true)}
                  >
                    <ButtonText>Delete saved network</ButtonText>
                  </Button>
                )}
              </VStack>
            </>
          ) : (
            <VStack
              testID="network-pan-confirmation"
              style={{ gap: eight2FiveSpacing.md }}
            >
              <Heading size="md" style={{ color: theme.text }}>
                Confirm PANS Network ID change
              </Heading>
              <SummaryRow
                label="Old Network ID"
                value={formatPanId(network.panId)}
              />
              <SummaryRow
                label="New Network ID"
                value={formatPanId(targetPanId)}
              />
              <SummaryRow
                label="Affected members"
                value={String(members.length)}
              />
              <SummaryRow
                label="Currently available"
                value={String(availableCount)}
              />
              <Text selectable size="sm" style={{ color: theme.textMuted }}>
                The profile changes only after every member verifies the new
                Network ID.
              </Text>
              {Object.values(progress).map((item) => (
                <SummaryRow
                  key={item.deviceId}
                  label={item.deviceId}
                  value={`${item.status}${item.error ? ` — ${item.error.message}` : ""}`}
                />
              ))}
              {result?.deviceResults.map((item) => (
                <VStack key={item.deviceId} style={{ gap: two }}>
                  <SummaryRow label={item.deviceId} value={item.outcome} />
                  {item.configuration?.writes.map((write) => (
                    <Text
                      key={`${item.deviceId}-${write.field}`}
                      selectable
                      size="xs"
                      style={{
                        color: write.warning ? theme.warning : theme.textMuted,
                      }}
                    >
                      {write.field}: {write.status}
                      {write.actual === undefined
                        ? ""
                        : ` · readback ${String(write.actual)}`}
                    </Text>
                  ))}
                  {item.error ? (
                    <Text selectable size="xs" style={{ color: theme.danger }}>
                      {item.error.message}
                    </Text>
                  ) : null}
                </VStack>
              ))}
            </VStack>
          )}
          {error ? (
            <Text
              selectable
              accessibilityRole="alert"
              style={{ color: theme.danger }}
            >
              {error}
            </Text>
          ) : null}
          {result ? (
            <Text
              testID="network-migration-result"
              selectable
              style={{
                color:
                  result.outcome === "migrated" ? theme.success : theme.warning,
              }}
            >
              Migration {result.outcome}.
            </Text>
          ) : null}
        </ModalBody>
        <Divider style={{ backgroundColor: theme.border }} />
        <ModalFooter className="flex-wrap pt-4">
          {reviewing ? (
            <>
              {migrating ? (
                <Button
                  testID="cancel-pan-migration"
                  variant="outline"
                  onPress={() => abortController.current?.abort()}
                >
                  <ButtonText>Cancel after current device</ButtonText>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onPress={() => {
                    setTargetPanId(undefined);
                    setOperationId(undefined);
                    setResult(undefined);
                    setError(undefined);
                  }}
                >
                  <ButtonText>Back</ButtonText>
                </Button>
              )}
              <Button
                testID={
                  result ? "retry-pan-migration" : "confirm-pan-migration"
                }
                isDisabled={migrating || result?.outcome === "migrated"}
                onPress={() => void confirmMigration()}
              >
                {migrating ? <ButtonSpinner color={theme.raw.white} /> : null}
                <ButtonText>
                  {result ? "Retry" : "Change Network ID"}
                </ButtonText>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onPress={onClose}>
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                testID="review-network-changes"
                isDisabled={saving || deleting || confirmingDelete}
                onPress={() => void reviewOrSave()}
              >
                {saving ? <ButtonSpinner color={theme.raw.white} /> : null}
                <ButtonText>Save</ButtonText>
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function createPanMigrationOperationId(
  networkId: string,
  targetPanId: number,
  nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
): string {
  return `network-pan-${networkId}-${targetPanId}-${nonce}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const theme = useEight2FiveTheme();
  return (
    <Text
      style={{ color: theme.text, fontFamily: eight2FiveFonts.styleSemibold }}
    >
      {children}
    </Text>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      className="items-start justify-between"
      style={{ gap: eight2FiveSpacing.md }}
    >
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text
        selectable
        size="sm"
        className="shrink text-right"
        style={{ color: theme.text, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </HStack>
  );
}

function fieldStyle(theme: ReturnType<typeof useEight2FiveTheme>) {
  return {
    minHeight: 44,
    borderColor: theme.border,
    borderRadius: eight2FiveRadii.sm,
    backgroundColor: theme.surface,
  };
}

const two = 2;
