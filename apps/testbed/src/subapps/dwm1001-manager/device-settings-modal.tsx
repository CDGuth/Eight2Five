import React from "react";
import type {
  AssignDeviceToNetworkProfileResult,
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  PansConfigurationResult,
  UnassignDeviceFromNetworkProfileResult,
} from "@eight2five/mobile/pans-manager";
import {
  formatPanId,
  getNetworkDisplayName,
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
import { Textarea, TextareaInput } from "@eight2five/ui/components/textarea";
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

export interface DeviceSettingsModalProps {
  device?: ManagedDevice;
  discovery?: DiscoveredDeviceSnapshot;
  isOpen: boolean;
  available: boolean;
  onClose(): void;
}

export function DeviceSettingsModal({
  device,
  discovery,
  isOpen,
  available,
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
  const [localMessage, setLocalMessage] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [configurationResult, setConfigurationResult] =
    React.useState<PansConfigurationResult>();
  const [assignmentResult, setAssignmentResult] =
    React.useState<AssignDeviceToNetworkProfileResult>();
  const [unassignResult, setUnassignResult] =
    React.useState<UnassignDeviceFromNetworkProfileResult>();
  const [confirmingUnassign, setConfirmingUnassign] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const loadedDeviceId = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!isOpen || !device || loadedDeviceId.current === device.id) return;
    loadedDeviceId.current = device.id;
    const initial = deviceSettingsFormFrom(device, discovery?.name);
    setBaseline(initial);
    setForm(initial);
    inspectionAttempted.current = false;
    setInspectionError(undefined);
    setLocalMessage(undefined);
    setError(undefined);
    setConfigurationResult(undefined);
    setAssignmentResult(undefined);
    setUnassignResult(undefined);
    setConfirmingUnassign(false);
    setAdvancedOpen(false);
  }, [device, discovery?.name, isOpen]);

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

  const selectProfile = (value: string) => {
    if (value === "unassigned") {
      if (baseline.profileNetworkId) setConfirmingUnassign(true);
      else setForm((current) => withoutProfileNetworkId(current!));
      return;
    }
    setConfirmingUnassign(false);
    setForm((current) => ({ ...current!, profileNetworkId: value }));
  };

  const confirmUnassign = async () => {
    if (!baseline.profileNetworkId) return;
    setSaving(true);
    setError(undefined);
    try {
      const result = await manager.unassignDeviceFromNetworkProfile({
        deviceId: device.id,
        expectedNetworkId: baseline.profileNetworkId,
      });
      setUnassignResult(result);
      if (result.outcome === "unassigned") {
        setForm((current) => withoutProfileNetworkId(current!));
        setBaseline((current) => withoutProfileNetworkId(current!));
        setConfirmingUnassign(false);
      } else {
        setError(result.error?.message ?? "The association was not removed.");
      }
    } catch (unassignError) {
      setError(displayError(unassignError));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    setLocalMessage(undefined);
    setConfigurationResult(undefined);
    setAssignmentResult(undefined);
    try {
      const diff = buildDeviceConfigurationDiff(baseline, form);
      const failures: string[] = [];
      if (Object.keys(diff.localChanges).length) {
        try {
          await manager.saveDeviceLocalDetails(device.id, diff.localChanges);
          setLocalMessage("App details saved.");
          setBaseline((current) => ({
            ...current!,
            nickname: form.nickname,
            notes: form.notes,
          }));
        } catch (localError) {
          failures.push(`App details: ${displayError(localError)}`);
        }
      }

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

      if (
        form.profileNetworkId !== baseline.profileNetworkId &&
        form.profileNetworkId
      ) {
        if (!available) {
          failures.push(
            "Profile assignment requires the device to be available.",
          );
        } else {
          try {
            const result = await manager.assignDeviceToNetworkProfile({
              deviceId: device.id,
              targetNetworkId: form.profileNetworkId,
            });
            setAssignmentResult(result);
            if (result.outcome === "assigned") {
              setBaseline((current) => ({
                ...current!,
                profileNetworkId: form.profileNetworkId,
              }));
            } else {
              setForm((current) => ({
                ...current!,
                profileNetworkId: baseline.profileNetworkId,
              }));
              failures.push(
                result.error?.message ?? "Profile assignment failed.",
              );
            }
          } catch (assignmentError) {
            setForm((current) => ({
              ...current!,
              profileNetworkId: baseline.profileNetworkId,
            }));
            failures.push(
              `Profile assignment: ${displayError(assignmentError)}`,
            );
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
          <FormSection title="Local">
            <TextField
              testID="device-app-name-input"
              label="App name"
              value={form.nickname}
              onChangeText={(nickname) =>
                setForm((current) => ({ ...current!, nickname }))
              }
            />
            <ReadOnlyRow
              label="Advertised name"
              value={form.advertisedName ?? "Unavailable"}
            />
            <SelectField
              testID="device-profile-select"
              label="Saved network association"
              value={form.profileNetworkId ?? "unassigned"}
              choices={[
                { label: "Unassigned", value: "unassigned" },
                ...manager.networks.map((profile) => ({
                  label: `${getNetworkDisplayName(profile)} · ${formatPanId(
                    profile.panId,
                  )}`,
                  value: profile.id,
                })),
              ]}
              onChange={selectProfile}
              disabled={!available && form.profileNetworkId === undefined}
            />
            {confirmingUnassign && baseline.profileNetworkId ? (
              <VStack
                testID="confirm-device-unassign"
                style={{ gap: eight2FiveSpacing.sm }}
              >
                <Text selectable size="sm" style={{ color: theme.text }}>
                  Remove this app association only? The device hardware and PANS
                  Network ID will remain unchanged.
                </Text>
                <HStack
                  className="justify-end"
                  style={{ gap: eight2FiveSpacing.sm }}
                >
                  <Button
                    variant="ghost"
                    onPress={() => setConfirmingUnassign(false)}
                  >
                    <ButtonText>Keep assigned</ButtonText>
                  </Button>
                  <Button
                    testID="confirm-unassign-device"
                    variant="outline"
                    onPress={() => void confirmUnassign()}
                  >
                    <ButtonText>Remove app association</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            ) : null}
            <TextareaField
              label="Notes"
              value={form.notes}
              onChangeText={(notes) =>
                setForm((current) => ({ ...current!, notes }))
              }
            />
          </FormSection>

          <FormSection title="Hardware">
            <TextField
              testID="device-hardware-label-input"
              label={cachedFieldLabel("Hardware PANS label", form, "label")}
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
              label={cachedFieldLabel("PANS Network ID", form, "panId")}
              value={
                form.panId === undefined
                  ? "Unavailable"
                  : formatPanId(form.panId)
              }
            />
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

            {form.role === "anchor" ? (
              <VStack style={{ gap: eight2FiveSpacing.md }}>
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
              </VStack>
            ) : null}

            {form.role === "tag" ? (
              <VStack style={{ gap: eight2FiveSpacing.md }}>
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
              </VStack>
            ) : null}
          </FormSection>

          <Button
            testID="toggle-device-advanced"
            variant="ghost"
            className="justify-between"
            onPress={() => setAdvancedOpen((current) => !current)}
          >
            <ButtonText>Advanced / diagnostics</ButtonText>
            <ButtonIcon
              as={advancedOpen ? ChevronUp : ChevronDown}
              style={{ color: theme.icon }}
            />
          </Button>
          {advancedOpen ? (
            <FormSection title="Advanced / diagnostics">
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

          {inspectionError ? (
            <ResultText
              tone="warning"
              message={`Inspection failed; cached values retained. ${inspectionError}`}
            />
          ) : null}
          {localMessage ? (
            <ResultText tone="success" message={localMessage} />
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
          {assignmentResult ? (
            <ResultText
              tone={
                assignmentResult.outcome === "assigned" ? "success" : "warning"
              }
              message={`Profile assignment ${assignmentResult.outcome}.`}
            />
          ) : null}
          {unassignResult ? (
            <ResultText
              tone={
                unassignResult.outcome === "unassigned" ? "success" : "warning"
              }
              message={`App association ${unassignResult.outcome}. Hardware unchanged.`}
            />
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
            isDisabled={saving || confirmingUnassign}
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

function TextareaField({
  label,
  ...props
}: React.ComponentProps<typeof TextareaInput> & { label: string }) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: four }}>
      <FieldLabel>{label}</FieldLabel>
      <Textarea style={fieldStyle(theme)}>
        <TextareaInput
          {...props}
          style={[{ color: theme.text }, props.style]}
        />
      </Textarea>
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

function withoutProfileNetworkId(
  value: DeviceSettingsFormValues,
): DeviceSettingsFormValues {
  const { profileNetworkId: _profileNetworkId, ...unassigned } = value;
  return unassigned;
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
