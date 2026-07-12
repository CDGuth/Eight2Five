import React from "react";
import { useRouter } from "expo-router";
import { HStack } from "@eight2five/ui/hstack";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import {
  useManagedNetworks,
  usePansManager,
  usePansDiscovery,
} from "../manager-context";
import { displayError } from "../manager-utils";
import { DiscoveryDeviceRow } from "../components/discovery-device-row";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  SelectField,
  StatePanel,
} from "../components/manager-ui";

type DiscoveryFilter = "all" | "unassigned" | "saved" | "incompatible";

export function DiscoveryScreen() {
  const router = useRouter();
  const manager = usePansManager();
  const discovery = usePansDiscovery();
  const { networks, devices } = useManagedNetworks();
  const [filter, setFilter] = React.useState<DiscoveryFilter>("all");
  const [networkId, setNetworkId] = React.useState("");
  const [actionError, setActionError] = React.useState<string>();
  const [busyId, setBusyId] = React.useState<string>();

  const persistedByTransport = new Map(
    devices.map((device) => [device.transportDeviceId, device]),
  );
  const visible = discovery.discoveries.filter((item) => {
    const saved = persistedByTransport.get(item.transportDeviceId);
    if (filter === "unassigned") return !saved?.networkId;
    if (filter === "saved") return Boolean(saved);
    if (filter === "incompatible") {
      return (
        item.compatibility === "incompatible" ||
        item.compatibility === "malformed"
      );
    }
    return true;
  });
  const panGroups = new Set(
    visible
      .map(
        (item) => persistedByTransport.get(item.transportDeviceId)?.networkId,
      )
      .filter(Boolean),
  ).size;

  const openDevice = async (
    item: (typeof discovery.discoveries)[number],
    inspect: boolean,
  ) => {
    setBusyId(item.transportDeviceId);
    setActionError(undefined);
    try {
      const device = await discovery.persist(item);
      if (inspect) await manager.inspectDevice(device.id);
      router.push(`/(subapps)/dwm1001-manager/devices/${device.id}` as never);
    } catch (error) {
      setActionError(displayError(error));
    } finally {
      setBusyId(undefined);
    }
  };

  const assign = async () => {
    if (!networkId) {
      setActionError(
        "Choose a saved network before assigning selected devices.",
      );
      return;
    }
    try {
      await discovery.assign(networkId, Array.from(discovery.selectedIds));
    } catch (error) {
      setActionError(displayError(error));
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Explicit BLE discovery"
        description="Permission is requested only when Start scan is pressed. Devices are never saved or configured automatically."
      >
        <HStack className="flex-wrap gap-2">
          <ManagerButton
            label={discovery.isScanning ? "Scanning…" : "Start scan"}
            onPress={() => void discovery.start()}
            isDisabled={discovery.isScanning}
          />
          <ManagerButton
            label="Stop"
            variant="outline"
            onPress={discovery.stop}
            isDisabled={!discovery.isScanning}
          />
          <ManagerButton
            label="Clear"
            variant="ghost"
            onPress={discovery.clear}
          />
        </HStack>
        {discovery.error ? (
          <StatePanel state="error" message={discovery.error} />
        ) : null}
        {actionError ? (
          <StatePanel state="error" message={actionError} />
        ) : null}
      </SectionCard>

      <SectionCard title="Discovery summary">
        <Text selectable className="text-gray-700">
          {discovery.discoveries.length} total · {discovery.selectedIds.size}{" "}
          selected · {panGroups} saved PAN groups ·{" "}
          {discovery.discoveries.filter((item) => item.stale).length} stale
        </Text>
        <SelectField
          label="Device section"
          value={filter}
          onChange={(value) => setFilter(value as DiscoveryFilter)}
          choices={[
            { label: "All nearby", value: "all" },
            { label: "Unassigned", value: "unassigned" },
            { label: "Saved nearby", value: "saved" },
            { label: "Incompatible", value: "incompatible" },
          ]}
        />
      </SectionCard>

      {discovery.selectedIds.size ? (
        <SectionCard
          title="Assign selected locally"
          description="This associates saved records only. It does not write a PAN to hardware."
        >
          <SelectField
            label="Network"
            value={networkId}
            onChange={setNetworkId}
            choices={networks.map((network) => ({
              label: network.name,
              value: network.id,
            }))}
          />
          <ManagerButton
            label={`Assign ${discovery.selectedIds.size} devices`}
            onPress={() => void assign()}
          />
        </SectionCard>
      ) : null}

      <VStack space="md">
        {visible.map((item) => (
          <DiscoveryDeviceRow
            key={item.transportDeviceId || `${item.lastSeenAt}`}
            device={item}
            selected={discovery.selectedIds.has(item.transportDeviceId)}
            saved={persistedByTransport.has(item.transportDeviceId)}
            onToggle={() => discovery.toggleSelection(item.transportDeviceId)}
            onOpen={() => void openDevice(item, false)}
            onInspect={() => void openDevice(item, true)}
          />
        ))}
        {!visible.length ? (
          <StatePanel
            state="info"
            message={
              discovery.isScanning
                ? "Waiting for DWM1001 advertisements…"
                : "No devices in this section. Start a scan when ready."
            }
          />
        ) : null}
        {busyId ? (
          <Text selectable className="text-sm text-gray-600">
            Working with {busyId}…
          </Text>
        ) : null}
      </VStack>
    </ManagerScreen>
  );
}
