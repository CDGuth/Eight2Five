import React from "react";
import { Check, ChevronDown, X } from "lucide-react-native";
import { Button, ButtonText } from "@eight2five/ui/components/button";
import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
} from "@eight2five/ui/components/checkbox";
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
import { VStack } from "@eight2five/ui/components/vstack";
import {
  eight2FiveFonts,
  eight2FiveRadii,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import {
  getDeviceDisplayName,
  getNetworkDisplayName,
} from "@eight2five/mobile/pans-manager";

import type {
  PansMapDataController,
  PansMapVisibilityOptions,
} from "../manager-map-controller";

const NETWORK_OVERLAY_NOTE =
  "Multiple networks are overlaid using their saved coordinates. The app does not automatically align independent coordinate systems.";

export function ManagerMapSettingsModal({
  controller,
  isOpen,
  onClose,
}: {
  controller: PansMapDataController;
  isOpen: boolean;
  onClose(): void;
}) {
  const theme = useEight2FiveTheme();
  const pending = controller.pendingAnchorEdit;

  const trackingActive =
    controller.trackingStatus === "running" ||
    controller.trackingStatus === "starting" ||
    controller.trackingStatus === "stopping";

  return (
    <Modal
      testID="manager-map-settings-modal-root"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      avoidKeyboard
    >
      <ModalBackdrop />
      <ModalContent
        testID="manager-map-settings-modal"
        className="shadow-none"
        style={{
          maxHeight: "92%",
          backgroundColor: theme.background,
          borderColor: theme.border,
          borderRadius: eight2FiveRadii.md,
        }}
      >
        <ModalHeader>
          <Heading size="lg" style={{ color: theme.text }}>
            Map settings
          </Heading>
          <ModalCloseButton accessibilityLabel="Close map settings">
            <Icon as={X} style={{ color: theme.icon }} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody
          scrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: eight2FiveSpacing.lg }}
        >
          <SettingsSection title="Networks">
            <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
              <MapButton
                label="Select all"
                testID="map-networks-select-all"
                onPress={controller.selectAllNetworks}
              />
              <MapButton
                label="Clear all"
                variant="outline"
                testID="map-networks-clear-all"
                onPress={controller.clearAllNetworks}
              />
            </HStack>
            {controller.networks.map((network) => (
              <Checkbox
                key={network.id}
                testID={`map-network-${network.id}`}
                value={network.id}
                isChecked={controller.selectedNetworkIds.has(network.id)}
                onChange={(checked) =>
                  controller.setNetworkVisible(network.id, checked)
                }
              >
                <CheckboxIndicator
                  style={{
                    borderColor: theme.border,
                    backgroundColor: controller.selectedNetworkIds.has(
                      network.id,
                    )
                      ? theme.accent
                      : theme.surfaceRaised,
                  }}
                >
                  <CheckboxIcon as={Check} style={{ color: theme.raw.white }} />
                </CheckboxIndicator>
                <CheckboxLabel style={{ color: theme.text }}>
                  {getNetworkDisplayName(network)}
                </CheckboxLabel>
              </Checkbox>
            ))}
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              {NETWORK_OVERLAY_NOTE}
            </Text>
          </SettingsSection>

          <SettingsSection title="Node visibility">
            <VisibilitySwitch
              label="Anchors"
              option="anchors"
              controller={controller}
            />
            <VisibilitySwitch
              label="Tags"
              option="tags"
              controller={controller}
            />
            <VisibilitySwitch
              label="Initiators"
              option="initiators"
              controller={controller}
            />
            <VisibilitySwitch
              label="Offline"
              option="offline"
              controller={controller}
            />
            <VisibilitySwitch
              label="Labels"
              option="labels"
              controller={controller}
            />
            <VisibilitySwitch
              label="PAN mismatch indicators"
              option="panMismatchIndicators"
              controller={controller}
            />
            <VisibilitySwitch
              label="Ranging lines"
              option="rangingLines"
              controller={controller}
            />
          </SettingsSection>

          <SettingsSection title="Tracking">
            <KeyValue
              label="Active source"
              value={
                controller.trackingSource === "direct-ble"
                  ? "Direct BLE"
                  : "None"
              }
            />
            <KeyValue label="Status" value={controller.trackingStatus} />
            <SelectField
              testID="map-direct-tag-select"
              label="Direct BLE tag"
              value={controller.selectedDirectTagId}
              placeholder="Select one saved tag"
              disabled={trackingActive}
              choices={controller.trackableTags.map((device) => ({
                label: getDeviceDisplayName(device),
                value: device.id,
              }))}
              onChange={controller.setSelectedDirectTagId}
            />
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              {controller.proxyMessage}
            </Text>
            <SwitchRow
              label="Follow active tag"
              value={controller.follow}
              onChange={controller.setFollow}
            />
            <SwitchRow
              label="Retain last-known positions"
              value={controller.retainLastKnown}
              onChange={controller.setRetainLastKnown}
            />
            <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
              {trackingActive ? (
                <MapButton
                  label="Stop tracking"
                  variant="outline"
                  testID="map-stop-tracking"
                  onPress={() => void controller.stopTracking()}
                />
              ) : (
                <MapButton
                  label="Start direct tracking"
                  testID="map-start-tracking"
                  isDisabled={
                    !controller.selectedDirectTagId || controller.editingEnabled
                  }
                  onPress={() => void controller.startDirectTracking()}
                />
              )}
              <MapButton
                label="Clear last-known"
                variant="outline"
                testID="map-clear-last-known"
                onPress={controller.clearLastKnown}
              />
            </HStack>
            {controller.trackingDiagnostic ? (
              <Text selectable size="sm" style={{ color: theme.warning }}>
                {controller.trackingDiagnostic}
              </Text>
            ) : null}
          </SettingsSection>

          <SettingsSection title="Viewport">
            <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
              <MapButton
                label="Fit visible"
                testID="map-fit-visible"
                onPress={controller.fitVisible}
              />
              <MapButton
                label="Fit anchors"
                variant="outline"
                testID="map-fit-anchors"
                onPress={controller.fitAnchors}
              />
              <MapButton
                label="Reset camera"
                variant="outline"
                testID="map-reset-camera"
                onPress={controller.resetCamera}
              />
            </HStack>
            <SwitchRow
              label="Grid"
              value={controller.grid.showGrid}
              onChange={(showGrid) => controller.setGrid({ showGrid })}
            />
            <SelectField
              testID="map-grid-interval-select"
              label="Grid interval"
              value={String(controller.grid.fixedIntervalMeters ?? "automatic")}
              placeholder="Automatic"
              choices={[
                { label: "Automatic", value: "automatic" },
                { label: "0.1 m", value: "0.1" },
                { label: "0.5 m", value: "0.5" },
                { label: "1 m", value: "1" },
                { label: "5 m", value: "5" },
                { label: "10 m", value: "10" },
              ]}
              onChange={(value) =>
                controller.setGrid({
                  fixedIntervalMeters:
                    value === "automatic" ? undefined : Number(value),
                })
              }
            />
            <SwitchRow
              label="Origin"
              value={controller.grid.showOrigin}
              onChange={(showOrigin) => controller.setGrid({ showOrigin })}
            />
          </SettingsSection>

          <SettingsSection title="Editing">
            <SwitchRow
              label="Edit anchor position"
              value={controller.editingEnabled}
              disabled={trackingActive}
              onChange={controller.setEditingEnabled}
            />
            <SelectField
              testID="map-edit-anchor-select"
              label="Saved anchor"
              value={controller.selectedAnchorId ?? ""}
              placeholder="Select an anchor"
              disabled={trackingActive || !controller.editingEnabled}
              choices={controller.editableAnchors.map((device) => ({
                label: getDeviceDisplayName(device),
                value: device.id,
              }))}
              onChange={controller.setSelectedAnchorId}
            />
            <MapButton
              label="Close and place anchor"
              variant="outline"
              testID="map-place-anchor"
              isDisabled={
                trackingActive ||
                !controller.editingEnabled ||
                !controller.selectedAnchorId
              }
              onPress={onClose}
            />
            {pending ? (
              <AnchorEditConfirmation
                key={`${pending.anchorId}:${pending.coordinate.xMeters}:${pending.coordinate.yMeters}`}
                controller={controller}
                pending={pending}
                trackingActive={trackingActive}
              />
            ) : null}
            {controller.editResult ? (
              <Text selectable size="sm" style={{ color: theme.textMuted }}>
                {controller.editResult}
              </Text>
            ) : null}
          </SettingsSection>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function AnchorEditConfirmation({
  controller,
  pending,
  trackingActive,
}: {
  controller: PansMapDataController;
  pending: NonNullable<PansMapDataController["pendingAnchorEdit"]>;
  trackingActive: boolean;
}) {
  const theme = useEight2FiveTheme();
  const [zMeters, setZMeters] = React.useState(String(pending.zMeters));
  const [quality, setQuality] = React.useState(String(pending.quality));
  return (
    <VStack
      testID="map-anchor-confirmation"
      style={{ gap: eight2FiveSpacing.sm }}
    >
      <Heading size="sm" style={{ color: theme.text }}>
        Confirm anchor position
      </Heading>
      <Text selectable style={{ color: theme.text }}>
        X {pending.coordinate.xMeters.toFixed(3)} m · Y{" "}
        {pending.coordinate.yMeters.toFixed(3)} m
      </Text>
      <NumericField
        testID="map-anchor-z-input"
        label="Z (m)"
        value={zMeters}
        onChange={setZMeters}
      />
      <NumericField
        testID="map-anchor-quality-input"
        label="Quality (1–100)"
        value={quality}
        onChange={setQuality}
      />
      <Text selectable size="sm" style={{ color: theme.warning }}>
        Position writes are write-only over this BLE interface and cannot be
        read back for verification.
      </Text>
      <HStack style={{ gap: eight2FiveSpacing.sm }}>
        <MapButton
          label="Write position"
          testID="map-write-anchor-position"
          isDisabled={trackingActive}
          onPress={() =>
            void controller.savePendingAnchorEdit(
              Number(zMeters),
              Number(quality),
            )
          }
        />
        <MapButton
          label="Cancel"
          variant="outline"
          onPress={controller.cancelPendingAnchorEdit}
        />
      </HStack>
    </VStack>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: eight2FiveSpacing.sm }}>
      <Heading size="md" style={{ color: theme.text }}>
        {title}
      </Heading>
      {children}
    </VStack>
  );
}

function VisibilitySwitch({
  label,
  option,
  controller,
}: {
  label: string;
  option: keyof PansMapVisibilityOptions;
  controller: PansMapDataController;
}) {
  return (
    <SwitchRow
      label={label}
      value={controller.visibility[option]}
      onChange={(value) => controller.setVisibility(option, value)}
    />
  );
}

function SwitchRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      className="min-h-11 items-center justify-between"
      style={{ gap: 16 }}
    >
      <VStack className="flex-1">
        <Text
          style={{
            color: theme.text,
            fontFamily: eight2FiveFonts.styleSemibold,
          }}
        >
          {label}
        </Text>
        {description ? (
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {description}
          </Text>
        ) : null}
      </VStack>
      <Switch
        testID={`map-switch-${label.toLowerCase().replaceAll(" ", "-")}`}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: theme.surfaceStrong, true: theme.accent }}
      />
    </HStack>
  );
}

function SelectField({
  testID,
  label,
  value,
  placeholder,
  choices,
  onChange,
  disabled,
}: {
  testID: string;
  label: string;
  value: string;
  placeholder: string;
  choices: { label: string; value: string }[];
  onChange(value: string): void;
  disabled?: boolean;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: four }}>
      <Text
        style={{
          color: theme.text,
          fontFamily: eight2FiveFonts.styleSemibold,
        }}
      >
        {label}
      </Text>
      <Select
        selectedValue={value}
        onValueChange={onChange}
        isDisabled={disabled}
      >
        <SelectTrigger
          testID={testID}
          size="lg"
          style={{
            borderColor: theme.border,
            backgroundColor: theme.surfaceRaised,
          }}
        >
          <SelectInput
            className="flex-1"
            value={
              choices.find((choice) => choice.value === value)?.label ?? ""
            }
            placeholder={placeholder}
            style={{ color: theme.text }}
          />
          <SelectIcon
            as={ChevronDown}
            className="mr-3"
            style={{ color: theme.icon }}
          />
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

function NumericField({
  testID,
  label,
  value,
  onChange,
}: {
  testID: string;
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: four }}>
      <Text style={{ color: theme.text }}>{label}</Text>
      <Input style={{ borderColor: theme.border }}>
        <InputField
          testID={testID}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          style={{ color: theme.text }}
        />
      </Input>
    </VStack>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  const theme = useEight2FiveTheme();
  return (
    <HStack className="justify-between" style={{ gap: eight2FiveSpacing.sm }}>
      <Text size="sm" style={{ color: theme.textMuted }}>
        {label}
      </Text>
      <Text selectable size="sm" style={{ color: theme.text }}>
        {value}
      </Text>
    </HStack>
  );
}

function MapButton({
  label,
  variant = "default",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  label: string;
}) {
  const theme = useEight2FiveTheme();
  const outline = variant === "outline";
  return (
    <Button
      {...props}
      variant={variant}
      size="sm"
      style={{
        backgroundColor: outline ? theme.surfaceRaised : theme.accent,
        borderColor: outline ? theme.border : theme.accent,
      }}
    >
      <ButtonText style={{ color: outline ? theme.text : theme.raw.white }}>
        {label}
      </ButtonText>
    </Button>
  );
}

const four = 4;
