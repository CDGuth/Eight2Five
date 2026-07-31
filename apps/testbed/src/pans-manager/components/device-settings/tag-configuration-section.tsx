import React from "react";
import { SelectField } from "../manager-ui";
import { SettingHelp } from "../setting-help";
import {
  FormSection,
  OptionalSwitch,
  ReadOnlyRow,
  cachedFieldLabel,
} from "./device-settings-fields";

export interface TagConfigurationSectionProps {
  locationEngineEnabled?: boolean;
  lowPowerModeEnabled?: boolean;
  stationaryDetectionEnabled?: boolean;
  locationDataMode?: 0 | 1 | 2;
  movingUpdateRateMs?: number;
  stationaryUpdateRateMs?: number;
  source: "cached" | "actual";
  unavailableFields: string[];
  editable: boolean;
  onLocationEngineChange(value: boolean): void;
  onLowPowerModeChange(value: boolean): void;
  onStationaryDetectionChange(value: boolean): void;
  onLocationDataModeChange(value: 0 | 1 | 2): void;
}

export const TagConfigurationSection = React.memo(
  function TagConfigurationSection(p: TagConfigurationSectionProps) {
    const locationDataMode =
      p.locationDataMode === undefined
        ? undefined
        : locationModeValues[p.locationDataMode];
    return (
      <FormSection title="Tag configuration">
        <OptionalSwitch
          label="Location engine"
          value={p.locationEngineEnabled}
          onChange={p.onLocationEngineChange}
          disabled={!p.editable}
        />
        <SettingHelp title="Tag update behavior">
          The location engine calculates the tag position. Responsive mode uses
          moving updates; stationary detection allows the slower stationary
          rate. Rates are milliseconds and read-only here.
        </SettingHelp>
        <OptionalSwitch
          label="Responsive mode"
          value={
            p.lowPowerModeEnabled === undefined
              ? undefined
              : !p.lowPowerModeEnabled
          }
          onChange={(responsive) => p.onLowPowerModeChange(!responsive)}
          disabled={!p.editable}
        />
        <OptionalSwitch
          label="Stationary detection"
          value={p.stationaryDetectionEnabled}
          onChange={p.onStationaryDetectionChange}
          disabled={!p.editable}
        />
        <SelectField
          label={cachedFieldLabel(
            "Location-data mode",
            p.source,
            p.unavailableFields,
            "locationDataMode",
          )}
          value={locationDataMode}
          choices={[
            { label: "Position", value: "0" },
            { label: "Distances", value: "1" },
            { label: "Position + distances", value: "2" },
          ]}
          onChange={(value) => p.onLocationDataModeChange(locationModes[value])}
          disabled={!p.editable || p.locationDataMode === undefined}
        />
        <ReadOnlyRow
          label={cachedFieldLabel(
            "Moving update rate (read-only)",
            p.source,
            p.unavailableFields,
            "updateRate",
          )}
          value={formatRate(p.movingUpdateRateMs)}
        />
        <ReadOnlyRow
          label={cachedFieldLabel(
            "Stationary update rate (read-only)",
            p.source,
            p.unavailableFields,
            "updateRate",
          )}
          value={formatRate(p.stationaryUpdateRateMs)}
        />
      </FormSection>
    );
  },
);

function formatRate(value: number | undefined) {
  return value === undefined ? "Unavailable" : `${value} ms`;
}

const locationModes = { "0": 0, "1": 1, "2": 2 } as const;
const locationModeValues = ["0", "1", "2"] as const;
