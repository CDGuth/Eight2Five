import React from "react";
import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  PansConfigurationResult,
} from "@eight2five/mobile/pans-manager";
import {
  getNetworkDisplayName,
  mapUnitAbbreviation,
  resolveCachedProfileMatch,
} from "@eight2five/mobile/pans-manager";
import { AnimatedHeight } from "@eight2five/ui/components/accordion";
import {
  Button,
  ButtonIcon,
  ButtonSpinner,
  ButtonText,
} from "@eight2five/ui/components/button";
import { Divider } from "@eight2five/ui/components/divider";
import { Heading } from "@eight2five/ui/components/heading";
import { Icon } from "@eight2five/ui/components/icon";
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
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { ChevronDown, ChevronUp, X } from "lucide-react-native";

import { useDeviceConfigurationActions } from "./actions/device-configuration-actions";
import { AnchorConfigurationSection } from "./components/device-settings/anchor-configuration-section";
import { DestructiveActionSection } from "./components/device-settings/destructive-action-section";
import { FirmwareDiagnosticsSection } from "./components/device-settings/firmware-diagnostics-section";
import { IdentitySection } from "./components/device-settings/identity-section";
import { NetworkPanSection } from "./components/device-settings/network-pan-section";
import { TagConfigurationSection } from "./components/device-settings/tag-configuration-section";
import { shouldAutoInspectDevice } from "./device-settings-form";
import { useDeviceSettingsDraft } from "./hooks/use-device-settings-draft";
import { useManagedNetworks } from "./manager-context";
import { displayError } from "./manager-utils";

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
  const networks = useManagedNetworks();
  const {
    inspect: inspectDevice,
    applyConfiguration: applyDeviceConfiguration,
    deleteOffline: deleteOfflineDevice,
    unassignOnline: unassignOnlineDevice,
  } = useDeviceConfigurationActions();
  const displayNetwork = device?.networkId
    ? networks.find((network) => network.id === device.networkId)
    : undefined;
  const mapUnits = displayNetwork?.settings.mapUnits ?? "metric";
  const draft = useDeviceSettingsDraft({
    device,
    advertisedName: discovery?.name,
    isOpen,
    mapUnits,
  });
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
  const inspectionAttempted = React.useRef(false);
  const activeDeviceId = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!isOpen || !device || activeDeviceId.current === device.id) return;
    activeDeviceId.current = device.id;
    inspectionAttempted.current = false;
    setInspectionError(undefined);
    setError(undefined);
    setConfigurationResult(undefined);
    setAdvancedOpen(false);
    setConfirmingDestructiveAction(false);
  }, [device, destructiveActionRequested, isOpen]);
  React.useEffect(() => {
    if (!isOpen) activeDeviceId.current = undefined;
  }, [isOpen]);

  const deviceId = device?.id;
  React.useEffect(() => {
    if (
      !deviceId ||
      !shouldAutoInspectDevice(isOpen, available, inspectionAttempted.current)
    )
      return;
    inspectionAttempted.current = true;
    let inspectionStarted = false;
    const frame = requestAnimationFrame(() => {
      inspectionStarted = true;
      setInspecting(true);
      setInspectionError(undefined);
      inspectDevice(deviceId)
        .then(draft.mergeInspection)
        .catch((cause) => {
          if (activeDeviceId.current === deviceId)
            setInspectionError(displayError(cause));
        })
        .finally(() => {
          if (activeDeviceId.current === deviceId) setInspecting(false);
        });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (!inspectionStarted) inspectionAttempted.current = false;
    };
  }, [available, deviceId, draft.mergeInspection, inspectDevice, isOpen]);

  const update = draft.updateField;
  const updatePosition = draft.updatePosition;
  const onHardwareLabelChange = React.useCallback(
    (value: string) => update("hardwareLabel", value),
    [update],
  );
  const onRoleChange = React.useCallback(
    (value: "anchor" | "tag") => update("role", value),
    [update],
  );
  const onUwbModeChange = React.useCallback(
    (value: "active" | "passive" | "off") => update("uwbMode", value),
    [update],
  );
  const onLedChange = React.useCallback(
    (value: boolean) => update("ledEnabled", value),
    [update],
  );
  const onInitiatorChange = React.useCallback(
    (value: boolean) => update("initiatorEnabled", value),
    [update],
  );
  const onQualityChange = React.useCallback(
    (value: string) => update("positionQuality", value),
    [update],
  );
  const onLocationEngineChange = React.useCallback(
    (value: boolean) => update("locationEngineEnabled", value),
    [update],
  );
  const onLowPowerChange = React.useCallback(
    (value: boolean) => update("lowPowerModeEnabled", value),
    [update],
  );
  const onStationaryChange = React.useCallback(
    (value: boolean) => update("stationaryDetectionEnabled", value),
    [update],
  );
  const onLocationDataModeChange = React.useCallback(
    (value: 0 | 1 | 2) => update("locationDataMode", value),
    [update],
  );
  const onFirmwareSlotChange = React.useCallback(
    (value: 1 | 2) => update("selectedFirmware", value),
    [update],
  );
  const onFirmwareUpdateChange = React.useCallback(
    (value: boolean) => update("firmwareUpdateEnabled", value),
    [update],
  );
  const onPositionXChange = React.useCallback(
    (value: string) => updatePosition("x", value),
    [updatePosition],
  );
  const onPositionYChange = React.useCallback(
    (value: string) => updatePosition("y", value),
    [updatePosition],
  );
  const onPositionZChange = React.useCallback(
    (value: string) => updatePosition("z", value),
    [updatePosition],
  );

  const profile = React.useMemo(() => {
    const match = resolveCachedProfileMatch(networks, draft.form?.panId);
    const matches = match.matchingNetworkIds
      .map((id) => networks.find((network) => network.id === id))
      .filter((network) => network !== undefined);
    return {
      status: match.status,
      displayName: matches[0] ? getNetworkDisplayName(matches[0]) : undefined,
      conflictNames: matches.map(getNetworkDisplayName),
    };
  }, [draft.form?.panId, networks]);

  const save = async () => {
    if (draft.hasErrors) {
      setError("Correct the highlighted anchor position fields before saving.");
      return;
    }
    if (!device || !draft.diff) return;
    setSaving(true);
    setError(undefined);
    setConfigurationResult(undefined);
    try {
      const failures: string[] = [];
      if (Object.keys(draft.diff.hardwareChanges).length) {
        if (!available)
          failures.push(
            "Hardware changes were not applied because the device is unavailable.",
          );
        else
          try {
            const result = await applyDeviceConfiguration(
              device.id,
              draft.diff.hardwareChanges,
            );
            setConfigurationResult(result);
            draft.applySaveResult(result);
            if (result.error)
              failures.push(
                result.error.message ?? "Hardware configuration failed.",
              );
          } catch (cause) {
            failures.push(`Hardware: ${displayError(cause)}`);
          }
      }
      if (failures.length) setError(failures.join("\n"));
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setSaving(false);
    }
  };

  const runDestructiveAction = React.useCallback(async () => {
    if (!device) return;
    setDestructiveBusy(true);
    setError(undefined);
    setConfigurationResult(undefined);
    try {
      if (!available) {
        await deleteOfflineDevice(device.id);
        onClose();
        return;
      }
      const result = await unassignOnlineDevice(device.id);
      setConfigurationResult(result);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      onClose();
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setDestructiveBusy(false);
    }
  }, [available, deleteOfflineDevice, device, onClose, unassignOnlineDevice]);
  const requestDestructive = React.useCallback(
    () => setConfirmingDestructiveAction(true),
    [],
  );
  const confirmDestructive = React.useCallback(() => {
    void runDestructiveAction();
  }, [runDestructiveAction]);
  const cancelDestructive = React.useCallback(() => {
    if (destructiveActionRequested) onClose();
    else setConfirmingDestructiveAction(false);
  }, [destructiveActionRequested, onClose]);

  const form = draft.form;
  const baseline = draft.baseline;
  if (!device || !form || !baseline) return null;
  const hardwareEditable = available && !inspecting;
  const roleFieldsEditable =
    hardwareEditable && baseline.role === form.role && form.role !== undefined;
  const unavailableFieldsText = form.unavailableHardwareFields.length
    ? form.unavailableHardwareFields.join(", ")
    : "None";

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
          <VStack style={{ gap: 2 }}>
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
          <IdentitySection
            testID="device-hardware-label-input"
            hardwareLabel={form.hardwareLabel}
            advertisedName={form.advertisedName}
            source={form.source}
            unavailableFields={form.unavailableHardwareFields}
            available={available}
            editable={hardwareEditable}
            onChangeText={onHardwareLabelChange}
          />
          <NetworkPanSection
            panId={form.panId}
            source={form.source}
            unavailableFields={form.unavailableHardwareFields}
            profileStatus={profile.status}
            profileDisplayName={profile.displayName}
            conflictingProfileNames={profile.conflictNames}
            role={form.role}
            uwbMode={form.uwbMode}
            ledEnabled={form.ledEnabled}
            hardwareEditable={hardwareEditable}
            roleBaselineAvailable={baseline.role !== undefined}
            onRoleChange={onRoleChange}
            onUwbModeChange={onUwbModeChange}
            onLedEnabledChange={onLedChange}
          />
          {form.role === "anchor" ? (
            <AnchorConfigurationSection
              initiatorEnabled={form.initiatorEnabled}
              positionX={draft.positionInputs.x}
              positionY={draft.positionInputs.y}
              positionZ={draft.positionInputs.z}
              positionQuality={form.positionQuality ?? ""}
              coordinateUnit={mapUnitAbbreviation(mapUnits)}
              imperial={mapUnits === "imperial"}
              editable={roleFieldsEditable}
              errors={draft.errors}
              onInitiatorChange={onInitiatorChange}
              onPositionXChange={onPositionXChange}
              onPositionYChange={onPositionYChange}
              onPositionZChange={onPositionZChange}
              onPositionQualityChange={onQualityChange}
            />
          ) : null}
          {form.role === "tag" ? (
            <TagConfigurationSection
              locationEngineEnabled={form.locationEngineEnabled}
              lowPowerModeEnabled={form.lowPowerModeEnabled}
              stationaryDetectionEnabled={form.stationaryDetectionEnabled}
              locationDataMode={form.locationDataMode}
              movingUpdateRateMs={form.movingUpdateRateMs}
              stationaryUpdateRateMs={form.stationaryUpdateRateMs}
              source={form.source}
              unavailableFields={form.unavailableHardwareFields}
              editable={roleFieldsEditable}
              onLocationEngineChange={onLocationEngineChange}
              onLowPowerModeChange={onLowPowerChange}
              onStationaryDetectionChange={onStationaryChange}
              onLocationDataModeChange={onLocationDataModeChange}
            />
          ) : null}
          <Button
            testID="toggle-device-advanced"
            variant="ghost"
            className="justify-between"
            onPress={() => setAdvancedOpen((value) => !value)}
          >
            <ButtonText>Firmware and diagnostics</ButtonText>
            <ButtonIcon
              as={advancedOpen ? ChevronUp : ChevronDown}
              style={{ color: theme.icon }}
            />
          </Button>
          <AnimatedHeight isExpanded={advancedOpen} duration={200}>
            <FirmwareDiagnosticsSection
              selectedFirmware={form.selectedFirmware}
              firmwareUpdateEnabled={form.firmwareUpdateEnabled}
              hardwareEditable={hardwareEditable}
              transportDeviceId={device.transportDeviceId}
              nodeIdHex={device.nodeIdHex}
              unavailableFieldsText={unavailableFieldsText}
              onSelectedFirmwareChange={onFirmwareSlotChange}
              onFirmwareUpdateChange={onFirmwareUpdateChange}
            />
          </AnimatedHeight>
          <DestructiveActionSection
            available={available}
            confirmationVisible={
              confirmingDestructiveAction || destructiveActionRequested
            }
            busy={destructiveBusy}
            onRequest={requestDestructive}
            onConfirm={confirmDestructive}
            onCancel={cancelDestructive}
          />
          {inspectionError ? (
            <ResultText
              tone="warning"
              message={`Inspection failed; cached values retained. ${inspectionError}`}
            />
          ) : null}
          {configurationResult ? (
            <VStack testID="device-configuration-results" style={{ gap: 4 }}>
              {configurationResult.writes.map((write) => (
                <ResultText
                  key={write.field}
                  tone={write.warning ? "warning" : "muted"}
                  message={`${write.field}: ${write.status}${write.actual === undefined ? "" : ` · readback ${String(write.actual)}`}${write.warning ? ` — ${write.warning}` : ""}`}
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
            isDisabled={saving || draft.hasErrors}
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
