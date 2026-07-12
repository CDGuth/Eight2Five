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
  const [message, setMessage] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  if (!network) {
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );
  }

  const save = async () => {
    setError(undefined);
    const panId = Number(pan);
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
      return setError("PAN ID must be a decimal integer from 0 to 65535.");
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
      setExportJson(await manager.exportNetworkJson(network.id));
    } catch (exportError) {
      setError(displayError(exportError));
    }
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
        description="Changing the PAN below updates local storage only. Hardware PAN migration requires an online verified batch flow and is not implemented on this screen."
      >
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField
          label="Local PAN ID (decimal)"
          value={pan}
          onChangeText={setPan}
          keyboardType="number-pad"
          helper="Local-only. This does not reconfigure anchors or tags."
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <ManagerButton
          label="Save local settings"
          onPress={() => void save()}
        />
        <ManagerButton
          label="Hardware PAN migration (requires online batch)"
          variant="outline"
          isDisabled
        />
        {message ? <StatePanel state="success" message={message} /> : null}
        {error ? <StatePanel state="error" message={error} /> : null}
      </SectionCard>

      <SectionCard title="Export profile">
        <ManagerButton
          label="Generate validated JSON"
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
          Copy/share is unavailable until an app-safe adapter is added. Select
          the JSON manually on supported platforms.
        </Text>
      </SectionCard>

      <SectionCard
        title="Delete local profile"
        description="Deletes local profile data only. It does not reset or alter hardware."
      >
        <ManagerButton
          label="Delete local profile"
          variant="destructive"
          onPress={() => void deleteProfile()}
        />
      </SectionCard>
    </ManagerScreen>
  );
}
