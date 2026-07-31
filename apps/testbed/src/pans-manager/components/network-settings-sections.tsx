import React from "react";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveRadii, useEight2FiveTheme } from "@eight2five/ui/theme";
import {
  formatPanId,
  mapUnitAbbreviation,
  type MapAreaMode,
  type MapUnits,
} from "@eight2five/mobile/pans-manager";

import type { NetworkSettingsFormState } from "../network-settings-form";
import {
  EXPORT_FORMAT_CHOICES,
  LOCATION_DATA_MODE_CHOICES,
  MAP_AREA_MODE_CHOICES,
  MAP_UNIT_CHOICES,
  formatLocationDataMode,
  parseLocationDataMode,
  type ExportFormat,
  type LocationDataModeChoice,
} from "../settings-definitions";
import {
  KeyValue,
  ManagerButton,
  SectionCard,
  SelectField,
  StatePanel,
  SwitchField,
  TextField,
} from "./manager-ui";
import { SettingHelp } from "./setting-help";

type SetField = <K extends keyof NetworkSettingsFormState>(
  field: K,
  value: NetworkSettingsFormState[K],
) => void;

export const IdentitySettingsSection = React.memo(
  function IdentitySettingsSection({
    name,
    notes,
    panId,
    message,
    error,
    onNameChange,
    onNotesChange,
    onSave,
  }: {
    name: string;
    notes: string;
    panId: number;
    message?: string;
    error?: string;
    onNameChange(value: string): void;
    onNotesChange(value: string): void;
    onSave(): void;
  }) {
    return (
      <>
        <SectionCard title="Identity">
          <TextField label="Name" value={name} onChangeText={onNameChange} />
          <TextField
            label="Notes"
            value={notes}
            onChangeText={onNotesChange}
            multiline
          />
          <ManagerButton label="Save network settings" onPress={onSave} />
          {message ? <StatePanel state="success" message={message} /> : null}
          {error ? <StatePanel state="error" message={error} /> : null}
        </SectionCard>
        <SectionCard title="PANS Network ID">
          <KeyValue label="Hardware PAN" value={formatPanId(panId)} />
          <SettingHelp title="PANS Network ID">
            Saved networks use PAN IDs from 1 through 65535. PAN 0 (0x0000) is
            the PANS default PAN ID and is used for the unassigned-device state.
            A device matches this profile only after its hardware PAN has been
            read and verified.
          </SettingHelp>
        </SectionCard>
      </>
    );
  },
);

export const CoordinateSystemSettingsSection = React.memo(
  function CoordinateSystemSettingsSection({
    mapUnits,
    mapAreaMode,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    anchorHeight,
    onMapUnitsChange,
    setField,
  }: {
    mapUnits: MapUnits;
    mapAreaMode: MapAreaMode;
    minX: string;
    maxX: string;
    minY: string;
    maxY: string;
    minZ: string;
    maxZ: string;
    anchorHeight: string;
    onMapUnitsChange(value: MapUnits): void;
    setField: SetField;
  }) {
    const unit = mapUnitAbbreviation(mapUnits);
    const coordinateFields = [
      ["minXMeters", "Minimum X", minX],
      ["maxXMeters", "Maximum X", maxX],
      ["minYMeters", "Minimum Y", minY],
      ["maxYMeters", "Maximum Y", maxY],
      ["minZMeters", "Minimum Z", minZ],
      ["maxZMeters", "Maximum Z", maxZ],
      ["defaultAnchorHeightMeters", "Default anchor height", anchorHeight],
    ] as const;
    return (
      <SectionCard title="Map and coordinate system">
        <SelectField
          testID="network-map-units-select"
          label="Display units"
          value={mapUnits}
          onChange={onMapUnitsChange}
          choices={MAP_UNIT_CHOICES}
          helper="Coordinates remain stored in meters; this controls display and input conversion."
        />
        <SelectField
          testID="network-map-area-mode-select"
          label="Map area"
          value={mapAreaMode}
          onChange={(value) => setField("mapAreaMode", value)}
          choices={MAP_AREA_MODE_CHOICES}
          helper="Bounded mode draws and constrains navigation to the saved X/Y rectangle."
        />
        {coordinateFields.map(([field, label, value]) => (
          <TextField
            key={field}
            label={`${label} (${unit})`}
            value={value}
            onChangeText={(next) => setField(field, next)}
            keyboardType="numbers-and-punctuation"
          />
        ))}
        <SettingHelp title="Coordinates and bounds">
          X and Y are horizontal coordinates from the network origin. Z is
          height. Values are converted at the UI boundary and stored in meters.
          Bounds remain saved in both area modes; bounded mode draws the
          rectangle and constrains camera panning, while nodes outside it remain
          available to diagnostics and exports.
        </SettingHelp>
      </SectionCard>
    );
  },
);

export const AvailabilitySettingsSection = React.memo(
  function AvailabilitySettingsSection({
    staleTimeout,
    autoConnect,
    setField,
  }: {
    staleTimeout: string;
    autoConnect: boolean;
    setField: SetField;
  }) {
    return (
      <SectionCard title="Device availability">
        <TextField
          label="Stale device timeout (seconds)"
          value={staleTimeout}
          onChangeText={(value) => setField("staleDeviceTimeoutSeconds", value)}
          keyboardType="decimal-pad"
        />
        <SwitchField
          label="Auto-connect"
          value={autoConnect}
          onChange={(value) => setField("autoConnect", value)}
        />
        <SettingHelp title="Stale timeout">
          Number of seconds without a discovery advertisement before the app
          marks a device offline. Auto-connect controls app behavior only and
          does not change PANS hardware.
        </SettingHelp>
      </SectionCard>
    );
  },
);

export const DeviceDefaultsSettingsSection = React.memo(
  function DeviceDefaultsSettingsSection({
    form,
    setField,
  }: {
    form: Pick<
      NetworkSettingsFormState,
      | "locationEngineEnabled"
      | "lowPowerModeEnabled"
      | "stationaryDetectionEnabled"
      | "locationDataMode"
      | "movingUpdateRateMs"
      | "stationaryUpdateRateMs"
      | "positionLogRetentionDays"
      | "positionLogMaxSamples"
    >;
    setField: SetField;
  }) {
    return (
      <SectionCard title="Defaults">
        <SwitchField
          label="Location engine"
          value={form.locationEngineEnabled}
          onChange={(value) => setField("locationEngineEnabled", value)}
        />
        <SwitchField
          label="Low power mode"
          value={form.lowPowerModeEnabled}
          onChange={(value) => setField("lowPowerModeEnabled", value)}
        />
        <SwitchField
          label="Accelerometer / stationary detection"
          value={form.stationaryDetectionEnabled}
          onChange={(value) => setField("stationaryDetectionEnabled", value)}
        />
        <SelectField<LocationDataModeChoice>
          label="Location data mode"
          value={formatLocationDataMode(form.locationDataMode)}
          onChange={(value) =>
            setField("locationDataMode", parseLocationDataMode(value))
          }
          choices={LOCATION_DATA_MODE_CHOICES}
        />
        <TextField
          label="Default moving interval (ms)"
          value={form.movingUpdateRateMs}
          onChangeText={(value) => setField("movingUpdateRateMs", value)}
          keyboardType="decimal-pad"
        />
        <TextField
          label="Default stationary interval (ms)"
          value={form.stationaryUpdateRateMs}
          onChangeText={(value) => setField("stationaryUpdateRateMs", value)}
          keyboardType="decimal-pad"
        />
        <SettingHelp title="Tag update defaults">
          The location engine computes positions. Moving and stationary rates
          are milliseconds; stationary detection enables the slower interval.
          Location-data mode chooses positions, anchor distances, or both.
        </SettingHelp>
        <TextField
          label="Retention (days)"
          value={form.positionLogRetentionDays}
          onChangeText={(value) => setField("positionLogRetentionDays", value)}
          keyboardType="number-pad"
        />
        <TextField
          label="Maximum samples"
          value={form.positionLogMaxSamples}
          onChangeText={(value) => setField("positionLogMaxSamples", value)}
          keyboardType="number-pad"
        />
        <SettingHelp title="Position log defaults">
          Retention days and maximum samples limit app-side log storage. They do
          not change hardware or its update rate.
        </SettingHelp>
      </SectionCard>
    );
  },
);

export const ExportSettingsSection = React.memo(function ExportSettingsSection({
  format,
  text,
  onFormatChange,
  onExport,
}: {
  format: ExportFormat;
  text: string;
  onFormatChange(value: ExportFormat): void;
  onExport(): void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <SectionCard title="Export network">
      <SelectField
        label="Format"
        value={format}
        onChange={onFormatChange}
        choices={EXPORT_FORMAT_CHOICES}
      />
      <ManagerButton
        label={`Generate selectable ${format.toUpperCase()}`}
        variant="outline"
        onPress={onExport}
      />
      {text ? (
        <Text
          selectable
          size="xs"
          style={{
            borderRadius: eight2FiveRadii.sm,
            backgroundColor: theme.surface,
            color: theme.text,
            fontFamily: "monospace",
            padding: 12,
          }}
        >
          {text}
        </Text>
      ) : null}
    </SectionCard>
  );
});

export const DestructiveSettingsSection = React.memo(
  function DestructiveSettingsSection({
    networkName,
    confirming,
    onConfirmingChange,
    onDelete,
  }: {
    networkName: string;
    confirming: boolean;
    onConfirmingChange(value: boolean): void;
    onDelete(): void;
  }) {
    return (
      <SectionCard
        title="Destructive actions"
        description="Removes the saved profile, app settings, and position logs. Hardware is not reset."
      >
        {confirming ? (
          <>
            <StatePanel
              state="error"
              message={`Delete “${networkName}” from this app? Hardware PAN IDs remain unchanged. Devices move to Unassigned when no remaining profile matches their cached PAN.`}
            />
            <ManagerButton
              label={`Confirm delete ${networkName}`}
              variant="destructive"
              onPress={onDelete}
            />
            <ManagerButton
              label="Cancel"
              variant="ghost"
              onPress={() => onConfirmingChange(false)}
            />
          </>
        ) : (
          <ManagerButton
            label="Delete saved network"
            variant="destructive"
            onPress={() => onConfirmingChange(true)}
          />
        )}
      </SectionCard>
    );
  },
);
