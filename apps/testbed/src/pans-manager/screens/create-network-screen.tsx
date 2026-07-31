import React from "react";
import { useRouter } from "expo-router";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveFonts, useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import {
  useDiscoverySelection,
  useManagedNetworks,
  usePansDiscoveryList,
} from "../manager-context";
import { useRepositoryNetworkActions } from "../actions/repository-network-actions";
import { displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
  TextField,
} from "../components/manager-ui";
import { formatPanInput, parsePanInput } from "../settings-definitions";

export function CreateNetworkScreen() {
  const router = useRouter();
  const theme = useEight2FiveTheme();
  const networks = useManagedNetworks();
  const discoveries = usePansDiscoveryList();
  const { selectedIds } = useDiscoverySelection();
  const { createNetwork } = useRepositoryNetworkActions();
  const [name, setName] = React.useState("");
  const [panText, setPanText] = React.useState(() =>
    formatPanInput(generatePan(networks)),
  );
  const [error, setError] = React.useState<string>();
  const [result, setResult] = React.useState<string>();
  const [createdWithFailures, setCreatedWithFailures] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const parsedPan = parsePanInput(panText);
  const duplicateName = networks.some(
    (network) =>
      network.name.trim().toLocaleLowerCase() ===
      name.trim().toLocaleLowerCase(),
  );
  const duplicatePan =
    parsedPan !== undefined
      ? networks.some((network) => network.panId === parsedPan)
      : false;
  const selected = discoveries.filter((item) =>
    selectedIds.has(item.transportDeviceId),
  );

  const save = async () => {
    setError(undefined);
    setResult(undefined);
    if (!name.trim()) return setError("Enter a network name.");
    if (duplicateName) return setError("That network name is already in use.");
    if (parsedPan === undefined) {
      return setError("Network ID must be between 0 and 65535.");
    }
    setSaving(true);
    try {
      const created = await createNetwork({
        name,
        panId: parsedPan,
        discoveries: selected,
      });
      const failures = created.configurations.filter(
        (configuration) => configuration.outcome === "failure",
      );
      if (failures.length) {
        setCreatedWithFailures(true);
        setResult(
          `Network created. ${failures.length} device${
            failures.length === 1 ? "" : "s"
          } could not be assigned.`,
        );
        return;
      }
      router.replace("/(tabs)/networks-devices" as never);
    } catch (saveError) {
      setError(displayError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard title="Name the network" tone="accent">
        <TextField
          label="Network name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          error={duplicateName ? "Name already used." : undefined}
        />
        <VStack style={{ gap: 4 }}>
          <Text
            style={{
              color: theme.text,
              fontFamily: eight2FiveFonts.styleSemibold,
            }}
          >
            Devices
          </Text>
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            {selected.length} selected
          </Text>
        </VStack>
      </SectionCard>

      <SectionCard title="Network ID" tone="quiet">
        <TextField
          label="PAN ID"
          value={panText}
          onChangeText={setPanText}
          placeholder="0x1234"
          autoCapitalize="characters"
          helper={
            duplicatePan ? "Another saved network uses this ID." : undefined
          }
        />
        <ManagerButton
          label="Generate another"
          variant="ghost"
          onPress={() => setPanText(formatPanInput(generatePan(networks)))}
        />
      </SectionCard>

      {error ? <StatePanel state="error" message={error} /> : null}
      {result ? <StatePanel state="info" message={result} /> : null}
      {createdWithFailures ? (
        <ManagerButton
          label="Back to networks"
          onPress={() => router.replace("/(tabs)/networks-devices" as never)}
        />
      ) : (
        <ManagerButton
          label={
            selected.length ? "Create network & add devices" : "Create network"
          }
          loading={saving}
          onPress={() => void save()}
        />
      )}
    </ManagerScreen>
  );
}

function generatePan(networks: { panId: number }[]): number {
  const used = new Set(networks.map((network) => network.panId));
  let candidate = 0;
  do candidate = Math.floor(Math.random() * 0xfffe) + 1;
  while (used.has(candidate));
  return candidate;
}
