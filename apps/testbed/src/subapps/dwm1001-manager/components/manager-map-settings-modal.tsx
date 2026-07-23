import React from "react";
import { Check, X } from "lucide-react-native";
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
import { SelectField } from "./manager-ui";
import { SettingHelp } from "./setting-help";

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
          <SettingsSection title="Display">
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
            <SettingHelp title="Network overlays">
              {NETWORK_OVERLAY_NOTE}
            </SettingHelp>
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
            <SwitchRow
              label="Grid"
              value={controller.grid.showGrid}
              onChange={(showGrid) => controller.setGrid({ showGrid })}
            />
            <SwitchRow
              label="Origin and axes"
              value={controller.grid.showOrigin}
              onChange={(showOrigin) => controller.setGrid({ showOrigin })}
            />
          </SettingsSection>

          <SettingsSection title="Units and coordinate system">
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
            <SettingHelp title="Map coordinates">
              PANS coordinates and saved bounds are stored in meters relative to
              each network origin. Independent network coordinate systems are
              overlaid without automatic alignment.
            </SettingHelp>
          </SettingsSection>

          <SettingsSection title="Area and bounds">
            <SettingHelp title="Map bounds">
              Each network profile supplies minimum and maximum X and Y values
              in meters. Bounds describe the expected field area; out-of-bounds
              devices remain visible.
            </SettingHelp>
          </SettingsSection>

          <SettingsSection title="Camera">
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

          <SettingsSection title="Anchor editing">
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
  const [quality, setQuality] = React.useState(
    pending.quality === 100 ? "" : String(pending.quality),
  );
  const zText = zMeters.trim();
  const qualityText = quality.trim();
  const zError =
    zText === ""
      ? "Enter the anchor height."
      : !Number.isFinite(Number(zText))
        ? "Enter a finite number in meters."
        : undefined;
  const qualityValue = qualityText === "" ? undefined : Number(qualityText);
  const qualityError =
    qualityValue !== undefined &&
    (!Number.isInteger(qualityValue) || qualityValue < 1 || qualityValue > 100)
      ? "Enter an integer from 1 to 100, or leave blank for 100."
      : undefined;
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
        helper="Anchor height in meters."
        error={zError}
      />
      <NumericField
        testID="map-anchor-quality-input"
        label="Quality (optional)"
        value={quality}
        placeholder="100"
        onChange={setQuality}
        helper="Integer from 1 to 100; blank uses 100."
        error={qualityError}
      />
      <Text selectable size="sm" style={{ color: theme.warning }}>
        Position writes are write-only over this BLE interface and cannot be
        read back for verification.
      </Text>
      <HStack style={{ gap: eight2FiveSpacing.sm }}>
        <MapButton
          label="Write position"
          testID="map-write-anchor-position"
          isDisabled={trackingActive || Boolean(zError || qualityError)}
          onPress={() =>
            void controller.savePendingAnchorEdit(Number(zText), qualityValue)
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

function NumericField({
  testID,
  label,
  value,
  onChange,
  placeholder,
  helper,
  error,
}: {
  testID: string;
  label: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  helper?: string;
  error?: string;
}) {
  const theme = useEight2FiveTheme();
  return (
    <VStack style={{ gap: four }}>
      <Text style={{ color: theme.text }}>{label}</Text>
      <Input
        isInvalid={Boolean(error)}
        style={{ borderColor: error ? theme.danger : theme.border }}
      >
        <InputField
          testID={testID}
          value={value}
          placeholder={placeholder}
          onChangeText={onChange}
          keyboardType="numeric"
          style={{ color: theme.text }}
        />
      </Input>
      {error ? (
        <Text
          selectable
          size="sm"
          accessibilityRole="alert"
          style={{ color: theme.danger }}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          {helper}
        </Text>
      ) : null}
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
