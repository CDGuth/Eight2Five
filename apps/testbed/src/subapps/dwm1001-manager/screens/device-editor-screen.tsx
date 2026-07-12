import React from "react";
import { useLocalSearchParams } from "expo-router";
import type {
  ManagedAnchorConfig,
  ManagedDeviceConfig,
  ManagedTagConfig,
  PansConfigurationResult,
} from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/text";

import { useManagedDevice, usePansManager } from "../manager-context";
import { defaultConfigForDevice, displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  SelectField,
  StatePanel,
  SwitchField,
  TextField,
} from "../components/manager-ui";

export function DeviceEditorScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
  const manager = usePansManager();
  const device = useManagedDevice(deviceId);
  const initial = device ? defaultConfigForDevice(device) : undefined;
  const [role, setRole] = React.useState<"anchor" | "tag">(
    initial?.role ?? "tag",
  );
  const [nickname, setNickname] = React.useState(device?.nickname ?? "");
  const [label, setLabel] = React.useState(initial?.label ?? "");
  const [pan, setPan] = React.useState(
    initial?.panId === undefined ? "" : String(initial.panId),
  );
  const [uwbMode, setUwbMode] = React.useState(initial?.uwbMode ?? "active");
  const [ledEnabled, setLedEnabled] = React.useState(
    initial?.ledEnabled ?? true,
  );
  const [updateEnabled, setUpdateEnabled] = React.useState(
    initial?.firmwareUpdateEnabled ?? true,
  );
  const [initiator, setInitiator] = React.useState(
    initial?.role === "anchor" ? initial.initiatorEnabled : false,
  );
  const [x, setX] = React.useState(
    initial?.role === "anchor" && initial.position
      ? String(initial.position.xMeters)
      : "0",
  );
  const [y, setY] = React.useState(
    initial?.role === "anchor" && initial.position
      ? String(initial.position.yMeters)
      : "0",
  );
  const [z, setZ] = React.useState(
    initial?.role === "anchor" && initial.position
      ? String(initial.position.zMeters)
      : "0",
  );
  const [quality, setQuality] = React.useState(
    initial?.role === "anchor" && initial.position
      ? String(initial.position.quality)
      : "100",
  );
  const tagInitial = initial?.role === "tag" ? initial : undefined;
  const [solver, setSolver] = React.useState(
    tagInitial?.locationEngineEnabled ?? true,
  );
  const [lowPower, setLowPower] = React.useState(
    tagInitial?.lowPowerModeEnabled ?? false,
  );
  const [stationary, setStationary] = React.useState(
    tagInitial?.stationaryDetectionEnabled ?? true,
  );
  const [locationMode, setLocationMode] = React.useState(
    String(tagInitial?.locationDataMode ?? 0),
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [result, setResult] = React.useState<PansConfigurationResult>();

  if (!device) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Managed device not found." />
      </ManagerScreen>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(undefined);
    setResult(undefined);
    try {
      const panId = pan.trim() ? Number(pan) : undefined;
      if (
        panId !== undefined &&
        (!Number.isInteger(panId) || panId < 0 || panId > 0xffff)
      ) {
        throw new Error("PAN ID must be a decimal integer from 0 to 65535.");
      }
      const common = {
        ...(label ? { label } : {}),
        ...(panId !== undefined ? { panId } : {}),
        uwbMode: uwbMode as "off" | "passive" | "active",
        ledEnabled,
        firmwareUpdateEnabled: updateEnabled,
      };
      let config: ManagedDeviceConfig;
      if (role === "anchor") {
        const position = {
          xMeters: Number(x),
          yMeters: Number(y),
          zMeters: Number(z),
          quality: Number(quality),
        };
        config = {
          ...common,
          role: "anchor",
          initiatorEnabled: initiator,
          position,
        } satisfies ManagedAnchorConfig;
      } else {
        config = {
          ...common,
          role: "tag",
          locationEngineEnabled: solver,
          lowPowerModeEnabled: lowPower,
          stationaryDetectionEnabled: stationary,
          locationDataMode: Number(locationMode) as 0 | 1 | 2,
          // Update rates are intentionally omitted: the native API cannot write them.
        } satisfies ManagedTagConfig;
      }
      await manager.saveDevice({
        ...device,
        nickname: nickname.trim() || undefined,
        updatedAt: Date.now(),
      });
      setResult(await manager.configureDevice(device.id, config));
    } catch (saveError) {
      setError(displayError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Common configuration"
        description="Save connects, writes supported fields, reads them back where possible, and persists the result."
      >
        <TextField
          label="Nickname (local only)"
          value={nickname}
          onChangeText={setNickname}
        />
        <TextField
          label="Device label (max 16 UTF-8 bytes)"
          value={label}
          onChangeText={setLabel}
        />
        <TextField
          label="PAN ID (decimal)"
          value={pan}
          onChangeText={setPan}
          keyboardType="number-pad"
        />
        <SelectField
          label="Role"
          value={role}
          onChange={(value) => setRole(value as "anchor" | "tag")}
          choices={[
            { label: "Anchor", value: "anchor" },
            { label: "Tag", value: "tag" },
          ]}
        />
        <SelectField
          label="UWB mode"
          value={uwbMode}
          onChange={(value) =>
            setUwbMode(value as "off" | "passive" | "active")
          }
          choices={[
            { label: "Active", value: "active" },
            { label: "Passive", value: "passive" },
            { label: "Off", value: "off" },
          ]}
        />
        <SwitchField label="LED" value={ledEnabled} onChange={setLedEnabled} />
        <SwitchField
          label="Firmware update participation"
          value={updateEnabled}
          onChange={setUpdateEnabled}
        />
      </SectionCard>

      {role === "anchor" ? (
        <SectionCard title="Anchor settings">
          <SwitchField
            label="Initiator"
            value={initiator}
            onChange={setInitiator}
          />
          <TextField
            label="X (meters)"
            value={x}
            onChangeText={setX}
            keyboardType="decimal-pad"
          />
          <TextField
            label="Y (meters)"
            value={y}
            onChangeText={setY}
            keyboardType="decimal-pad"
          />
          <TextField
            label="Z (meters)"
            value={z}
            onChangeText={setZ}
            keyboardType="decimal-pad"
          />
          <TextField
            label="Position quality (1–100)"
            value={quality}
            onChangeText={setQuality}
            keyboardType="number-pad"
          />
          <Text selectable className="text-sm text-gray-600">
            Persisted anchor position currently cannot be read back, so it is
            reported as written but unverified.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard title="Tag settings">
          <SwitchField
            label="Location solver"
            value={solver}
            onChange={setSolver}
          />
          <SwitchField
            label="Low power"
            value={lowPower}
            onChange={setLowPower}
          />
          <SwitchField
            label="Stationary detection"
            value={stationary}
            onChange={setStationary}
          />
          <SelectField
            label="Location data mode"
            value={locationMode}
            onChange={setLocationMode}
            choices={[
              { label: "Position", value: "0" },
              { label: "Distances", value: "1" },
              { label: "Position + distances", value: "2" },
            ]}
          />
          <Text selectable className="text-sm text-gray-600">
            Moving and stationary update rates are read-only in this build; the
            native API does not support writing them.
          </Text>
        </SectionCard>
      )}

      <SectionCard title="Apply">
        <ManagerButton
          label="Save and verify"
          loading={saving}
          onPress={() => void save()}
        />
        {error ? <StatePanel state="error" message={error} /> : null}
        {result ? (
          <StatePanel
            state={result.outcome === "failure" ? "error" : "success"}
            message={
              result.outcome === "failure"
                ? (result.error?.message ?? "Configuration failed.")
                : `${result.outcome}: ${result.writes.length} write(s), ${result.warnings.length} warning(s).`
            }
          />
        ) : null}
        {result?.writes.map((write) => (
          <Text key={write.field} selectable className="text-sm text-gray-700">
            {write.field}: {write.status}
            {write.warning ? ` — ${write.warning}` : ""}
          </Text>
        ))}
      </SectionCard>
    </ManagerScreen>
  );
}
