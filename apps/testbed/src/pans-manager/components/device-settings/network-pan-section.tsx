import React from "react";
import { formatPanId } from "@eight2five/mobile/pans-manager";
import { SelectField } from "../manager-ui";
import { SettingHelp, SettingInfoCard } from "../setting-help";
import {
  FormSection,
  OptionalSwitch,
  ReadOnlyRow,
  cachedFieldLabel,
} from "./device-settings-fields";

export interface NetworkPanSectionProps {
  panId?: number;
  source: "cached" | "actual";
  unavailableFields: string[];
  profileStatus: "matched" | "conflict" | "unverified" | "unassigned";
  profileDisplayName?: string;
  conflictingProfileNames: string[];
  role?: "anchor" | "tag";
  uwbMode?: "active" | "passive" | "off";
  ledEnabled?: boolean;
  hardwareEditable: boolean;
  roleBaselineAvailable: boolean;
  onRoleChange(value: "anchor" | "tag"): void;
  onUwbModeChange(value: "active" | "passive" | "off"): void;
  onLedEnabledChange(value: boolean): void;
}

export const NetworkPanSection = React.memo(function NetworkPanSection(
  props: NetworkPanSectionProps,
) {
  const {
    panId,
    source,
    unavailableFields,
    profileStatus,
    profileDisplayName,
    conflictingProfileNames,
    role,
    uwbMode,
    ledEnabled,
    hardwareEditable,
    roleBaselineAvailable,
    onRoleChange,
    onUwbModeChange,
    onLedEnabledChange,
  } = props;
  return (
    <>
      <FormSection title="Network">
        <ReadOnlyRow
          label={cachedFieldLabel(
            "PANS Network ID",
            source,
            unavailableFields,
            "panId",
          )}
          value={panId === undefined ? "Unavailable" : formatPanId(panId)}
        />
        <ReadOnlyRow
          label="Cached profile match"
          value={
            profileStatus === "matched"
              ? (profileDisplayName ?? "Unassigned")
              : profileStatus === "conflict"
                ? "Conflict · repair duplicate PAN profiles"
                : profileStatus === "unverified"
                  ? "Unverified"
                  : "Unassigned"
          }
        />
        {profileStatus === "conflict" ? (
          <SettingInfoCard tone="error" testID="device-pan-profile-conflict">
            PAN {formatPanId(panId!)} matches multiple saved profiles:{" "}
            {conflictingProfileNames.join(", ")}. Repair the profiles before
            assigning this device.
          </SettingInfoCard>
        ) : null}
        <SettingHelp title="PANS Network ID">
          Hardware value from 0 to 65535. PAN 0 (0x0000) is the PANS default PAN
          ID and is used for the unassigned-device state. The app derives the
          cached profile match from this value; a local selection never
          overrides hardware.
        </SettingHelp>
      </FormSection>
      <FormSection title="Node role and UWB">
        <SelectField
          label="Role"
          value={role}
          choices={[
            { label: "Tag", value: "tag" },
            { label: "Anchor", value: "anchor" },
          ]}
          onChange={onRoleChange}
          disabled={!hardwareEditable || !roleBaselineAvailable}
        />
        <SelectField
          label="UWB mode"
          value={uwbMode}
          choices={[
            { label: "Active", value: "active" },
            { label: "Passive", value: "passive" },
            { label: "Off", value: "off" },
          ]}
          onChange={onUwbModeChange}
          disabled={!hardwareEditable || uwbMode === undefined}
        />
        <OptionalSwitch
          label="LED"
          value={ledEnabled}
          onChange={onLedEnabledChange}
          disabled={!hardwareEditable}
        />
        <SettingHelp title="Role and UWB mode">
          Tags calculate positions when the location engine is enabled. Anchors
          provide fixed coordinates. Active UWB participates in ranging, passive
          listens without initiating, and off disables UWB.
        </SettingHelp>
      </FormSection>
    </>
  );
});
