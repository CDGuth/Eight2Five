import React from "react";
import { useWindowDimensions } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
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
  findNetworkDropTarget,
  type NetworkDropZone,
} from "../components/network-device-drop";
import type { NetworkDeviceDragEvent } from "../components/network-device-drag";
import {
  LegacyNetworkInfoRow,
  MemoizedNetworkDeviceSection,
  NetworkDeviceChildRow,
  NetworkDeviceEmptyRow,
} from "../components/network-device-section";
import { MemoizedNetworkDeviceRow } from "../components/network-device-row";
import { MANAGER_CARD_CONTENT_INSET } from "../components/manager-layout";
import {
  ManagerSwipeToDelete,
  type ManagerSwipeRegistryCallbacks,
} from "../components/manager-swipe-to-delete";
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
import { displayError } from "../manager-utils";
import { NetworkEditModal } from "../network-edit-modal";
import { useTestbedToolbarAction } from "../../components/testbed-toolbar";

export const NETWORK_DROP_AUTO_EXPAND_MS = 600;

interface FrozenNetworkDeviceDisplay {
  sections: NetworkDeviceSectionModel[];
  snapshots: Record<string, DeviceConfigurationSnapshot>;
  emptyMessage?: string;
}

interface DropAssignmentRequest {
  device: DisplayDevice;
  targetNetworkId: string;
  persistedDeviceId?: string;
}

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

type DropAssignmentStatus =
  | { kind: "progress"; message: "Persisting…" | "Assigning…" }
  | {
      kind: "error";
      message: string;
      retry?: DropAssignmentRequest;
    };

export function NetworksDevicesScreen() {
  const theme = useEight2FiveTheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
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
  const { assignToNetwork, inspect: inspectDevice } =
    useDeviceConfigurationActions();
  const [selectedNetworkId, setSelectedNetworkId] = React.useState<string>();
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>();
  const [
    deviceDestructiveActionRequested,
    setDeviceDestructiveActionRequested,
  ] = React.useState(false);
  const [
    networkDestructiveActionRequested,
    setNetworkDestructiveActionRequested,
  ] = React.useState(false);
  const liveSections = React.useMemo(
    () => selectNetworkDeviceSections(networks, devices, discoveries),
    [networks, devices, discoveries],
  );
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    () => new Set(["unassigned"]),
  );
  const [expandedDevices, setExpandedDevices] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [frozenDisplay, setFrozenDisplay] =
    React.useState<FrozenNetworkDeviceDisplay>();
  const [activeDragDeviceKey, setActiveDragDeviceKey] =
    React.useState<string>();
  const [hoveredNetworkId, setHoveredNetworkId] = React.useState<string>();
  const [assignmentStatus, setAssignmentStatus] =
    React.useState<DropAssignmentStatus>();
  const liveSectionsRef = React.useRef(liveSections);
  const snapshotsRef = React.useRef(deviceSnapshots);
  const emptyMessageRef = React.useRef<string | undefined>(undefined);
  const expandedSectionsRef = React.useRef(expandedSections);
  const activeDragRef = React.useRef<
    { deviceKey: string; device: DisplayDevice } | undefined
  >(undefined);
  const inFlightRef = React.useRef(false);
  const dropZonesRef = React.useRef(new Map<string, NetworkDropZone>());
  const dropZoneMeasurersRef = React.useRef(new Map<string, () => void>());
  const hoveredNetworkIdRef = React.useRef<string | undefined>(undefined);
  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const openSwipeableRef = React.useRef<
    { key: string; methods: SwipeableMethods } | undefined
  >(undefined);
  const hasDeviceRows = liveSections.some(
    (section) => section.devices.length > 0,
  );
  const emptyMessage =
    readiness.initialization === "ready" && !hasDeviceRows
      ? discoveryStatus.isScanning
        ? "Scanning…"
        : "No devices"
      : undefined;
  React.useEffect(() => {
    liveSectionsRef.current = liveSections;
    snapshotsRef.current = deviceSnapshots;
    expandedSectionsRef.current = expandedSections;
    emptyMessageRef.current = emptyMessage;
  }, [deviceSnapshots, emptyMessage, expandedSections, liveSections]);
  const sections = frozenDisplay?.sections ?? liveSections;
  const displayedSnapshots = frozenDisplay?.snapshots ?? deviceSnapshots;
  const displayedEmptyMessage = frozenDisplay
    ? frozenDisplay.emptyMessage
    : emptyMessage;
  const listRows = React.useMemo(
    () =>
      flattenNetworkDeviceRows(
        sections,
        expandedSections,
        displayedEmptyMessage,
      ),
    [displayedEmptyMessage, expandedSections, sections],
  );

  const setSectionExpanded = React.useCallback(
    (key: string, expanded: boolean) => {
      setExpandedSections((current) => {
        const next = updateExpandedSet(current, key, expanded);
        expandedSectionsRef.current = next;
        return next;
      });
    },
    [],
  );

  const measureDropZones = React.useCallback(() => {
    for (const measure of dropZoneMeasurersRef.current.values()) measure();
  }, []);
  const registerDropZone = React.useCallback(
    (networkId: string, measure: () => void) => {
      dropZoneMeasurersRef.current.set(networkId, measure);
      measure();
      return () => {
        if (dropZoneMeasurersRef.current.get(networkId) === measure)
          dropZoneMeasurersRef.current.delete(networkId);
        dropZonesRef.current.delete(networkId);
      };
    },
    [],
  );
  const updateDropZone = React.useCallback((zone: NetworkDropZone) => {
    dropZonesRef.current.set(zone.networkId, zone);
  }, []);
  const clearHover = React.useCallback(() => {
    if (hoverTimerRef.current !== undefined) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = undefined;
    }
    hoveredNetworkIdRef.current = undefined;
    setHoveredNetworkId(undefined);
  }, []);
  const updateHover = React.useCallback(
    (point: Pick<NetworkDeviceDragEvent, "x" | "y">) => {
      const targetNetworkId = findNetworkDropTarget(
        [...dropZonesRef.current.values()],
        point,
      );
      if (targetNetworkId === hoveredNetworkIdRef.current) return;
      if (hoverTimerRef.current !== undefined) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = undefined;
      }
      hoveredNetworkIdRef.current = targetNetworkId;
      setHoveredNetworkId(targetNetworkId);
      if (
        targetNetworkId &&
        !expandedSectionsRef.current.has(`network:${targetNetworkId}`)
      ) {
        hoverTimerRef.current = setTimeout(() => {
          hoverTimerRef.current = undefined;
          setSectionExpanded(`network:${targetNetworkId}`, true);
          requestAnimationFrame(measureDropZones);
        }, NETWORK_DROP_AUTO_EXPAND_MS);
      }
    },
    [measureDropZones, setSectionExpanded],
  );

  React.useEffect(() => clearHover, [clearHover]);
  React.useEffect(() => {
    const frame = requestAnimationFrame(measureDropZones);
    return () => cancelAnimationFrame(frame);
  }, [
    expandedDevices,
    expandedSections,
    measureDropZones,
    windowHeight,
    windowWidth,
  ]);

  const finishDrag = React.useCallback(() => {
    activeDragRef.current = undefined;
    setActiveDragDeviceKey(undefined);
    setFrozenDisplay(undefined);
    clearHover();
  }, [clearHover]);
  const handleDragStart = React.useCallback(
    (event: NetworkDeviceDragEvent) => {
      if (inFlightRef.current) return;
      const source = liveSectionsRef.current
        .find((section) => section.type === "unassigned")
        ?.devices.find((device) => device.key === event.deviceKey);
      if (
        !source ||
        !source.available ||
        source.discovery?.compatibility === "malformed"
      )
        return;
      const frozen: FrozenNetworkDeviceDisplay = {
        sections: snapshotSections(liveSectionsRef.current),
        snapshots: { ...snapshotsRef.current },
        ...(emptyMessageRef.current
          ? { emptyMessage: emptyMessageRef.current }
          : {}),
      };
      activeDragRef.current = { deviceKey: event.deviceKey, device: source };
      setFrozenDisplay(frozen);
      setActiveDragDeviceKey(event.deviceKey);
      setAssignmentStatus(undefined);
      clearHover();
      requestAnimationFrame(measureDropZones);
    },
    [clearHover, measureDropZones],
  );
  const handleDragMove = React.useCallback(
    (event: NetworkDeviceDragEvent) => {
      if (activeDragRef.current?.deviceKey !== event.deviceKey) return;
      measureDropZones();
      updateHover(event);
    },
    [measureDropZones, updateHover],
  );
  const handleListScroll = React.useCallback(() => {
    if (activeDragRef.current) measureDropZones();
  }, [measureDropZones]);

  const runDropAssignment = React.useCallback(
    async (request: DropAssignmentRequest) => {
      inFlightRef.current = true;
      let persistedDeviceId =
        request.persistedDeviceId ?? request.device.savedDevice?.id;
      let stage: "persisting" | "assigning" = persistedDeviceId
        ? "assigning"
        : "persisting";
      setAssignmentStatus({
        kind: "progress",
        message: stage === "persisting" ? "Persisting…" : "Assigning…",
      });
      try {
        if (!persistedDeviceId) {
          const discovery = request.device.discovery;
          if (!discovery)
            throw new Error("Device discovery is no longer available.");
          const persisted = await persist(discovery);
          persistedDeviceId = persisted.id;
          stage = "assigning";
          setAssignmentStatus({ kind: "progress", message: "Assigning…" });
        }
        const result = await assignToNetwork({
          deviceId: persistedDeviceId,
          targetNetworkId: request.targetNetworkId,
        });
        if (result.outcome !== "assigned") {
          const retainedMessage =
            result.stage === "association"
              ? "Hardware PAN may have changed; the app association was not completed. The saved device record was retained."
              : "The saved device record remains unassigned.";
          setAssignmentStatus({
            kind: "error",
            message: `${
              result.error?.message ?? "Network profile assignment failed."
            } ${retainedMessage}`,
            retry: { ...request, persistedDeviceId },
          });
          return;
        }
        setAssignmentStatus(undefined);
      } catch (error) {
        setAssignmentStatus({
          kind: "error",
          message:
            stage === "persisting"
              ? `${displayError(error)} Device remains unassigned.`
              : `${displayError(
                  error,
                )} Assignment status could not be confirmed. Hardware PAN or app association may have changed; the saved device record was retained.`,
          retry: {
            ...request,
            ...(persistedDeviceId ? { persistedDeviceId } : {}),
          },
        });
      } finally {
        inFlightRef.current = false;
        finishDrag();
      }
    },
    [assignToNetwork, finishDrag, persist],
  );
  const handleDragEnd = React.useCallback(
    (event: NetworkDeviceDragEvent) => {
      const activeDrag = activeDragRef.current;
      if (!activeDrag || activeDrag.deviceKey !== event.deviceKey) return false;
      if (event.cancelled) {
        finishDrag();
        return false;
      }
      const targetNetworkId = findNetworkDropTarget(
        [...dropZonesRef.current.values()],
        event,
      );
      const validTarget = liveSectionsRef.current.some(
        (section) => section.network?.id === targetNetworkId,
      );
      if (!targetNetworkId || !validTarget) {
        setAssignmentStatus({
          kind: "error",
          message: "No network was selected. Device remains unassigned.",
        });
        finishDrag();
        return false;
      }
      setSectionExpanded(`network:${targetNetworkId}`, true);
      clearHover();
      void runDropAssignment({
        device: activeDrag.device,
        targetNetworkId,
      });
      return true;
    },
    [clearHover, finishDrag, runDropAssignment, setSectionExpanded],
  );
  const dragCallbacks = React.useMemo(
    () => ({
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
    }),
    [handleDragEnd, handleDragMove, handleDragStart],
  );
  const retryAssignment = React.useCallback(() => {
    if (assignmentStatus?.kind !== "error" || !assignmentStatus.retry) return;
    setFrozenDisplay({
      sections: snapshotSections(liveSectionsRef.current),
      snapshots: { ...snapshotsRef.current },
      ...(emptyMessageRef.current
        ? { emptyMessage: emptyMessageRef.current }
        : {}),
    });
    void runDropAssignment(assignmentStatus.retry);
  }, [assignmentStatus, runDropAssignment]);
  const assignmentInFlight = assignmentStatus?.kind === "progress";
  const listExtraData = React.useMemo(
    () => ({
      activeDragDeviceKey,
      assignmentInFlight,
      displayedEmptyMessage,
      displayedSnapshots,
      expandedDevices,
      expandedSections,
      hoveredNetworkId,
    }),
    [
      activeDragDeviceKey,
      assignmentInFlight,
      displayedEmptyMessage,
      displayedSnapshots,
      expandedDevices,
      expandedSections,
      hoveredNetworkId,
    ],
  );
  const setDeviceExpanded = React.useCallback(
    (key: string, expanded: boolean) => {
      setExpandedDevices((current) =>
        updateExpandedSet(current, key, expanded),
      );
    },
    [],
  );
  const swipeRegistry = React.useMemo<ManagerSwipeRegistryCallbacks>(
    () => ({
      onWillOpen: (key, methods) => {
        if (openSwipeableRef.current?.key !== key)
          openSwipeableRef.current?.methods.close();
        openSwipeableRef.current = { key, methods };
      },
      onClose: (key, methods) => {
        if (
          openSwipeableRef.current?.key === key &&
          openSwipeableRef.current.methods === methods
        )
          openSwipeableRef.current = undefined;
      },
    }),
    [],
  );

  const openDeviceSettings = React.useCallback(
    async (device: DisplayDevice) => {
      const saved =
        device.savedDevice ??
        (device.discovery ? await persist(device.discovery) : undefined);
      if (!saved) throw new Error("Device discovery is unavailable.");
      setSelectedNetworkId(undefined);
      setDeviceDestructiveActionRequested(false);
      setSelectedDeviceId(saved.id);
    },
    [persist],
  );
  const requestDeviceDelete = React.useCallback((device: DisplayDevice) => {
    if (!device.savedDevice) return;
    setSelectedNetworkId(undefined);
    setDeviceDestructiveActionRequested(true);
    setSelectedDeviceId(device.savedDevice.id);
  }, []);
  const requestNetworkDelete = React.useCallback((networkId: string) => {
    setSelectedDeviceId(undefined);
    setNetworkDestructiveActionRequested(true);
    setSelectedNetworkId(networkId);
  }, []);
  const openNetworkSettings = React.useCallback((networkId: string) => {
    setSelectedDeviceId(undefined);
    setNetworkDestructiveActionRequested(false);
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
            ? displayedSnapshots[item.device.savedDevice.id]
            : undefined
        }
        interactionsDisabled={
          activeDragDeviceKey !== undefined || assignmentInFlight
        }
        dragEnabled={!assignmentInFlight}
        activeDragDeviceKey={activeDragDeviceKey}
        hoveredNetworkId={hoveredNetworkId}
        onSectionExpandedChange={setSectionExpanded}
        onDeviceExpandedChange={setDeviceExpanded}
        onEditNetwork={openNetworkSettings}
        onOpenDeviceSettings={openDeviceSettings}
        onRefreshDevice={refreshDevice}
        onRequestDeviceDelete={requestDeviceDelete}
        onRequestNetworkDelete={requestNetworkDelete}
        swipeRegistry={swipeRegistry}
        dragCallbacks={dragCallbacks}
        onRegisterDropZone={registerDropZone}
        onDropZoneChange={updateDropZone}
      />
    ),
    [
      activeDragDeviceKey,
      assignmentInFlight,
      displayedSnapshots,
      dragCallbacks,
      expandedDevices,
      expandedSections,
      hoveredNetworkId,
      openDeviceSettings,
      openNetworkSettings,
      refreshDevice,
      registerDropZone,
      requestDeviceDelete,
      requestNetworkDelete,
      setDeviceExpanded,
      setSectionExpanded,
      swipeRegistry,
      updateDropZone,
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
        {assignmentStatus ? (
          <DropStatus
            status={assignmentStatus}
            onRetry={
              assignmentStatus.kind === "error" && assignmentStatus.retry
                ? retryAssignment
                : undefined
            }
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
          scrollEnabled={!activeDragDeviceKey && !assignmentInFlight}
          scrollEventThrottle={32}
          onScroll={handleListScroll}
          renderItem={renderListRow}
        />
        <NetworkEditModal
          network={selectedNetwork}
          isOpen={selectedNetworkId !== undefined}
          destructiveActionRequested={networkDestructiveActionRequested}
          onClose={() => {
            setSelectedNetworkId(undefined);
            setNetworkDestructiveActionRequested(false);
          }}
        />
        <DeviceSettingsModal
          device={selectedDevice}
          discovery={selectedDiscovery}
          available={Boolean(selectedDiscovery && !selectedDiscovery.stale)}
          isOpen={selectedDeviceId !== undefined}
          destructiveActionRequested={deviceDestructiveActionRequested}
          onClose={() => {
            setSelectedDeviceId(undefined);
            setDeviceDestructiveActionRequested(false);
          }}
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
  interactionsDisabled: boolean;
  dragEnabled: boolean;
  activeDragDeviceKey?: string;
  hoveredNetworkId?: string;
  onSectionExpandedChange(key: string, expanded: boolean): void;
  onDeviceExpandedChange(key: string, expanded: boolean): void;
  onEditNetwork(networkId: string): void;
  onOpenDeviceSettings(device: DisplayDevice): Promise<void>;
  onRefreshDevice(deviceId: string): Promise<PansInspectionResult>;
  onRequestDeviceDelete(device: DisplayDevice): void;
  onRequestNetworkDelete(networkId: string): void;
  swipeRegistry: ManagerSwipeRegistryCallbacks;
  dragCallbacks: {
    onDragStart(event: NetworkDeviceDragEvent): void;
    onDragMove(event: NetworkDeviceDragEvent): void;
    onDragEnd(event: NetworkDeviceDragEvent): boolean;
  };
  onRegisterDropZone(networkId: string, measure: () => void): () => void;
  onDropZoneChange(zone: NetworkDropZone): void;
}

function FlattenedListRow({
  row,
  expanded,
  deviceExpanded,
  snapshot,
  interactionsDisabled,
  dragEnabled,
  activeDragDeviceKey,
  hoveredNetworkId,
  onSectionExpandedChange,
  onDeviceExpandedChange,
  onEditNetwork,
  onOpenDeviceSettings,
  onRefreshDevice,
  onRequestDeviceDelete,
  onRequestNetworkDelete,
  swipeRegistry,
  dragCallbacks,
  onRegisterDropZone,
  onDropZoneChange,
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
        interactionsDisabled={interactionsDisabled}
        hoveredNetworkId={hoveredNetworkId}
        onRegisterDropZone={onRegisterDropZone}
        onDropZoneChange={onDropZoneChange}
      />
    );
    if (!row.section.network) return header;
    return (
      <VStack style={{ marginBottom: expanded ? 0 : eight2FiveSpacing.md }}>
        <ManagerSwipeToDelete
          rowKey={row.section.key}
          label={row.section.network.name}
          enabled={!interactionsDisabled}
          registry={swipeRegistry}
          onRequestDelete={() =>
            onRequestNetworkDelete(row.section.network!.id)
          }
        >
          {header}
        </ManagerSwipeToDelete>
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
      interactionsDisabled={interactionsDisabled}
      dragCallbacks={
        dragEnabled &&
        (activeDragDeviceKey === undefined ||
          activeDragDeviceKey === device.key) &&
        section.type === "unassigned" &&
        device.available &&
        device.discovery?.compatibility !== "malformed"
          ? dragCallbacks
          : undefined
      }
    />
  );
  const swipeable = device.savedDevice ? (
    <ManagerSwipeToDelete
      rowKey={device.key}
      label={device.displayName}
      enabled={!interactionsDisabled}
      registry={swipeRegistry}
      onRequestDelete={() => onRequestDeviceDelete(device)}
    >
      {deviceRow}
    </ManagerSwipeToDelete>
  ) : (
    deviceRow
  );
  return section.network ? (
    <NetworkDeviceChildRow isLast={row.isLast}>
      {swipeable}
    </NetworkDeviceChildRow>
  ) : (
    <VStack style={{ paddingHorizontal: MANAGER_CARD_CONTENT_INSET }}>
      {swipeable}
    </VStack>
  );
}

const MemoizedFlattenedListRow = React.memo(FlattenedListRow);

function DropStatus({
  status,
  onRetry,
}: {
  status: DropAssignmentStatus;
  onRetry?: () => void;
}) {
  const theme = useEight2FiveTheme();
  const progress = status.kind === "progress";
  return (
    <HStack
      testID="drop-assignment-status"
      className="items-center justify-between"
      style={{
        gap: eight2FiveSpacing.sm,
        paddingHorizontal: eight2FiveSpacing.md,
        paddingBottom: eight2FiveSpacing.sm,
      }}
    >
      <HStack
        className="flex-1 items-center"
        style={{ gap: eight2FiveSpacing.sm }}
      >
        {progress ? <Spinner color={theme.textMuted} /> : null}
        <Text
          selectable
          size="sm"
          accessibilityRole={progress ? undefined : "alert"}
          accessibilityLiveRegion="polite"
          accessibilityState={{ busy: progress }}
          style={{ color: progress ? theme.textMuted : theme.danger }}
        >
          {status.message}
        </Text>
      </HStack>
      {onRetry ? (
        <Button
          testID="retry-drop-assignment"
          size="sm"
          variant="ghost"
          accessibilityLabel="Retry network assignment"
          accessibilityHint="Retries the same saved network assignment"
          onPress={onRetry}
        >
          <ButtonText style={{ color: theme.text }}>Retry</ButtonText>
        </Button>
      ) : null}
    </HStack>
  );
}

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

function snapshotSections(
  sections: readonly NetworkDeviceSectionModel[],
): NetworkDeviceSectionModel[] {
  return sections.map((section) => ({
    ...section,
    ...(section.network ? { network: { ...section.network } } : {}),
    devices: section.devices.map((device) => ({
      ...device,
      ...(device.savedDevice ? { savedDevice: { ...device.savedDevice } } : {}),
      ...(device.discovery ? { discovery: { ...device.discovery } } : {}),
    })),
  }));
}
