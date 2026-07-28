import React from "react";
import {
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  type ManagedNetwork,
  type MapUnits,
} from "@eight2five/mobile/pans-manager";

import {
  convertNetworkSettingsFormUnits,
  networkSettingsToForm,
  parseNetworkSettingsForm,
  type NetworkSettingsFormState,
} from "../network-settings-form";
import type { ExportFormat } from "../settings-definitions";
import { displayError } from "../manager-utils";

interface DraftActions {
  saveNetwork(network: ManagedNetwork): Promise<void>;
  exportNetwork(networkId: string, format: ExportFormat): Promise<string>;
  deleteNetwork(networkId: string): Promise<void>;
}

export function useNetworkSettingsDraft(
  network: ManagedNetwork | undefined,
  networks: readonly ManagedNetwork[],
  actions: DraftActions,
  onDeleted: () => void,
) {
  const [name, setName] = React.useState(network?.name ?? "");
  const [notes, setNotes] = React.useState(network?.notes ?? "");
  const [settings, setSettings] = React.useState(() =>
    networkSettingsToForm(
      network?.settings ?? DEFAULT_MANAGED_NETWORK_SETTINGS,
    ),
  );
  const [exportText, setExportText] = React.useState("");
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("json");
  const [message, setMessage] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const loadedNetworkId = React.useRef<string | undefined>(undefined);
  const latest = React.useRef({
    network,
    networks,
    actions,
    onDeleted,
    name,
    notes,
    settings,
    exportFormat,
  });
  React.useEffect(() => {
    latest.current = {
      network,
      networks,
      actions,
      onDeleted,
      name,
      notes,
      settings,
      exportFormat,
    };
  });

  React.useEffect(() => {
    if (!network || loadedNetworkId.current === network.id) return;
    loadedNetworkId.current = network.id;
    setName(network.name);
    setNotes(network.notes ?? "");
    setSettings(networkSettingsToForm(network.settings));
  }, [network]);

  const setField = React.useCallback(
    <K extends keyof NetworkSettingsFormState>(
      field: K,
      value: NetworkSettingsFormState[K],
    ) => setSettings((current) => ({ ...current, [field]: value })),
    [],
  );
  const setMapUnits = React.useCallback((units: MapUnits) => {
    setSettings((current) => convertNetworkSettingsFormUnits(current, units));
  }, []);

  const save = React.useCallback(async () => {
    const { network, networks, actions, name, notes, settings } =
      latest.current;
    if (!network) return;
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
    const parsed = parseNetworkSettingsForm(settings);
    if ("error" in parsed) return setError(parsed.error);
    try {
      await actions.saveNetwork({
        ...network,
        name: name.trim(),
        notes: notes.trim() || undefined,
        settings: parsed.settings,
        updatedAt: Date.now(),
      });
      setMessage("Network settings saved. Hardware was not changed.");
    } catch (saveError) {
      setError(displayError(saveError));
    }
  }, []);

  const exportProfile = React.useCallback(async () => {
    const { network, actions, exportFormat } = latest.current;
    if (!network) return;
    try {
      setExportText(await actions.exportNetwork(network.id, exportFormat));
    } catch (exportError) {
      setError(displayError(exportError));
    }
  }, []);

  const deleteProfile = React.useCallback(async () => {
    const { network, actions, onDeleted } = latest.current;
    if (!network) return;
    try {
      await actions.deleteNetwork(network.id);
      onDeleted();
    } catch (deleteError) {
      setError(displayError(deleteError));
    }
  }, []);

  return {
    name,
    setName,
    notes,
    setNotes,
    settings,
    setField,
    setMapUnits,
    exportText,
    exportFormat,
    setExportFormat,
    message,
    error,
    save,
    exportProfile,
    confirmingDelete,
    setConfirmingDelete,
    deleteProfile,
  };
}
