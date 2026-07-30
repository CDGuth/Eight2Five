import React from "react";
import {
  selectNetworkDeviceSections,
  type DeviceConfigurationSnapshot,
  type DisplayDevice,
  type NetworkDeviceSection as NetworkDeviceSectionModel,
  type PansInspectionResult,
  PANS_UNASSIGNED_PAN_ID,
} from "@eight2five/mobile/pans-manager";
import { Button, ButtonText } from "@eight2five/ui/components/button";
import { Divider } from "@eight2five/ui/components/divider";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { Heading } from "@eight2five/ui/components/heading";
import { HStack } from "@eight2five/ui/components/hstack";
import { SafeAreaView } from "@eight2five/ui/components/safe-area-view";
import { Spinner } from "@eight2five/ui/components/spinner";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import {
  LegacyNetworkInfoRow,
  MemoizedNetworkDeviceSection,
  NetworkDeviceChildRow,
  NetworkDeviceEmptyRow,
} from "../components/network-device-section";
import { MemoizedNetworkDeviceRow } from "../components/network-device-row";
import { MANAGER_CARD_CONTENT_INSET } from "../components/manager-layout";
import { DeviceSettingsModal } from "../device-settings-modal";
import {
  useDiscoveredDevice,
  useDiscoveryActions,
  useDiscoveryStatus,
  useManagedDevice,
  useManagedDevices,
  useManagedDeviceSnapshots,
  useManagedNetwork,
  useManagedNetworks,
  useManagerReadiness,
  usePansDiscoveryList,
} from "../manager-context";
import { useDeviceConfigurationActions } from "../actions/device-configuration-actions";
import { NetworkEditModal } from "../network-edit-modal";
import { useTestbedToolbarAction } from "../../components/testbed-toolbar";

export type NetworkDeviceListRow =
  | {
      key: "unassigned-header";
      kind: "section-header";
      section: NetworkDeviceSectionModel;
    }
  | {
      key: string;
      kind: "device";
      section: NetworkDeviceSectionModel;
      device: DisplayDevice;
      isLast: boolean;
    }
  | { key: string; kind: "empty"; message: string; networkChild: boolean }
  | { key: "networks-heading"; kind: "networks-heading" }
  | { key: string; kind: "section-header"; section: NetworkDeviceSectionModel }
  | { key: string; kind: "legacy-info" };

export function flattenNetworkDeviceRows(
  sections: readonly NetworkDeviceSectionModel[],
  expandedSections: ReadonlySet<string>,
  unassignedEmptyMessage?: string,
): NetworkDeviceListRow[] {
  const rows: NetworkDeviceListRow[] = [];
  const unassigned = sections.find((section) => section.type === "unassigned");
  if (unassigned) {
    rows.push({
      key: "unassigned-header",
      kind: "section-header",
      section: unassigned,
    });
    if (expandedSections.has(unassigned.key)) {
      rows.push(
        ...unassigned.devices.map((device, index) => ({
          key: `row:${unassigned.key}:${device.key}`,
          kind: "device" as const,
          section: unassigned,
          device,
          isLast: index === unassigned.devices.length - 1,
        })),
      );
      if (unassigned.devices.length === 0 && unassignedEmptyMessage) {
        rows.push({
          key: "empty:unassigned",
          kind: "empty",
          message: unassignedEmptyMessage,
          networkChild: false,
        });
      }
    }
  }
  rows.push({ key: "networks-heading", kind: "networks-heading" });
  for (const section of sections) {
    if (section.type !== "network") continue;
    rows.push({
      key: `header:${section.key}`,
      kind: "section-header",
      section,
    });
    if (!expandedSections.has(section.key)) continue;
    if (section.network?.panId === PANS_UNASSIGNED_PAN_ID) {
      rows.push({ key: `legacy:${section.key}`, kind: "legacy-info" });
    }
    if (section.devices.length === 0) {
      rows.push({
        key: `empty:${section.key}`,
        kind: "empty",
        message: "No devices match this network.",
        networkChild: true,
      });
      continue;
    }
    rows.push(
      ...section.devices.map((device, index) => ({
        key: `row:${section.key}:${device.key}`,
        kind: "device" as const,
        section,
        device,
        isLast: index === section.devices.length - 1,
      })),
    );
  }
  return rows;
}

export function NetworksDevicesScreen() {
  const theme = useEight2FiveTheme();
  const networks = useManagedNetworks();
  const devices = useManagedDevices();
  const discoveries = usePansDiscoveryList();
  const deviceSnapshots = useManagedDeviceSnapshots();
  const readiness = useManagerReadiness();
  const discoveryStatus = useDiscoveryStatus();
  const {
    start: startDiscovery,
    stop: stopDiscovery,
    persist,
  } = useDiscoveryActions();
  const { inspect: inspectDevice } = useDeviceConfigurationActions();
  const [selectedNetworkId, setSelectedNetworkId] = React.useState<string>();
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>();
  const sections = React.useMemo(
    () => selectNetworkDeviceSections(networks, devices, discoveries),
    [networks, devices, discoveries],
  );
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    () => new Set(["unassigned"]),
  );
  const [expandedDevices, setExpandedDevices] = React.useState<Set<string>>(
    () => new Set(),
  );
  const hasDeviceRows = sections.some((section) => section.devices.length > 0);
  const emptyMessage =
    readiness.initialization === "ready" && !hasDeviceRows
      ? discoveryStatus.isScanning
        ? "Scanning…"
        : "No devices"
      : undefined;
  const listRows = React.useMemo(
    () => flattenNetworkDeviceRows(sections, expandedSections, emptyMessage),
    [emptyMessage, expandedSections, sections],
  );

  const setSectionExpanded = React.useCallback(
    (key: string, expanded: boolean) => {
      setExpandedSections((current) =>
        updateExpandedSet(current, key, expanded),
      );
    },
    [],
  );
  const setDeviceExpanded = React.useCallback(
    (key: string, expanded: boolean) => {
      setExpandedDevices((current) =>
        updateExpandedSet(current, key, expanded),
      );
    },
    [],
  );

  const openDeviceSettings = React.useCallback(
    async (device: DisplayDevice) => {
      const saved =
        device.savedDevice ??
        (device.discovery ? await persist(device.discovery) : undefined);
      if (!saved) throw new Error("Device discovery is unavailable.");
      setSelectedNetworkId(undefined);
      setSelectedDeviceId(saved.id);
    },
    [persist],
  );
  const openNetworkSettings = React.useCallback((networkId: string) => {
    setSelectedDeviceId(undefined);
    setSelectedNetworkId(networkId);
  }, []);

  const selectedDevice = useManagedDevice(selectedDeviceId ?? "");
  const selectedDiscovery = useDiscoveredDevice(
    selectedDevice?.transportDeviceId ?? "",
  );
  const selectedNetwork = useManagedNetwork(selectedNetworkId ?? "").network;
  const initialization = readiness.initialization;
  const discoveryState = discoveryStatus.state;
  const scanAction = React.useMemo(() => {
    const loading = initialization === "initializing";
    const active =
      discoveryState === "starting" || discoveryState === "scanning";
    const stopping = discoveryState === "stopping";
    const busy = loading || active || stopping;
    return initialization !== "error" ? (
      <Button
        testID="scan-control"
        variant="link"
        size="default"
        isDisabled={loading || stopping}
        accessibilityLabel={
          loading
            ? "Loading scanner"
            : stopping
              ? "Stopping scan"
              : active
                ? "Stop device scan"
                : "Start device scan"
        }
        accessibilityState={{
          busy,
          disabled: loading || stopping,
          selected: active,
        }}
        onPress={() => {
          if (active) void stopDiscovery();
          else void startDiscovery();
        }}
        className="min-h-11 rounded-lg px-4 data-[active=true]:bg-white/10"
        style={{
          backgroundColor:
            active || stopping ? "rgba(255,255,255,0.12)" : "transparent",
        }}
      >
        {busy ? (
          <Spinner color={theme.raw.white} />
        ) : (
          <ButtonText style={{ color: theme.raw.white }}>Scan</ButtonText>
        )}
      </Button>
    ) : null;
  }, [
    discoveryState,
    initialization,
    startDiscovery,
    stopDiscovery,
    theme.raw.white,
  ]);
  useTestbedToolbarAction("pans-discovery-scan", scanAction);

  const refreshDevice = React.useCallback(
    (deviceId: string) => inspectDevice(deviceId, true),
    [inspectDevice],
  );
  const listExtraData = React.useMemo(
    () => ({
      deviceSnapshots,
      emptyMessage,
      expandedDevices,
      expandedSections,
    }),
    [deviceSnapshots, emptyMessage, expandedDevices, expandedSections],
  );
  const renderListRow = React.useCallback(
    ({ item }: { item: NetworkDeviceListRow }) => (
      <MemoizedFlattenedListRow
        row={item}
        expanded={
          item.kind === "section-header"
            ? expandedSections.has(item.section.key)
            : false
        }
        deviceExpanded={
          item.kind === "device" ? expandedDevices.has(item.device.key) : false
        }
        snapshot={
          item.kind === "device" && item.device.savedDevice
            ? deviceSnapshots[item.device.savedDevice.id]
            : undefined
        }
        onSectionExpandedChange={setSectionExpanded}
        onDeviceExpandedChange={setDeviceExpanded}
        onEditNetwork={openNetworkSettings}
        onOpenDeviceSettings={openDeviceSettings}
        onRefreshDevice={refreshDevice}
      />
    ),
    [
      deviceSnapshots,
      expandedDevices,
      expandedSections,
      openDeviceSettings,
      openNetworkSettings,
      refreshDevice,
      setDeviceExpanded,
      setSectionExpanded,
    ],
  );

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <VStack className="flex-1">
        {readiness.error ? (
          <InlineError
            testID="initialization-error"
            message={readiness.error}
            onRetry={readiness.retry}
          />
        ) : null}
        {discoveryStatus.error ? (
          <InlineError
            testID="discovery-error"
            message={discoveryStatus.error}
          />
        ) : null}

        <FlatList
          testID="network-device-sections"
          data={listRows}
          keyExtractor={rowKeyExtractor}
          extraData={listExtraData}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={{
            paddingHorizontal: MANAGER_CARD_CONTENT_INSET,
            paddingBottom: eight2FiveSpacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          renderItem={renderListRow}
        />
        <NetworkEditModal
          network={selectedNetwork}
          isOpen={selectedNetworkId !== undefined}
          onClose={() => setSelectedNetworkId(undefined)}
        />
        <DeviceSettingsModal
          device={selectedDevice}
          discovery={selectedDiscovery}
          available={Boolean(selectedDiscovery && !selectedDiscovery.stale)}
          isOpen={selectedDeviceId !== undefined}
          onClose={() => setSelectedDeviceId(undefined)}
        />
      </VStack>
    </SafeAreaView>
  );
}

function rowKeyExtractor(row: NetworkDeviceListRow): string {
  return row.key;
}

interface FlattenedListRowProps {
  row: NetworkDeviceListRow;
  expanded: boolean;
  deviceExpanded: boolean;
  snapshot?: DeviceConfigurationSnapshot;
  onSectionExpandedChange(key: string, expanded: boolean): void;
  onDeviceExpandedChange(key: string, expanded: boolean): void;
  onEditNetwork(networkId: string): void;
  onOpenDeviceSettings(device: DisplayDevice): Promise<void>;
  onRefreshDevice(deviceId: string): Promise<PansInspectionResult>;
}

function FlattenedListRow({
  row,
  expanded,
  deviceExpanded,
  snapshot,
  onSectionExpandedChange,
  onDeviceExpandedChange,
  onEditNetwork,
  onOpenDeviceSettings,
  onRefreshDevice,
}: FlattenedListRowProps) {
  const theme = useEight2FiveTheme();
  if (row.kind === "networks-heading") {
    return (
      <VStack>
        <Divider
          testID="network-hierarchy-divider"
          style={{
            backgroundColor: theme.border,
            marginVertical: eight2FiveSpacing.md,
          }}
        />
        <Heading
          testID="networks-heading"
          size="lg"
          style={{ color: theme.text, paddingBottom: eight2FiveSpacing.md }}
        >
          Networks
        </Heading>
      </VStack>
    );
  }
  if (row.kind === "legacy-info") return <LegacyNetworkInfoRow />;
  if (row.kind === "empty") {
    return (
      <NetworkDeviceEmptyRow
        message={row.message}
        networkChild={row.networkChild}
      />
    );
  }
  if (row.kind === "section-header") {
    const header = (
      <MemoizedNetworkDeviceSection
        section={row.section}
        expanded={expanded}
        onExpandedChange={(next) =>
          onSectionExpandedChange(row.section.key, next)
        }
        onEditNetwork={row.section.network ? onEditNetwork : undefined}
      />
    );
    if (!row.section.network) return header;
    return (
      <VStack style={{ marginBottom: expanded ? 0 : eight2FiveSpacing.md }}>
        {header}
      </VStack>
    );
  }

  const { device, section } = row;
  const deviceRow = (
    <MemoizedNetworkDeviceRow
      device={device}
      network={section.network}
      snapshot={snapshot}
      expanded={deviceExpanded}
      onExpandedChange={(next) => onDeviceExpandedChange(device.key, next)}
      onOpenSettings={() => onOpenDeviceSettings(device)}
      onRefresh={
        device.savedDevice && device.available
          ? () => onRefreshDevice(device.savedDevice!.id)
          : undefined
      }
    />
  );
  return section.network ? (
    <NetworkDeviceChildRow isLast={row.isLast}>
      {deviceRow}
    </NetworkDeviceChildRow>
  ) : (
    <VStack style={{ paddingHorizontal: MANAGER_CARD_CONTENT_INSET }}>
      {deviceRow}
    </VStack>
  );
}

const MemoizedFlattenedListRow = React.memo(FlattenedListRow);

function InlineError({
  message,
  testID,
  onRetry,
}: {
  message: string;
  testID: string;
  onRetry?: () => void;
}) {
  const theme = useEight2FiveTheme();
  return (
    <HStack
      testID={testID}
      className="items-center justify-between"
      style={{
        gap: eight2FiveSpacing.sm,
        paddingHorizontal: eight2FiveSpacing.md,
        paddingBottom: eight2FiveSpacing.sm,
      }}
    >
      <Text
        selectable
        size="sm"
        accessibilityRole="alert"
        className="flex-1"
        style={{ color: theme.danger }}
      >
        {message}
      </Text>
      {onRetry ? (
        <Button
          testID="retry-initialization"
          size="sm"
          variant="ghost"
          accessibilityLabel="Retry manager initialization"
          onPress={onRetry}
        >
          <ButtonText style={{ color: theme.text }}>Retry</ButtonText>
        </Button>
      ) : null}
    </HStack>
  );
}

function updateExpandedSet(
  current: ReadonlySet<string>,
  key: string,
  expanded: boolean,
): Set<string> {
  if (expanded === current.has(key)) return current as Set<string>;
  const next = new Set(current);
  if (expanded) next.add(key);
  else next.delete(key);
  return next;
}
