import React from "react";
import { useRouter } from "expo-router";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import { usePansManager } from "../manager-context";
import { displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
  TextField,
} from "../components/manager-ui";

export function CreateNetworkScreen() {
  const router = useRouter();
  const manager = usePansManager();
  const [name, setName] = React.useState("");
  const [panText, setPanText] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [result, setResult] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);

  const parsedPan = parsePanInput(panText);
  const duplicateName = manager.networks.some(
    (network) =>
      network.name.trim().toLocaleLowerCase() ===
      name.trim().toLocaleLowerCase(),
  );
  const duplicatePan = Number.isInteger(parsedPan)
    ? manager.networks.some((network) => network.panId === parsedPan)
    : false;

  const generatePan = () => {
    const used = new Set(manager.networks.map((network) => network.panId));
    let candidate = 0;
    do candidate = Math.floor(Math.random() * 0xfffe) + 1;
    while (used.has(candidate));
    setPanText(`0x${candidate.toString(16).toUpperCase().padStart(4, "0")}`);
  };

  const save = async () => {
    setError(undefined);
    setResult(undefined);
    if (!name.trim()) return setError("Network name is required.");
    if (duplicateName)
      return setError("A network with this name already exists.");
    if (!Number.isInteger(parsedPan) || parsedPan < 0 || parsedPan > 0xffff) {
      return setError("PAN ID must be 0–65535, in decimal or hexadecimal.");
    }
    setSaving(true);
    try {
      const selected = manager.discoveries.filter((item) =>
        manager.selectedDiscoveryIds.has(item.transportDeviceId),
      );
      const created = await manager.createNetwork({
        name,
        panId: parsedPan,
        notes,
        discoveries: selected,
      });
      const failures = created.configurations.filter(
        (configuration) => configuration.outcome === "failure",
      );
      if (failures.length) {
        setResult(
          `Profile saved. ${failures.length} device PAN assignment(s) failed and remain recorded for retry.`,
        );
      } else {
        router.replace(
          `/(subapps)/dwm1001-manager/networks/${created.network.id}` as never,
        );
      }
    } catch (saveError) {
      setError(displayError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Create local profile"
        description="The profile is saved first. Selected nearby devices are then persisted and assigned the PAN sequentially with readback verification."
      >
        <TextField
          label="Unique name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          error={
            duplicateName
              ? "Name is already used (case-insensitive)."
              : undefined
          }
        />
        <TextField
          label="16-bit PAN ID"
          value={panText}
          onChangeText={setPanText}
          placeholder="0x1234 or 4660"
          autoCapitalize="characters"
          helper={
            duplicatePan
              ? "Warning: another local profile uses this PAN."
              : "Hexadecimal and decimal are accepted."
          }
        />
        <ManagerButton
          label="Generate unused PAN"
          variant="outline"
          onPress={generatePan}
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <VStack className="gap-1 rounded-lg bg-gray-50 p-3">
          <Text className="font-medium text-black">Selected discoveries</Text>
          <Text selectable className="text-sm text-gray-600">
            {manager.selectedDiscoveryIds.size} device(s). No hardware write
            occurs until Save profile is pressed.
          </Text>
        </VStack>
        {error ? <StatePanel state="error" message={error} /> : null}
        {result ? <StatePanel state="success" message={result} /> : null}
        <ManagerButton
          label="Save profile"
          loading={saving}
          onPress={() => void save()}
        />
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
