import React from "react";
import { SettingHelp } from "../setting-help";
import {
  FormSection,
  ReadOnlyRow,
  TextField,
  cachedFieldLabel,
} from "./device-settings-fields";

export interface IdentitySectionProps {
  testID?: string;
  hardwareLabel?: string;
  advertisedName?: string;
  source: "cached" | "actual";
  unavailableFields: string[];
  available: boolean;
  editable: boolean;
  onChangeText(value: string): void;
}

export const IdentitySection = React.memo(function IdentitySection({
  hardwareLabel,
  advertisedName,
  source,
  unavailableFields,
  available,
  editable,
  onChangeText,
}: IdentitySectionProps) {
  return (
    <FormSection title="Identity">
      <TextField
        testID="device-hardware-label-input"
        label={cachedFieldLabel(
          "PANS hardware label",
          source,
          unavailableFields,
          "label",
        )}
        value={hardwareLabel ?? ""}
        placeholder={hardwareLabel === undefined ? "Unavailable" : undefined}
        onChangeText={onChangeText}
        disabled={!editable || hardwareLabel === undefined}
      />
      <ReadOnlyRow
        label="Read status"
        value={
          source === "actual"
            ? "Read from device"
            : available
              ? "Cached · hardware read pending"
              : "Cached · device offline"
        }
      />
      <ReadOnlyRow
        label="Advertised name"
        value={advertisedName ?? "Unavailable"}
      />
      <SettingHelp title="Hardware label">
        Up to 16 UTF-8 bytes. This changes the PANS device and is cached only
        when the device is offline.
      </SettingHelp>
    </FormSection>
  );
});
