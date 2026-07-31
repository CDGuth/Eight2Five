import React from "react";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";
import { SettingHelp } from "../setting-help";
import type { DeviceSettingsFieldErrors } from "../../device-settings-form";
import {
  FormSection,
  OptionalSwitch,
  TextField,
} from "./device-settings-fields";

export interface AnchorConfigurationSectionProps {
  initiatorEnabled?: boolean;
  positionX: string;
  positionY: string;
  positionZ: string;
  positionQuality: string;
  coordinateUnit: string;
  imperial: boolean;
  editable: boolean;
  errors: DeviceSettingsFieldErrors;
  onInitiatorChange(value: boolean): void;
  onPositionXChange(value: string): void;
  onPositionYChange(value: string): void;
  onPositionZChange(value: string): void;
  onPositionQualityChange(value: string): void;
}
export const AnchorConfigurationSection = React.memo(
  function AnchorConfigurationSection(p: AnchorConfigurationSectionProps) {
    const theme = useEight2FiveTheme();
    return (
      <FormSection title="Anchor configuration">
        <OptionalSwitch
          label="Initiator"
          value={p.initiatorEnabled}
          onChange={p.onInitiatorChange}
          disabled={!p.editable}
        />
        <SettingHelp title="Initiator and coordinates">
          A network requires an initiator anchor. X and Y are horizontal
          coordinates from the network origin. Z is height. Display input is
          converted to canonical meters before writing. Quality is optional from
          1 to 100 and defaults to 100.
        </SettingHelp>
        <HStack style={{ gap: eight2FiveSpacing.sm }}>
          <TextField
            label={`X (${p.coordinateUnit})`}
            value={p.positionX}
            placeholder="Required"
            helper={`Horizontal ${p.coordinateUnit} from the network origin.`}
            error={p.errors.positionX}
            onChangeText={p.onPositionXChange}
            disabled={!p.editable}
            compact
          />
          <TextField
            label={`Y (${p.coordinateUnit})`}
            value={p.positionY}
            placeholder="Required"
            helper={`Horizontal ${p.coordinateUnit} from the network origin.`}
            error={p.errors.positionY}
            onChangeText={p.onPositionYChange}
            disabled={!p.editable}
            compact
          />
        </HStack>
        <HStack style={{ gap: eight2FiveSpacing.sm }}>
          <TextField
            label={`Z (${p.coordinateUnit})`}
            value={p.positionZ}
            placeholder="Required"
            helper={`Anchor height in ${p.imperial ? "feet" : "meters"}.`}
            error={p.errors.positionZ}
            onChangeText={p.onPositionZChange}
            disabled={!p.editable}
            compact
          />
          <TextField
            label="Quality"
            value={p.positionQuality}
            placeholder="100"
            helper="Optional integer from 1 to 100; blank uses 100."
            error={p.errors.positionQuality}
            onChangeText={p.onPositionQualityChange}
            disabled={!p.editable}
            compact
          />
        </HStack>
        <Text selectable size="sm" style={{ color: theme.warning }}>
          Anchor position is write-only. A successful write remains unverified
          because PANS cannot read it back.
        </Text>
      </FormSection>
    );
  },
);
