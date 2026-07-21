import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  formatPanId,
} from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveRadii, useEight2FiveTheme } from "@eight2five/ui/theme";

import { useManagedNetwork, usePansManager } from "../manager-context";
import { displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  KeyValue,
  SectionCard,
  StatePanel,
  SwitchField,
  TextField,
  SelectField,
} from "../components/manager-ui";
import {
  networkSettingsToForm,
  parseNetworkSettingsForm,
} from "../network-settings-form";

export function NetworkSettingsScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const manager = usePansManager();
  const { network } = useManagedNetwork(networkId);
  const [name, setName] = React.useState(network?.name ?? "");
  const [notes, setNotes] = React.useState(network?.notes ?? "");
  const [settingsForm, setSettingsForm] = React.useState(() =>
    networkSettingsToForm(
      network?.settings ?? DEFAULT_MANAGED_NETWORK_SETTINGS,
    ),
  );
  const [exportJson, setExportJson] = React.useState("");
  const [exportFormat, setExportFormat] = React.useState<"csv" | "json">(
    "json",
  );
  const [message, setMessage] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const loadedNetworkId = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!network || loadedNetworkId.current === network.id) return;
    loadedNetworkId.current = network.id;
    setName(network.name);
    setNotes(network.notes ?? "");
    setSettingsForm(networkSettingsToForm(network.settings));
  }, [network]);

  if (!network) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );
  }

  const save = async () => {
    setError(undefined);
    if (!name.trim()) return setError("Name is required.");
    if (
      manager.networks.some(
        (item) =>
          item.id !== network.id &&
          item.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
    )
      return setError("A network with this name already exists.");
    const parsedSettings = parseNetworkSettingsForm(settingsForm);
    if ("error" in parsedSettings) return setError(parsedSettings.error);
    try {
      await manager.saveNetwork({
        ...network,
        name: name.trim(),
        panId: network.panId,
        notes: notes.trim() || undefined,
        settings: parsedSettings.settings,
        updatedAt: Date.now(),
      });
      setMessage("Network settings saved. Hardware was not changed.");
    } catch (saveError) {
      setError(displayError(saveError));
    }
  };

  const exportProfile = async () => {
    try {
      setExportJson(await manager.exportNetwork(network.id, exportFormat));
    } catch (exportError) {
      setError(displayError(exportError));
    }
  };

  const deleteProfile = async () => {
    try {
      await manager.deleteNetwork(network.id);
      router.replace(
        "/(subapps)/dwm1001-manager/(tabs)/networks-devices" as never,
      );
    } catch (deleteError) {
      setError(displayError(deleteError));
    }
  };

  return (
    <ManagerScreen>
      <SectionCard title="Network details">
        <TextField label="Name" value={name} onChangeText={setName} />
        <KeyValue label="PANS Network ID" value={formatPanId(network.panId)} />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <ManagerButton
          label="Save network settings"
          onPress={() => void save()}
        />
        {message ? <StatePanel state="success" message={message} /> : null}
        {error ? <StatePanel state="error" message={error} /> : null}
      </SectionCard>

      <SectionCard title="Coordinate bounds">
        <TextField
          label="Minimum X (meters)"
          value={settingsForm.minXMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, minXMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Maximum X (meters)"
          value={settingsForm.maxXMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, maxXMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Minimum Y (meters)"
          value={settingsForm.minYMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, minYMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Maximum Y (meters)"
          value={settingsForm.maxYMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, maxYMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Minimum Z (meters)"
          value={settingsForm.minZMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, minZMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Maximum Z (meters)"
          value={settingsForm.maxZMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, maxZMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Default anchor height (meters)"
          value={settingsForm.defaultAnchorHeightMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              defaultAnchorHeightMeters: value,
            }))
          }
          keyboardType="numbers-and-punctuation"
        />
      </SectionCard>

      <SectionCard title="Discovery and connection">
        <TextField
          label="Stale device timeout (seconds)"
          value={settingsForm.staleDeviceTimeoutSeconds}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              staleDeviceTimeoutSeconds: value,
            }))
          }
          keyboardType="decimal-pad"
        />
        <TextField
          label="Scan duration (seconds)"
          value={settingsForm.scanDurationSeconds}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              scanDurationSeconds: value,
            }))
          }
          keyboardType="decimal-pad"
        />
        <SwitchField
          label="Auto-connect"
          value={settingsForm.autoConnect}
          onChange={(value) =>
            setSettingsForm((current) => ({ ...current, autoConnect: value }))
          }
        />
      </SectionCard>

      <SectionCard title="Default tag behavior">
        <SwitchField
          label="Location engine"
          value={settingsForm.locationEngineEnabled}
          onChange={(value) =>
            setSettingsForm((current) => ({
              ...current,
              locationEngineEnabled: value,
            }))
          }
        />
        <SwitchField
          label="Low power mode"
          value={settingsForm.lowPowerModeEnabled}
          onChange={(value) =>
            setSettingsForm((current) => ({
              ...current,
              lowPowerModeEnabled: value,
            }))
          }
        />
        <SwitchField
          label="Accelerometer / stationary detection"
          value={settingsForm.stationaryDetectionEnabled}
          onChange={(value) =>
            setSettingsForm((current) => ({
              ...current,
              stationaryDetectionEnabled: value,
            }))
          }
        />
        <SelectField
          label="Location data mode"
          value={String(settingsForm.locationDataMode)}
          onChange={(value) =>
            setSettingsForm((current) => ({
              ...current,
              locationDataMode: Number(value) as 0 | 1 | 2,
            }))
          }
          choices={[
            { label: "Position only (0)", value: "0" },
            { label: "Distances only (1)", value: "1" },
            { label: "Position and distances (2)", value: "2" },
          ]}
        />
        <TextField
          label="Default moving interval (ms)"
          value={settingsForm.movingUpdateRateMs}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              movingUpdateRateMs: value,
            }))
          }
          keyboardType="decimal-pad"
        />
        <TextField
          label="Default stationary interval (ms)"
          value={settingsForm.stationaryUpdateRateMs}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              stationaryUpdateRateMs: value,
            }))
          }
          keyboardType="decimal-pad"
        />
      </SectionCard>

      <SectionCard title="Position log retention">
        <TextField
          label="Retention (days)"
          value={settingsForm.positionLogRetentionDays}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              positionLogRetentionDays: value,
            }))
          }
          keyboardType="number-pad"
        />
        <TextField
          label="Maximum samples"
          value={settingsForm.positionLogMaxSamples}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              positionLogMaxSamples: value,
            }))
          }
          keyboardType="number-pad"
        />
      </SectionCard>

      <SectionCard title="Export network">
        <SelectField
          label="Format"
          value={exportFormat}
          onChange={(value) => setExportFormat(value as "csv" | "json")}
          choices={[
            { label: "JSON", value: "json" },
            { label: "CSV", value: "csv" },
          ]}
        />
        <ManagerButton
          label={`Generate selectable ${exportFormat.toUpperCase()}`}
          variant="outline"
          onPress={() => void exportProfile()}
        />
        {exportJson ? (
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
            {exportJson}
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Delete saved network"
        description="Removes app data only; hardware is not reset."
      >
        {confirmingDelete ? (
          <>
            <StatePanel
              state="error"
              message={`Delete “${network.name}” from this app? Hardware will not be reset.`}
            />
            <ManagerButton
              label={`Confirm delete ${network.name}`}
              variant="destructive"
              onPress={() => void deleteProfile()}
            />
            <ManagerButton
              label="Cancel"
              variant="ghost"
              onPress={() => setConfirmingDelete(false)}
            />
          </>
        ) : (
          <ManagerButton
            label="Delete saved network"
            variant="destructive"
            onPress={() => setConfirmingDelete(true)}
          />
        )}
      </SectionCard>
    </ManagerScreen>
  );
}
