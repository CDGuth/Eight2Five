import React from "react";
import { useLocalSearchParams } from "expo-router";
import type {
  ManagedAnchorConfig,
  ManagedDeviceConfig,
  ManagedTagConfig,
  PansConfigurationResult,
} from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

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
  const theme = useEight2FiveTheme();
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
      const panId = pan.trim() ? parsePanInput(pan) : undefined;
      if (
        panId !== undefined &&
        (!Number.isInteger(panId) || panId < 0 || panId > 0xffff)
      ) {
        throw new Error(
          "PAN ID must be an integer from 0 to 65535, in decimal or hexadecimal.",
        );
      }
      const common = {
        ...(label ? { label } : {}),
        ...(panId !== undefined ? { panId } : {}),
        uwbMode: uwbMode as "off" | "passive" | "active",
        ledEnabled,
        // Firmware participation is intentionally not exposed in this UI.
        firmwareUpdateEnabled: initial?.firmwareUpdateEnabled ?? false,
      };
      let config: ManagedDeviceConfig;
      if (role === "anchor") {
        if (
          initiator &&
          manager.devices.some(
            (item) =>
              item.id !== device.id &&
              item.networkId === device.networkId &&
              item.lastKnownConfig?.role === "anchor" &&
              item.lastKnownConfig.initiatorEnabled,
          )
        ) {
          throw new Error(
            "Another anchor is already the initiator. Disable it before assigning a new one.",
          );
        }
        const position = {
          xMeters: Number(x),
          yMeters: Number(y),
          zMeters: Number(z),
          quality: Number(quality),
        };
        if (
          !Number.isFinite(position.xMeters) ||
          !Number.isFinite(position.yMeters) ||
          !Number.isFinite(position.zMeters)
        ) {
          throw new Error("Enter valid X, Y, and Z coordinates.");
        }
        if (
          !Number.isInteger(position.quality) ||
          position.quality < 1 ||
          position.quality > 100
        ) {
          throw new Error("Position quality must be an integer from 1 to 100.");
        }
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
        title="Identify and configure"
        description="Match the physical unit, then set its network role."
        tone="accent"
      >
        <TextField label="Name" value={nickname} onChangeText={setNickname} />
        <TextField label="Device label" value={label} onChangeText={setLabel} />
        <TextField label="Network ID (PAN)" value={pan} onChangeText={setPan} />
        <SelectField
          label="Node type"
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
        <SwitchField
          label="LED"
          description="Turn this off and save to identify the unit."
          value={ledEnabled}
          onChange={setLedEnabled}
        />
      </SectionCard>

      {role === "anchor" ? (
        <SectionCard title="Anchor settings">
          <SwitchField
            label="Initiator"
            description="Exactly one anchor in the network must be the initiator."
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
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            Measure coordinates to centimeter accuracy.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard title="Tag settings">
          <SwitchField
            label="Location engine"
            value={solver}
            onChange={setSolver}
          />
          <SwitchField
            label="Responsive mode"
            value={!lowPower}
            onChange={(enabled) => setLowPower(!enabled)}
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
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            Update rates are read-only.
          </Text>
        </SectionCard>
      )}

      <SectionCard title="Save">
        <ManagerButton
          label="Save configuration"
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
          <Text
            key={write.field}
            selectable
            size="sm"
            style={{ color: write.warning ? theme.warning : theme.textMuted }}
          >
            {write.field}: {write.status}
            {write.warning ? ` — ${write.warning}` : ""}
          </Text>
        ))}
      </SectionCard>
    </ManagerScreen>
  );
}

function parsePanInput(value: string): number {
  const text = value.trim();
  if (/^0x[0-9a-f]+$/i.test(text)) return Number.parseInt(text.slice(2), 16);
  if (/^[0-9a-f]*[a-f][0-9a-f]*$/i.test(text)) return Number.parseInt(text, 16);
  if (/^[0-9]+$/.test(text)) return Number.parseInt(text, 10);
  return Number.NaN;
}
