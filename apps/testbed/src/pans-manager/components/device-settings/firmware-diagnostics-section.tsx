import React from "react";
import { SelectField } from "../manager-ui";
import { SettingHelp } from "../setting-help";
import {
  FormSection,
  OptionalSwitch,
  ReadOnlyRow,
} from "./device-settings-fields";

export interface FirmwareDiagnosticsSectionProps {
  selectedFirmware?: 1 | 2;
  firmwareUpdateEnabled?: boolean;
  hardwareEditable: boolean;
  transportDeviceId: string;
  nodeIdHex?: string;
  unavailableFieldsText: string;
  onSelectedFirmwareChange(value: 1 | 2): void;
  onFirmwareUpdateChange(value: boolean): void;
}
export const FirmwareDiagnosticsSection = React.memo(
  function FirmwareDiagnosticsSection(p: FirmwareDiagnosticsSectionProps) {
    const selectedFirmware =
      p.selectedFirmware === undefined
        ? undefined
        : firmwareValues[p.selectedFirmware];
    return (
      <FormSection title="Firmware and diagnostics">
        <SelectField
          label="Selected firmware slot"
          value={selectedFirmware}
          choices={[
            { label: "Slot 1", value: "1" },
            { label: "Slot 2", value: "2" },
          ]}
          onChange={(slot) => p.onSelectedFirmwareChange(firmwareSlots[slot])}
          disabled={!p.hardwareEditable || p.selectedFirmware === undefined}
        />
        <OptionalSwitch
          label="Firmware update participation"
          value={p.firmwareUpdateEnabled}
          onChange={p.onFirmwareUpdateChange}
          disabled={!p.hardwareEditable}
        />
        <SettingHelp title="Firmware slot">
          Selects boot slot 1 or 2 on hardware. Firmware-update participation
          controls whether this node accepts the PANS update workflow.
        </SettingHelp>
        <ReadOnlyRow label="Transport" value="BLE" />
        <ReadOnlyRow label="Transport ID" value={p.transportDeviceId} />
        <ReadOnlyRow label="Node ID" value={p.nodeIdHex ?? "Unavailable"} />
        <ReadOnlyRow
          label="Unavailable reads"
          value={p.unavailableFieldsText}
        />
      </FormSection>
    );
  },
);

const firmwareSlots = { "1": 1, "2": 2 } as const;
const firmwareValues = [undefined, "1", "2"] as const;
