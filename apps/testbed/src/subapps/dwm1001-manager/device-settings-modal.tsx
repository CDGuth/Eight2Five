import React from "react";
import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  PansConfigurationResult,
} from "@eight2five/mobile/pans-manager";
import {
  formatPanId,
  getNetworkDisplayName,
  resolveCachedProfileMatch,
} from "@eight2five/mobile/pans-manager";
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
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from "@eight2five/ui/components/select";
import { Switch } from "@eight2five/ui/components/switch";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";
import { ChevronDown, ChevronUp, X } from "lucide-react-native";

import {
  buildDeviceConfigurationDiff,
  deviceSettingsFormFrom,
  mergeInspectionIntoDeviceSettingsForm,
  shouldAutoInspectDevice,
  type DeviceSettingsFormValues,
} from "./device-settings-form";
import { usePansManager } from "./manager-context";
import { displayError } from "./manager-utils";
import { SettingHelp, SettingInfoCard } from "./components/setting-help";

export interface DeviceSettingsModalProps {
  device?: ManagedDevice;
  discovery?: DiscoveredDeviceSnapshot;
  isOpen: boolean;
  available: boolean;
  destructiveActionRequested?: boolean;
  onClose(): void;
}

export function DeviceSettingsModal({
  device,
  discovery,
  isOpen,
  available,
  destructiveActionRequested = false,
  onClose,
}: DeviceSettingsModalProps) {
  const theme = useEight2FiveTheme();
  const manager = usePansManager();
  const [baseline, setBaseline] = React.useState<DeviceSettingsFormValues>();
  const [form, setForm] = React.useState<DeviceSettingsFormValues>();
  const inspectionAttempted = React.useRef(false);
  const [inspecting, setInspecting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [inspectionError, setInspectionError] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [configurationResult, setConfigurationResult] =
    React.useState<PansConfigurationResult>();
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [confirmingDestructiveAction, setConfirmingDestructiveAction] =
    React.useState(false);
  const [destructiveBusy, setDestructiveBusy] = React.useState(false);
  const loadedDeviceId = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!isOpen || !device || loadedDeviceId.current === device.id) return;
    loadedDeviceId.current = device.id;
    const initial = deviceSettingsFormFrom(device, discovery?.name);
    setBaseline(initial);
    setForm(initial);
    inspectionAttempted.current = false;
    setInspectionError(undefined);
    setError(undefined);
    setConfigurationResult(undefined);
    setAdvancedOpen(false);
    setConfirmingDestructiveAction(false);
  }, [destructiveActionRequested, device, discovery?.name, isOpen]);

  React.useEffect(() => {
    if (!isOpen) loadedDeviceId.current = undefined;
  }, [isOpen]);

  const inspectDevice = manager.inspectDevice;
  const deviceId = device?.id;
  React.useEffect(() => {
    if (!deviceId || !isOpen || inspectionAttempted.current) return;
    const shouldInspect = shouldAutoInspectDevice(
      isOpen,
      available,
      inspectionAttempted.current,
    );
    inspectionAttempted.current = true;
    if (!shouldInspect) return;
    setInspecting(true);
    setInspectionError(undefined);
    inspectDevice(deviceId)
      .then((inspection) => {
        if (loadedDeviceId.current !== deviceId) return;
        setForm((current) =>
          current
            ? mergeInspectionIntoDeviceSettingsForm(current, inspection)
            : current,
        );
        setBaseline((current) =>
          current
            ? mergeInspectionIntoDeviceSettingsForm(current, inspection)
            : current,
        );
      })
      .catch((inspectError) => {
        if (loadedDeviceId.current === deviceId)
          setInspectionError(displayError(inspectError));
      })
      .finally(() => {
        if (loadedDeviceId.current === deviceId) setInspecting(false);
      });
  }, [available, deviceId, inspectDevice, isOpen]);

  if (!device || !form || !baseline) return null;

  const hardwareEditable = available && !inspecting;
  const roleBaselineAvailable = baseline.role !== undefined;
  const roleFieldsEditable =
    hardwareEditable && baseline.role === form.role && form.role !== undefined;
  const profileMatch = resolveCachedProfileMatch(manager.networks, form.panId);
  const destructiveConfirmationVisible =
    confirmingDestructiveAction || destructiveActionRequested;
  const matchingProfiles = profileMatch.matchingNetworkIds
    .map((networkId) =>
      manager.networks.find((network) => network.id === networkId),
    )
    .filter((network) => network !== undefined);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    setConfigurationResult(undefined);
    try {
      const diff = buildDeviceConfigurationDiff(baseline, form);
      const failures: string[] = [];
      if (Object.keys(diff.hardwareChanges).length) {
        if (!available) {
          failures.push(
            "Hardware changes were not applied because the device is unavailable.",
          );
        } else {
          try {
            const result = await manager.applyDeviceConfiguration(
              device.id,
              diff.hardwareChanges,
            );
            setConfigurationResult(result);
            if (result.inspected) {
              const mergedForm = mergeInspectionIntoDeviceSettingsForm(
                form,
                result.inspected,
              );
              let mergedBaseline = mergeInspectionIntoDeviceSettingsForm(
                baseline,
                result.inspected,
              );
              if (
                result.writes.some(
                  (write) =>
                    write.field === "position" &&
                    write.status === "written-unverified",
                )
              ) {
                mergedBaseline = {
                  ...mergedBaseline,
                  positionX: form.positionX!,
                  positionY: form.positionY!,
                  positionZ: form.positionZ!,
                  positionQuality: form.positionQuality!,
                };
              }
              setForm(mergedForm);
              setBaseline(mergedBaseline);
            }
            if (result.error)
              failures.push(
                result.error?.message ?? "Hardware configuration failed.",
              );
          } catch (hardwareError) {
            failures.push(`Hardware: ${displayError(hardwareError)}`);
          }
        }
      }

      if (failures.length) setError(failures.join("\n"));
    } catch (saveError) {
      setError(displayError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const runDestructiveAction = async () => {
    setDestructiveBusy(true);
    setError(undefined);
    setConfigurationResult(undefined);
    try {
      if (!available) {
        await manager.deleteOfflineDevice(device.id);
        onClose();
        return;
      }
      const result = await manager.unassignOnlineDevice(device.id);
      setConfigurationResult(result);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      onClose();
    } catch (destructiveError) {
      setError(displayError(destructiveError));
    } finally {
      setDestructiveBusy(false);
    }
  };

  return (
    <Modal
      testID="device-settings-modal-root"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      avoidKeyboard
    >
      <ModalBackdrop />
      <ModalContent
        testID="device-settings-modal"
        className="shadow-none"
        style={{
          maxHeight: "92%",
          backgroundColor: theme.background,
          borderColor: theme.border,
          borderRadius: eight2FiveRadii.md,
        }}
      >
        <ModalHeader>
          <VStack style={{ gap: two }}>
            <Heading size="lg" style={{ color: theme.text }}>
              Device settings
            </Heading>
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              {available
                ? inspecting
                  ? "Reading device…"
                  : form.source === "actual"
                    ? form.unavailableHardwareFields.length
                      ? "Device read complete · unavailable fields use cached values"
                      : "Values read from device"
                    : "Cached values"
                : "Unavailable · cached values"}
            </Text>
          </VStack>
          <ModalCloseButton accessibilityLabel="Close device settings">
            <Icon as={X} style={{ color: theme.icon }} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody
          scrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: eight2FiveSpacing.lg }}
        >
          <FormSection title="Identity">
            <TextField
              testID="device-hardware-label-input"
              label={cachedFieldLabel("PANS hardware label", form, "label")}
              value={form.hardwareLabel ?? ""}
              placeholder={
                form.hardwareLabel === undefined ? "Unavailable" : undefined
              }
              onChangeText={(hardwareLabel) =>
                setForm((current) => ({ ...current!, hardwareLabel }))
              }
              disabled={!hardwareEditable || form.hardwareLabel === undefined}
            />
            <ReadOnlyRow
              label="Read status"
              value={
                form.source === "actual"
                  ? "Read from device"
                  : available
                    ? "Cached · hardware read pending"
                    : "Cached · device offline"
              }
            />
            <ReadOnlyRow
              label="Advertised name"
              value={form.advertisedName ?? "Unavailable"}
            />
            <SettingHelp title="Hardware label">
              Up to 16 UTF-8 bytes. This changes the PANS device and is cached
              only when the device is offline.
            </SettingHelp>
          </FormSection>

          <FormSection title="Network">
            <ReadOnlyRow
              label={cachedFieldLabel("PANS Network ID", form, "panId")}
              value={
                form.panId === undefined
                  ? "Unavailable"
                  : formatPanId(form.panId)
              }
            />
            <ReadOnlyRow
              label="Cached profile match"
              value={
                profileMatch.status === "matched"
                  ? getNetworkDisplayName(matchingProfiles[0])
                  : profileMatch.status === "conflict"
                    ? "Conflict · repair duplicate PAN profiles"
                    : profileMatch.status === "unverified"
                      ? "Unverified"
                      : "Unassigned"
              }
            />
            {profileMatch.status === "conflict" ? (
              <SettingInfoCard
                tone="error"
                testID="device-pan-profile-conflict"
              >
                PAN {formatPanId(profileMatch.panId!)} matches multiple saved
                profiles:{" "}
                {matchingProfiles.map(getNetworkDisplayName).join(", ")}. Repair
                the profiles before assigning this device.
              </SettingInfoCard>
            ) : null}
            <SettingHelp title="PANS Network ID">
              Hardware value from 0 to 65535. PAN 0 (0x0000) is the PANS default
              PAN ID and is used for the unassigned-device state. The app
              derives the cached profile match from this value; a local
              selection never overrides hardware.
            </SettingHelp>
          </FormSection>

          <FormSection title="Node role and UWB">
            <SelectField
              label="Role"
              value={form.role}
              choices={[
                { label: "Tag", value: "tag" },
                { label: "Anchor", value: "anchor" },
              ]}
              onChange={(role) =>
                setForm((current) => ({
                  ...current!,
                  role: role as "anchor" | "tag",
                }))
              }
              disabled={!hardwareEditable || !roleBaselineAvailable}
            />
            <SelectField
              label="UWB mode"
              value={form.uwbMode}
              choices={[
                { label: "Active", value: "active" },
                { label: "Passive", value: "passive" },
                { label: "Off", value: "off" },
              ]}
              onChange={(uwbMode) =>
                setForm((current) => ({
                  ...current!,
                  uwbMode: uwbMode as "active" | "passive" | "off",
                }))
              }
              disabled={!hardwareEditable || form.uwbMode === undefined}
            />
            <OptionalSwitch
              label="LED"
              value={form.ledEnabled}
              onChange={(ledEnabled) =>
                setForm((current) => ({ ...current!, ledEnabled }))
              }
              disabled={!hardwareEditable}
            />
            <SettingHelp title="Role and UWB mode">
              Tags calculate positions when the location engine is enabled.
              Anchors provide fixed coordinates. Active UWB participates in
              ranging, passive listens without initiating, and off disables UWB.
            </SettingHelp>
          </FormSection>

          {form.role === "anchor" ? (
            <FormSection title="Anchor configuration">
              <OptionalSwitch
                label="Initiator"
                value={form.initiatorEnabled}
                onChange={(initiatorEnabled) =>
                  setForm((current) => ({
                    ...current!,
                    initiatorEnabled,
                  }))
                }
                disabled={!roleFieldsEditable}
              />
              <SettingHelp title="Initiator and coordinates">
                A network requires an initiator anchor. X, Y, and Z are meters
                in the network coordinate system. Quality is optional from 1 to
                100 and defaults to 100.
              </SettingHelp>
              <HStack style={{ gap: eight2FiveSpacing.sm }}>
                <TextField
                  label="X"
                  value={form.positionX ?? ""}
                  placeholder="Unavailable"
                  onChangeText={(positionX) =>
                    setForm((current) => ({ ...current!, positionX }))
                  }
                  disabled={!roleFieldsEditable}
                  compact
                />
                <TextField
                  label="Y"
                  value={form.positionY ?? ""}
                  placeholder="Unavailable"
                  onChangeText={(positionY) =>
                    setForm((current) => ({ ...current!, positionY }))
                  }
                  disabled={!roleFieldsEditable}
                  compact
                />
              </HStack>
              <HStack style={{ gap: eight2FiveSpacing.sm }}>
                <TextField
                  label="Z"
                  value={form.positionZ ?? ""}
                  placeholder="Unavailable"
                  onChangeText={(positionZ) =>
                    setForm((current) => ({ ...current!, positionZ }))
                  }
                  disabled={!roleFieldsEditable}
                  compact
                />
                <TextField
                  label="Quality"
                  value={form.positionQuality ?? ""}
                  placeholder="Unavailable"
                  onChangeText={(positionQuality) =>
                    setForm((current) => ({
                      ...current!,
                      positionQuality,
                    }))
                  }
                  disabled={!roleFieldsEditable}
                  compact
                />
              </HStack>
              <Text selectable size="sm" style={{ color: theme.warning }}>
                Anchor position is write-only. A successful write remains
                unverified because PANS cannot read it back.
              </Text>
            </FormSection>
          ) : null}

          {form.role === "tag" ? (
            <FormSection title="Tag configuration">
              <OptionalSwitch
                label="Location engine"
                value={form.locationEngineEnabled}
                onChange={(locationEngineEnabled) =>
                  setForm((current) => ({
                    ...current!,
                    locationEngineEnabled,
                  }))
                }
                disabled={!roleFieldsEditable}
              />
              <SettingHelp title="Tag update behavior">
                The location engine calculates the tag position. Responsive mode
                uses moving updates; stationary detection allows the slower
                stationary rate. Rates are milliseconds and read-only here.
              </SettingHelp>
              <OptionalSwitch
                label="Responsive mode"
                value={
                  form.lowPowerModeEnabled === undefined
                    ? undefined
                    : !form.lowPowerModeEnabled
                }
                onChange={(responsive) =>
                  setForm((current) => ({
                    ...current!,
                    lowPowerModeEnabled: !responsive,
                  }))
                }
                disabled={!roleFieldsEditable}
              />
              <OptionalSwitch
                label="Stationary detection"
                value={form.stationaryDetectionEnabled}
                onChange={(stationaryDetectionEnabled) =>
                  setForm((current) => ({
                    ...current!,
                    stationaryDetectionEnabled,
                  }))
                }
                disabled={!roleFieldsEditable}
              />
              <SelectField
                label={cachedFieldLabel(
                  "Location-data mode",
                  form,
                  "locationDataMode",
                )}
                value={
                  form.locationDataMode === undefined
                    ? undefined
                    : String(form.locationDataMode)
                }
                choices={[
                  { label: "Position", value: "0" },
                  { label: "Distances", value: "1" },
                  { label: "Position + distances", value: "2" },
                ]}
                onChange={(locationDataMode) =>
                  setForm((current) => ({
                    ...current!,
                    locationDataMode: Number(locationDataMode) as 0 | 1 | 2,
                  }))
                }
                disabled={
                  !roleFieldsEditable || form.locationDataMode === undefined
                }
              />
              <ReadOnlyRow
                label={cachedFieldLabel(
                  "Moving update rate (read-only)",
                  form,
                  "updateRate",
                )}
                value={formatRate(form.movingUpdateRateMs)}
              />
              <ReadOnlyRow
                label={cachedFieldLabel(
                  "Stationary update rate (read-only)",
                  form,
                  "updateRate",
                )}
                value={formatRate(form.stationaryUpdateRateMs)}
              />
            </FormSection>
          ) : null}

          <Button
            testID="toggle-device-advanced"
            variant="ghost"
            className="justify-between"
            onPress={() => setAdvancedOpen((current) => !current)}
          >
            <ButtonText>Firmware and diagnostics</ButtonText>
            <ButtonIcon
              as={advancedOpen ? ChevronUp : ChevronDown}
              style={{ color: theme.icon }}
            />
          </Button>
          {advancedOpen ? (
            <FormSection title="Firmware and diagnostics">
              <SelectField
                label="Selected firmware slot"
                value={
                  form.selectedFirmware === undefined
                    ? undefined
                    : String(form.selectedFirmware)
                }
                choices={[
                  { label: "Slot 1", value: "1" },
                  { label: "Slot 2", value: "2" },
                ]}
                onChange={(slot) =>
                  setForm((current) => ({
                    ...current!,
                    selectedFirmware: Number(slot) as 1 | 2,
                  }))
                }
                disabled={
                  !hardwareEditable || form.selectedFirmware === undefined
                }
              />
              <OptionalSwitch
                label="Firmware update participation"
                value={form.firmwareUpdateEnabled}
                onChange={(firmwareUpdateEnabled) =>
                  setForm((current) => ({
                    ...current!,
                    firmwareUpdateEnabled,
                  }))
                }
                disabled={!hardwareEditable}
              />
              <SettingHelp title="Firmware slot">
                Selects boot slot 1 or 2 on hardware. Firmware-update
                participation controls whether this node accepts the PANS update
                workflow.
              </SettingHelp>
              <ReadOnlyRow label="Transport" value="BLE" />
              <ReadOnlyRow
                label="Transport ID"
                value={device.transportDeviceId}
              />
              <ReadOnlyRow
                label="Node ID"
                value={device.nodeIdHex ?? "Unavailable"}
              />
              <ReadOnlyRow
                label="Unavailable reads"
                value={
                  form.unavailableHardwareFields.length
                    ? form.unavailableHardwareFields.join(", ")
                    : "None"
                }
              />
            </FormSection>
          ) : null}

          <FormSection title="Destructive actions">
            <SettingInfoCard tone="warning">
              {available
                ? "Unassigning writes passive UWB mode, verifies it, then restores and verifies the PANS default PAN ID 0 used for unassigned devices. The saved device record is kept for retry and diagnostics."
                : "Deleting an offline device removes its saved phone record, snapshots, and position logs without contacting hardware. Rediscovery creates a new unassigned record."}
            </SettingInfoCard>
            {destructiveConfirmationVisible ? (
              <VStack style={{ gap: eight2FiveSpacing.sm }}>
                <Text
                  selectable
                  accessibilityRole="alert"
                  style={{ color: theme.danger }}
                >
                  {available
                    ? "Confirm hardware unassignment? UWB will be made passive before the PANS default PAN ID 0 is written."
                    : "Confirm deletion of this saved phone record? This cannot be undone."}
                </Text>
                <HStack
                  className="flex-wrap"
                  style={{ gap: eight2FiveSpacing.sm }}
                >
                  <Button
                    testID="confirm-device-destructive-action"
                    variant="destructive"
                    isDisabled={destructiveBusy}
                    onPress={() => void runDestructiveAction()}
                  >
                    {destructiveBusy ? (
                      <ButtonSpinner color={theme.raw.white} />
                    ) : null}
                    <ButtonText>
                      {available ? "Unassign hardware" : "Delete saved device"}
                    </ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    isDisabled={destructiveBusy}
                    onPress={() => {
                      if (destructiveActionRequested) onClose();
                      else setConfirmingDestructiveAction(false);
                    }}
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <Button
                testID="request-device-destructive-action"
                variant="destructive"
                onPress={() => setConfirmingDestructiveAction(true)}
              >
                <ButtonText>
                  {available ? "Unassign device" : "Delete saved device"}
                </ButtonText>
              </Button>
            )}
          </FormSection>

          {inspectionError ? (
            <ResultText
              tone="warning"
              message={`Inspection failed; cached values retained. ${inspectionError}`}
            />
          ) : null}
          {configurationResult ? (
            <VStack testID="device-configuration-results" style={{ gap: four }}>
              {configurationResult.writes.map((write) => (
                <ResultText
                  key={write.field}
                  tone={write.warning ? "warning" : "muted"}
                  message={`${write.field}: ${write.status}${
                    write.actual === undefined
                      ? ""
                      : ` · readback ${String(write.actual)}`
                  }${write.warning ? ` — ${write.warning}` : ""}`}
                />
              ))}
            </VStack>
          ) : null}
          {error ? <ResultText tone="error" message={error} /> : null}
        </ModalBody>
        <Divider style={{ backgroundColor: theme.border }} />
        <ModalFooter className="pt-4">
          <Button variant="ghost" onPress={onClose}>
            <ButtonText>Close</ButtonText>
          </Button>
          <Button
            testID="save-device-settings"
            isDisabled={saving}
            onPress={() => void save()}
          >
            {saving ? <ButtonSpinner color={theme.raw.white} /> : null}
            <ButtonText>Save</ButtonText>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: eight2FiveSpacing.md }}>
      <Heading size="md" style={{ color: theme.text }}>
        {title}
      </Heading>
      {children}
    </VStack>
  );
}

function TextField({
  label,
  compact,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof InputField>, "disabled"> & {
  label: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack className={compact ? "flex-1" : undefined} style={{ gap: four }}>
      <FieldLabel>{label}</FieldLabel>
      <Input style={fieldStyle(theme)} isDisabled={disabled}>
        <InputField
          {...props}
          editable={!disabled && props.editable !== false}
          style={[{ color: theme.text }, props.style]}
        />
      </Input>
    </VStack>
  );
}

function SelectField({
  label,
  value,
  choices,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  value?: string;
  choices: { label: string; value: string }[];
  onChange(value: string): void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: four }}>
      <FieldLabel>{label}</FieldLabel>
      <Select
        selectedValue={value}
        onValueChange={onChange}
        isDisabled={disabled || value === undefined}
      >
        <SelectTrigger
          testID={testID}
          style={fieldStyle(theme)}
          accessibilityLabel={label}
          accessibilityHint="Opens the available choices"
          accessibilityState={{
            disabled: disabled || value === undefined,
          }}
        >
          <SelectInput
            value={
              value === undefined
                ? "Unavailable"
                : (choices.find((choice) => choice.value === value)?.label ??
                  value)
            }
            className="flex-1"
            style={{ color: theme.text }}
          />
          <SelectIcon as={ChevronDown} style={{ color: theme.icon }} />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent style={{ backgroundColor: theme.surfaceRaised }}>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            {choices.map((choice) => (
              <SelectItem
                key={choice.value}
                label={choice.label}
                value={choice.value}
              />
            ))}
          </SelectContent>
        </SelectPortal>
      </Select>
    </VStack>
  );
}

function OptionalSwitch({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      className="min-h-11 items-center justify-between"
      style={{ gap: 16 }}
    >
      <FieldLabel>{label}</FieldLabel>
      {value === undefined ? (
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          Unavailable
        </Text>
      ) : (
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ false: theme.surfaceStrong, true: theme.accent }}
        />
      )}
    </HStack>
  );
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

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const theme = useEight2FiveTheme();
  return (
    <HStack className="items-start justify-between" style={{ gap: 16 }}>
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text
        selectable
        size="sm"
        className="shrink text-right"
        style={{ color: theme.text }}
      >
        {value}
      </Text>
    </HStack>
  );
}

function ResultText({
  tone,
  message,
}: {
  tone: "error" | "warning" | "success" | "muted";
  message: string;
}) {
  const theme = useEight2FiveTheme();
  const color = {
    error: theme.danger,
    warning: theme.warning,
    success: theme.success,
    muted: theme.textMuted,
  }[tone];
  return (
    <Text
      selectable
      accessibilityRole={tone === "error" ? "alert" : undefined}
      size="sm"
      style={{ color }}
    >
      {message}
    </Text>
  );
}

function formatRate(value: number | undefined): string {
  return value === undefined ? "Unavailable" : `${value} ms`;
}

function cachedFieldLabel(
  label: string,
  form: DeviceSettingsFormValues,
  field: string,
): string {
  return form.source === "actual" &&
    form.unavailableHardwareFields.includes(field)
    ? `${label} (cached; read unavailable)`
    : label;
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
const four = 4;
