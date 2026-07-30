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
  formatMapCoordinate,
  formatMapDistance,
  getDeviceDisplayName,
  getNetworkDisplayName,
  mapUnitAbbreviation,
  type GridBounds,
  type MapUnits,
} from "@eight2five/mobile/pans-manager";

import type {
  PansMapDataController,
  PansMapVisibilityOptions,
} from "../manager-map-controller";
import { SelectField } from "./manager-ui";
import { SettingHelp } from "./setting-help";
import {
  MAP_AREA_MODE_CHOICES,
  MAP_UNIT_CHOICES,
  anchorCoordinateError,
  anchorQualityError,
  parseAnchorCoordinate,
  parseAnchorQuality,
} from "../settings-definitions";

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
            <Icon as={X} size="xl" style={{ color: theme.icon }} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody
          scrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: eight2FiveSpacing.lg }}
        >
          <VisibilitySettingsSection
            networks={controller.networks}
            selectedNetworkIds={controller.selectedNetworkIds}
            visibility={controller.visibility}
            grid={controller.grid}
            selectAllNetworks={controller.selectAllNetworks}
            clearAllNetworks={controller.clearAllNetworks}
            setNetworkVisible={controller.setNetworkVisible}
            setVisibility={controller.setVisibility}
            setGrid={controller.setGrid}
          />
          <UnitsCoordinateSettingsSection
            mapUnits={controller.mapUnits}
            mapAreaMode={controller.mapAreaMode}
            grid={controller.grid}
            selectedAreaBounds={controller.selectedAreaBounds}
            setMapUnits={controller.setMapUnits}
            setMapAreaMode={controller.setMapAreaMode}
            setGrid={controller.setGrid}
          />
          <CameraSettingsSection
            fitVisible={controller.fitVisible}
            fitAnchors={controller.fitAnchors}
            resetCamera={controller.resetCamera}
          />
          <TrackingSettingsSection
            trackingSource={controller.trackingSource}
            trackingStatus={controller.trackingStatus}
            selectedDirectTagId={controller.selectedDirectTagId}
            trackableTags={controller.trackableTags}
            proxyMessage={controller.proxyMessage}
            follow={controller.follow}
            retainLastKnown={controller.retainLastKnown}
            editingEnabled={controller.editingEnabled}
            trackingDiagnostic={controller.trackingDiagnostic}
            setSelectedDirectTagId={controller.setSelectedDirectTagId}
            setFollow={controller.setFollow}
            setRetainLastKnown={controller.setRetainLastKnown}
            startDirectTracking={controller.startDirectTracking}
            stopTracking={controller.stopTracking}
            clearLastKnown={controller.clearLastKnown}
          />
          {controller.trackingCounters ? (
            <LiveDiagnosticsSettingsSection
              counters={controller.trackingCounters}
            />
          ) : null}
          {controller.editableAnchors.length ||
          controller.editingEnabled ||
          controller.pendingAnchorEdit ? (
            <AnchorEditingSettingsSection
              trackingActive={trackingActive}
              editingEnabled={controller.editingEnabled}
              selectedAnchorId={controller.selectedAnchorId}
              editableAnchors={controller.editableAnchors}
              pending={controller.pendingAnchorEdit}
              editResult={controller.editResult}
              mapUnits={controller.mapUnits}
              setEditingEnabled={controller.setEditingEnabled}
              setSelectedAnchorId={controller.setSelectedAnchorId}
              savePendingAnchorEdit={controller.savePendingAnchorEdit}
              cancelPendingAnchorEdit={controller.cancelPendingAnchorEdit}
              onClose={onClose}
            />
          ) : null}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export const VisibilitySettingsSection = React.memo(
  function VisibilitySettingsSection({
    networks,
    selectedNetworkIds,
    visibility,
    grid,
    selectAllNetworks,
    clearAllNetworks,
    setNetworkVisible,
    setVisibility,
    setGrid,
  }: Pick<
    PansMapDataController,
    | "networks"
    | "selectedNetworkIds"
    | "visibility"
    | "grid"
    | "selectAllNetworks"
    | "clearAllNetworks"
    | "setNetworkVisible"
    | "setVisibility"
    | "setGrid"
  >) {
    const theme = useEight2FiveTheme();
    const options: readonly [string, keyof PansMapVisibilityOptions][] = [
      ["Anchors", "anchors"],
      ["Tags", "tags"],
      ["Initiators", "initiators"],
      ["Offline", "offline"],
      ["Labels", "labels"],
      ["PAN mismatch indicators", "panMismatchIndicators"],
      ["Ranging lines", "rangingLines"],
    ];
    return (
      <SettingsSection title="Display">
        <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
          <MapButton
            label="Select all"
            testID="map-networks-select-all"
            onPress={selectAllNetworks}
          />
          <MapButton
            label="Clear all"
            variant="outline"
            testID="map-networks-clear-all"
            onPress={clearAllNetworks}
          />
        </HStack>
        {networks.map((network) => (
          <Checkbox
            key={network.id}
            testID={`map-network-${network.id}`}
            value={network.id}
            isChecked={selectedNetworkIds.has(network.id)}
            onChange={(checked) => setNetworkVisible(network.id, checked)}
          >
            <CheckboxIndicator
              style={{
                borderColor: theme.border,
                backgroundColor: selectedNetworkIds.has(network.id)
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
        {options.map(([label, option]) => (
          <SwitchRow
            key={option}
            label={label}
            value={visibility[option]}
            onChange={(value) => setVisibility(option, value)}
          />
        ))}
        <SwitchRow
          label="Grid"
          value={grid.showGrid}
          onChange={(showGrid) => setGrid({ showGrid })}
        />
        <SwitchRow
          label="Origin and axes"
          value={grid.showOrigin}
          onChange={(showOrigin) => setGrid({ showOrigin })}
        />
      </SettingsSection>
    );
  },
);

export const UnitsCoordinateSettingsSection = React.memo(
  function UnitsCoordinateSettingsSection({
    mapUnits,
    mapAreaMode,
    grid,
    selectedAreaBounds,
    setMapUnits,
    setMapAreaMode,
    setGrid,
  }: Pick<
    PansMapDataController,
    | "mapUnits"
    | "mapAreaMode"
    | "grid"
    | "selectedAreaBounds"
    | "setMapUnits"
    | "setMapAreaMode"
    | "setGrid"
  >) {
    const theme = useEight2FiveTheme();
    const gridIntervalChoices = getGridIntervalChoices(mapUnits);
    return (
      <>
        <SettingsSection title="Units and coordinate system">
          <SelectField
            testID="map-units-select"
            label="Display units"
            value={mapUnits}
            choices={MAP_UNIT_CHOICES}
            onChange={setMapUnits}
            helper="Coordinates remain stored in meters and are converted only for display and input."
          />
          <SelectField
            testID="map-area-mode-select"
            label="Map area"
            value={mapAreaMode}
            choices={MAP_AREA_MODE_CHOICES}
            onChange={setMapAreaMode}
            helper="The setting is applied to every currently selected network."
          />
          <SelectField
            testID="map-grid-interval-select"
            label="Grid interval"
            value={String(grid.fixedIntervalMeters ?? "automatic")}
            placeholder="Automatic"
            choices={gridIntervalChoices}
            onChange={(value) =>
              setGrid({
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
          {selectedAreaBounds.length ? (
            selectedAreaBounds.map((bounds, index) => (
              <KeyValue
                key={`${bounds.minXMeters}:${bounds.maxXMeters}:${bounds.minYMeters}:${bounds.maxYMeters}:${index}`}
                label={`Bounded area ${index + 1}`}
                value={formatBounds(bounds, mapUnits)}
              />
            ))
          ) : (
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              No selected network is currently using bounded-area mode.
            </Text>
          )}
          <SettingHelp title="Map bounds">
            Each network profile stores minimum and maximum X and Y values in
            meters. Bounded mode draws the rectangle and constrains camera
            navigation; device data outside the rectangle is not discarded.
          </SettingHelp>
        </SettingsSection>
      </>
    );
  },
);

export const CameraSettingsSection = React.memo(function CameraSettingsSection({
  fitVisible,
  fitAnchors,
  resetCamera,
}: Pick<PansMapDataController, "fitVisible" | "fitAnchors" | "resetCamera">) {
  return (
    <SettingsSection title="Camera">
      <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
        <MapButton
          label="Fit visible"
          testID="map-fit-visible"
          onPress={fitVisible}
        />
        <MapButton
          label="Fit anchors"
          variant="outline"
          testID="map-fit-anchors"
          onPress={fitAnchors}
        />
        <MapButton
          label="Reset camera"
          variant="outline"
          testID="map-reset-camera"
          onPress={resetCamera}
        />
      </HStack>
    </SettingsSection>
  );
});

export const TrackingSettingsSection = React.memo(
  function TrackingSettingsSection({
    trackingSource,
    trackingStatus,
    selectedDirectTagId,
    trackableTags,
    proxyMessage,
    follow,
    retainLastKnown,
    editingEnabled,
    trackingDiagnostic,
    setSelectedDirectTagId,
    setFollow,
    setRetainLastKnown,
    startDirectTracking,
    stopTracking,
    clearLastKnown,
  }: Pick<
    PansMapDataController,
    | "trackingSource"
    | "trackingStatus"
    | "selectedDirectTagId"
    | "trackableTags"
    | "proxyMessage"
    | "follow"
    | "retainLastKnown"
    | "editingEnabled"
    | "trackingDiagnostic"
    | "setSelectedDirectTagId"
    | "setFollow"
    | "setRetainLastKnown"
    | "startDirectTracking"
    | "stopTracking"
    | "clearLastKnown"
  >) {
    const theme = useEight2FiveTheme();
    const active =
      trackingStatus === "running" ||
      trackingStatus === "starting" ||
      trackingStatus === "stopping";
    return (
      <SettingsSection title="Tracking">
        <KeyValue
          label="Active source"
          value={trackingSource === "direct-ble" ? "Direct BLE" : "None"}
        />
        <KeyValue label="Status" value={trackingStatus} />
        <SelectField
          testID="map-direct-tag-select"
          label="Direct BLE tag"
          value={selectedDirectTagId}
          placeholder="Select one saved tag"
          disabled={active}
          choices={trackableTags.map((device) => ({
            label: getDeviceDisplayName(device),
            value: device.id,
          }))}
          onChange={setSelectedDirectTagId}
        />
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          {proxyMessage}
        </Text>
        <SwitchRow
          label="Follow active tag"
          value={follow}
          onChange={setFollow}
        />
        <SwitchRow
          label="Retain last-known positions"
          value={retainLastKnown}
          onChange={setRetainLastKnown}
        />
        <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
          {active ? (
            <MapButton
              label="Stop tracking"
              variant="outline"
              testID="map-stop-tracking"
              onPress={stopTracking}
            />
          ) : (
            <MapButton
              label="Start direct tracking"
              testID="map-start-tracking"
              isDisabled={!selectedDirectTagId || editingEnabled}
              onPress={startDirectTracking}
            />
          )}
          <MapButton
            label="Clear last-known"
            variant="outline"
            testID="map-clear-last-known"
            onPress={clearLastKnown}
          />
        </HStack>
        {trackingDiagnostic ? (
          <Text selectable size="sm" style={{ color: theme.warning }}>
            {trackingDiagnostic}
          </Text>
        ) : null}
      </SettingsSection>
    );
  },
);

export const LiveDiagnosticsSettingsSection = React.memo(
  function LiveDiagnosticsSettingsSection({
    counters,
  }: {
    counters: NonNullable<PansMapDataController["trackingCounters"]>;
  }) {
    return (
      <SettingsSection title="Live pipeline">
        <KeyValue
          label="Native notifications"
          value={String(counters.notificationEvents)}
        />
        <KeyValue
          label="Matching device"
          value={String(counters.matchingDeviceNotifications)}
        />
        <KeyValue
          label="Decoded frames"
          value={String(counters.decodedFrames)}
        />
        <KeyValue
          label="Position frames"
          value={String(counters.positionFrames)}
        />
        <KeyValue
          label="Map position updates"
          value={String(counters.mapPositionUpdates)}
        />
        <KeyValue
          label="Decode failures"
          value={String(counters.decodeFailures)}
        />
        <KeyValue
          label="Native sequence discontinuities"
          value={String(counters.nativeSequenceDiscontinuities)}
        />
        {counters.negotiatedMtu !== undefined ? (
          <KeyValue
            label="Negotiated MTU"
            value={String(counters.negotiatedMtu)}
          />
        ) : null}
        <SettingHelp title="Pipeline counters">
          Counters separate native callbacks, device-ID filtering, decoding,
          position-bearing frames, and SharedValue map updates. A sequence
          discontinuity is diagnostic evidence, not proof of a dropped frame,
          because the native sequence is process-wide.
        </SettingHelp>
      </SettingsSection>
    );
  },
);

export const AnchorEditingSettingsSection = React.memo(
  function AnchorEditingSettingsSection({
    trackingActive,
    editingEnabled,
    selectedAnchorId,
    editableAnchors,
    pending,
    editResult,
    mapUnits,
    setEditingEnabled,
    setSelectedAnchorId,
    savePendingAnchorEdit,
    cancelPendingAnchorEdit,
    onClose,
  }: Pick<
    PansMapDataController,
    | "editingEnabled"
    | "selectedAnchorId"
    | "editableAnchors"
    | "editResult"
    | "mapUnits"
    | "setEditingEnabled"
    | "setSelectedAnchorId"
    | "savePendingAnchorEdit"
    | "cancelPendingAnchorEdit"
  > & {
    trackingActive: boolean;
    pending: PansMapDataController["pendingAnchorEdit"];
    onClose(): void;
  }) {
    const theme = useEight2FiveTheme();
    return (
      <SettingsSection title="Anchor editing">
        <SwitchRow
          label="Edit anchor position"
          value={editingEnabled}
          disabled={trackingActive}
          onChange={setEditingEnabled}
        />
        <SelectField
          testID="map-edit-anchor-select"
          label="Saved anchor"
          value={selectedAnchorId ?? ""}
          placeholder="Select an anchor"
          disabled={trackingActive || !editingEnabled}
          choices={editableAnchors.map((device) => ({
            label: getDeviceDisplayName(device),
            value: device.id,
          }))}
          onChange={setSelectedAnchorId}
        />
        <MapButton
          label="Close and place anchor"
          variant="outline"
          testID="map-place-anchor"
          isDisabled={trackingActive || !editingEnabled || !selectedAnchorId}
          onPress={onClose}
        />
        {pending ? (
          <AnchorEditConfirmation
            key={`${pending.anchorId}:${pending.coordinate.xMeters}:${pending.coordinate.yMeters}:${mapUnits}`}
            pending={pending}
            trackingActive={trackingActive}
            mapUnits={mapUnits}
            onSave={savePendingAnchorEdit}
            onCancel={cancelPendingAnchorEdit}
          />
        ) : null}
        {editResult ? (
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {editResult}
          </Text>
        ) : null}
      </SettingsSection>
    );
  },
);

function AnchorEditConfirmation({
  pending,
  trackingActive,
  mapUnits,
  onSave,
  onCancel,
}: {
  pending: NonNullable<PansMapDataController["pendingAnchorEdit"]>;
  trackingActive: boolean;
  mapUnits: MapUnits;
  onSave: PansMapDataController["savePendingAnchorEdit"];
  onCancel: PansMapDataController["cancelPendingAnchorEdit"];
}) {
  const theme = useEight2FiveTheme();
  const unit = mapUnitAbbreviation(mapUnits);
  const [zMeters, setZMeters] = React.useState(
    formatMapCoordinate(pending.zMeters, mapUnits, 6),
  );
  const [quality, setQuality] = React.useState(
    pending.quality === 100 ? "" : String(pending.quality),
  );
  const zText = zMeters.trim();
  const qualityText = quality.trim();
  const zError = anchorCoordinateError(zText, "Enter the anchor height.");
  const qualityValue = parseAnchorQuality(qualityText);
  const qualityError = anchorQualityError(qualityText);
  return (
    <VStack
      testID="map-anchor-confirmation"
      style={{ gap: eight2FiveSpacing.sm }}
    >
      <Heading size="sm" style={{ color: theme.text }}>
        Confirm anchor position
      </Heading>
      <Text selectable style={{ color: theme.text }}>
        X {formatMapDistance(pending.coordinate.xMeters, mapUnits)} · Y{" "}
        {formatMapDistance(pending.coordinate.yMeters, mapUnits)}
      </Text>
      <NumericField
        testID="map-anchor-z-input"
        label={`Z (${unit})`}
        value={zMeters}
        onChange={setZMeters}
        helper={`Anchor height in ${
          mapUnits === "imperial" ? "feet" : "meters"
        }.`}
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
            void onSave(parseAnchorCoordinate(zText, mapUnits)!, qualityValue)
          }
        />
        <MapButton label="Cancel" variant="outline" onPress={onCancel} />
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

function getGridIntervalChoices(units: MapUnits) {
  const valuesMeters =
    units === "imperial"
      ? [0.3048, 1.524, 3.048, 7.62, 15.24]
      : [0.1, 0.5, 1, 5, 10];
  return [
    { label: "Automatic", value: "automatic" },
    ...valuesMeters.map((valueMeters) => ({
      label: formatMapDistance(valueMeters, units),
      value: String(valueMeters),
    })),
  ];
}

function formatBounds(bounds: GridBounds, units: MapUnits): string {
  return `X ${formatMapDistance(
    bounds.minXMeters,
    units,
  )} to ${formatMapDistance(bounds.maxXMeters, units)} · Y ${formatMapDistance(
    bounds.minYMeters,
    units,
  )} to ${formatMapDistance(bounds.maxYMeters, units)}`;
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
