import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "@eight2five/ui/text";

import { useManagedNetwork, usePansManager } from "../manager-context";
import { displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
  TextField,
  SelectField,
} from "../components/manager-ui";

export function NetworkSettingsScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const router = useRouter();
  const manager = usePansManager();
  const { network } = useManagedNetwork(networkId);
  const [name, setName] = React.useState(network?.name ?? "");
  const [pan, setPan] = React.useState(network ? String(network.panId) : "");
  const [notes, setNotes] = React.useState(network?.notes ?? "");
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
    setPan(String(network.panId));
    setNotes(network.notes ?? "");
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
    const panId = parsePanInput(pan);
    if (!name.trim()) return setError("Name is required.");
    if (
      manager.networks.some(
        (item) =>
          item.id !== network.id &&
          item.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
    )
      return setError("A network with this name already exists.");
    if (!Number.isInteger(panId) || panId < 0 || panId > 0xffff) {
      return setError("PAN ID must be 0–65535, in decimal or hexadecimal.");
    }
    try {
      await manager.saveNetwork({
        ...network,
        name: name.trim(),
        panId,
        notes: notes.trim() || undefined,
        updatedAt: Date.now(),
      });
      setMessage("Local profile updated. No hardware was changed.");
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

  const reviewHardwareMigration = () => {
    const panId = parsePanInput(pan);
    if (!name.trim()) return setError("Name is required.");
    if (
      manager.networks.some(
        (item) =>
          item.id !== network.id &&
          item.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
    )
      return setError("A network with this name already exists.");
    if (!Number.isInteger(panId) || panId < 0 || panId > 0xffff)
      return setError("PAN ID must be 0–65535, in decimal or hexadecimal.");
    if (panId === network.panId)
      return setError("Choose a different PAN ID for hardware migration.");
    router.push({
      pathname: `/(subapps)/dwm1001-manager/networks/${network.id}/batch-configure`,
      params: {
        migration: "1",
        oldPanId: String(network.panId),
        newPanId: String(panId),
        name: name.trim(),
        notes: notes.trim(),
      },
    } as never);
  };

  const deleteProfile = async () => {
    try {
      await manager.deleteNetwork(network.id);
      router.replace("/(subapps)/dwm1001-manager" as never);
    } catch (deleteError) {
      setError(displayError(deleteError));
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Local profile settings"
        description="Choose local-only save or review a sequential, verified hardware migration for all known members."
      >
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField
          label="Intended PAN ID (decimal or hexadecimal)"
          value={pan}
          onChangeText={setPan}
          helper="The saved PAN changes only after a hardware migration verifies every known member."
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <ManagerButton
          label="Save local profile only"
          onPress={() => void save()}
        />
        <ManagerButton
          label="Review hardware PAN migration"
          variant="outline"
          onPress={reviewHardwareMigration}
        />
        {message ? <StatePanel state="success" message={message} /> : null}
        {error ? <StatePanel state="error" message={error} /> : null}
      </SectionCard>

      <SectionCard title="Export profile">
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
            className="rounded-lg bg-gray-100 p-3 font-mono text-xs text-black"
          >
            {exportJson}
          </Text>
        ) : null}
        <Text selectable className="text-sm text-gray-600">
          Select the generated text manually. No clipboard or filesystem access
          is used.
        </Text>
      </SectionCard>

      <SectionCard
        title="Delete local profile"
        description="Deletes local profile data only. It does not reset or alter hardware."
      >
        {confirmingDelete ? (
          <>
            <StatePanel
              state="error"
              message={`Confirm deletion of local profile “${network.name}”. DWM1001 hardware will not be reset.`}
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
            label="Delete local profile"
            variant="destructive"
            onPress={() => setConfirmingDelete(true)}
          />
        )}
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
