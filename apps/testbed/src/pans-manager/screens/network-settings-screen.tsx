import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  formatPanId,
  mapUnitAbbreviation,
} from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveRadii, useEight2FiveTheme } from "@eight2five/ui/theme";

import { useManagedNetwork, useManagedNetworks } from "../manager-context";
import { useRepositoryNetworkActions } from "../actions/repository-network-actions";
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
import { SettingHelp } from "../components/setting-help";
import {
  convertNetworkSettingsFormUnits,
  networkSettingsToForm,
  parseNetworkSettingsForm,
} from "../network-settings-form";

export function NetworkSettingsScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const networks = useManagedNetworks();
  const { saveNetwork, exportNetwork, deleteNetwork } =
    useRepositoryNetworkActions();
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
  const coordinateUnit = mapUnitAbbreviation(settingsForm.mapUnits);
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
      networks.some(
        (item) =>
          item.id !== network.id &&
          item.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
    )
      return setError("A network with this name already exists.");
    const parsedSettings = parseNetworkSettingsForm(settingsForm);
    if ("error" in parsedSettings) return setError(parsedSettings.error);
    try {
      await saveNetwork({
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
      setExportJson(await exportNetwork(network.id, exportFormat));
    } catch (exportError) {
      setError(displayError(exportError));
    }
  };

  const deleteProfile = async () => {
    try {
      await deleteNetwork(network.id);
      router.replace("/(tabs)/networks-devices" as never);
    } catch (deleteError) {
      setError(displayError(deleteError));
    }
  };

  return (
    <ManagerScreen>
      <SectionCard title="Identity">
        <TextField label="Name" value={name} onChangeText={setName} />
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

      <SectionCard title="PANS Network ID">
        <KeyValue label="Hardware PAN" value={formatPanId(network.panId)} />
        <SettingHelp title="PANS Network ID">
          Saved networks use PAN IDs from 1 through 65535. PAN 0 (0x0000) is the
          PANS default PAN ID and is used for the unassigned-device state. A
          device matches this profile only after its hardware PAN has been read
          and verified.
        </SettingHelp>
      </SectionCard>

      <SectionCard title="Map and coordinate system">
        <SelectField
          testID="network-map-units-select"
          label="Display units"
          value={settingsForm.mapUnits}
          onChange={(value) =>
            setSettingsForm((current) =>
              convertNetworkSettingsFormUnits(
                current,
                value as "metric" | "imperial",
              ),
            )
          }
          choices={[
            { label: "Metric (meters)", value: "metric" },
            { label: "Imperial (feet)", value: "imperial" },
          ]}
          helper="Coordinates remain stored in meters; this controls display and input conversion."
        />
        <SelectField
          testID="network-map-area-mode-select"
          label="Map area"
          value={settingsForm.mapAreaMode}
          onChange={(value) =>
            setSettingsForm((current) => ({
              ...current,
              mapAreaMode: value as "infinite" | "bounded",
            }))
          }
          choices={[
            { label: "Infinite canvas", value: "infinite" },
            { label: "Bounded area", value: "bounded" },
          ]}
          helper="Bounded mode draws and constrains navigation to the saved X/Y rectangle."
        />
        <TextField
          label={`Minimum X (${coordinateUnit})`}
          value={settingsForm.minXMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, minXMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label={`Maximum X (${coordinateUnit})`}
          value={settingsForm.maxXMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, maxXMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label={`Minimum Y (${coordinateUnit})`}
          value={settingsForm.minYMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, minYMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label={`Maximum Y (${coordinateUnit})`}
          value={settingsForm.maxYMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, maxYMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label={`Minimum Z (${coordinateUnit})`}
          value={settingsForm.minZMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, minZMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label={`Maximum Z (${coordinateUnit})`}
          value={settingsForm.maxZMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({ ...current, maxZMeters: value }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label={`Default anchor height (${coordinateUnit})`}
          value={settingsForm.defaultAnchorHeightMeters}
          onChangeText={(value) =>
            setSettingsForm((current) => ({
              ...current,
              defaultAnchorHeightMeters: value,
            }))
          }
          keyboardType="numbers-and-punctuation"
        />
        <SettingHelp title="Coordinates and bounds">
          X and Y are horizontal coordinates from the network origin. Z is
          height. Values are converted at the UI boundary and stored in meters.
          Bounds remain saved in both area modes; bounded mode draws the
          rectangle and constrains camera panning, while nodes outside it remain
          available to diagnostics and exports.
        </SettingHelp>
      </SectionCard>

      <SectionCard title="Device availability">
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
        <SwitchField
          label="Auto-connect"
          value={settingsForm.autoConnect}
          onChange={(value) =>
            setSettingsForm((current) => ({ ...current, autoConnect: value }))
          }
        />
        <SettingHelp title="Stale timeout">
          Number of seconds without a discovery advertisement before the app
          marks a device offline. Auto-connect controls app behavior only and
          does not change PANS hardware.
        </SettingHelp>
      </SectionCard>

      <SectionCard title="Defaults">
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
        <SettingHelp title="Tag update defaults">
          The location engine computes positions. Moving and stationary rates
          are milliseconds; stationary detection enables the slower interval.
          Location-data mode chooses positions, anchor distances, or both.
        </SettingHelp>
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
        <SettingHelp title="Position log defaults">
          Retention days and maximum samples limit app-side log storage. They do
          not change hardware or its update rate.
        </SettingHelp>
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
        title="Destructive actions"
        description="Removes the saved profile, app settings, and position logs. Hardware is not reset."
      >
        {confirmingDelete ? (
          <>
            <StatePanel
              state="error"
              message={`Delete “${network.name}” from this app? Hardware PAN IDs remain unchanged. Devices move to Unassigned when no remaining profile matches their cached PAN.`}
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
