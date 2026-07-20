import React from "react";
import { useRouter } from "expo-router";
import { HStack } from "@eight2five/ui/components/hstack";
import { Text } from "@eight2five/ui/components/text";
import {
  eight2FiveFonts,
  eight2FiveSpacing,
  useEight2FiveTheme,
} from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import {
  useManagedNetworks,
  usePansDiscovery,
  usePansManager,
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
  const theme = useEight2FiveTheme();
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

  const addToNetwork = async () => {
    if (!networkId) {
      setActionError("Choose a network first.");
      return;
    }
    try {
      await discovery.assign(networkId, Array.from(discovery.selectedIds));
      router.replace(
        `/(subapps)/dwm1001-manager/networks/${networkId}` as never,
      );
    } catch (error) {
      setActionError(displayError(error));
    }
  };

  const selectedCount = discovery.selectedIds.size;
  const scanDurationSeconds = Math.round(
    (manager.managerSettings?.discoveryScanDurationMs ?? 25_000) / 1_000,
  );

  return (
    <ManagerScreen>
      <SectionCard
        title="Discover devices"
        description={`Start the ${scanDurationSeconds}-second scan first, then press SW2 on each DWM1001-DEV. Bluetooth advertisements stop about 20 seconds after power-up or SW2 wake-up.`}
        tone="accent"
      >
        <HStack className="flex-wrap" style={{ gap: eight2FiveSpacing.sm }}>
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
        {discovery.diagnostics ? (
          <Text selectable size="xs" style={{ color: theme.textMuted }}>
            Native build {discovery.diagnostics.buildId} ·{" "}
            {discovery.diagnostics.state}
            {` · raw ${discovery.diagnostics.rawResultCount} · PANS ${discovery.diagnostics.pansResultCount} · rejected ${discovery.diagnostics.rejectedResultCount}`}
          </Text>
        ) : null}
        {discovery.diagnostics?.warning ? (
          <StatePanel state="info" message={discovery.diagnostics.warning} />
        ) : null}
        {discovery.isScanning ? (
          <StatePanel
            state="info"
            message="Scan active. Press SW2 now and keep other BLE manager apps disconnected."
          />
        ) : null}
        {discovery.error ? (
          <StatePanel state="error" message={discovery.error} />
        ) : null}
        {actionError ? (
          <StatePanel state="error" message={actionError} />
        ) : null}
      </SectionCard>

      <SectionCard
        title={`${discovery.discoveries.length} devices found`}
        tone="quiet"
      >
        <SelectField
          label="Show"
          value={filter}
          onChange={(value) => setFilter(value as DiscoveryFilter)}
          choices={[
            { label: "All nearby", value: "all" },
            { label: "Not in a network", value: "unassigned" },
            { label: "Saved", value: "saved" },
            { label: "Incompatible", value: "incompatible" },
          ]}
        />
      </SectionCard>

      {selectedCount ? (
        <SectionCard
          title={`${selectedCount} selected`}
          description="Create a new network or add the devices to one you already saved."
          tone="accent"
        >
          <ManagerButton
            label="Create network"
            onPress={() =>
              router.push("/(subapps)/dwm1001-manager/networks/new" as never)
            }
          />
          {networks.length ? (
            <VStack style={{ gap: eight2FiveSpacing.sm }}>
              <Text
                size="sm"
                style={{
                  color: theme.text,
                  fontFamily: eight2FiveFonts.styleSemibold,
                }}
              >
                Add to an existing network
              </Text>
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
                label="Add devices"
                variant="outline"
                isDisabled={!networkId}
                onPress={() => void addToNetwork()}
              />
            </VStack>
          ) : null}
        </SectionCard>
      ) : null}

      <VStack style={{ gap: eight2FiveSpacing.sm }}>
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
                ? "Waiting for advertisements…"
                : "Start a scan to find devices."
            }
          />
        ) : null}
        {busyId ? (
          <Text selectable size="sm" style={{ color: theme.textMuted }}>
            Opening {busyId}…
          </Text>
        ) : null}
      </VStack>
    </ManagerScreen>
  );
}
