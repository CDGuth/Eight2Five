import React from "react";
import {
  selectNetworkDeviceSections,
  type DeviceConfigurationSnapshot,
  type DisplayDevice,
  type NetworkDeviceSection as NetworkDeviceSectionModel,
} from "@eight2five/mobile/pans-manager";
import {
  Button,
  ButtonIcon,
  ButtonText,
} from "@eight2five/ui/components/button";
import { FlatList } from "@eight2five/ui/components/flat-list";
import { HStack } from "@eight2five/ui/components/hstack";
import { SafeAreaView } from "@eight2five/ui/components/safe-area-view";
import { Spinner } from "@eight2five/ui/components/spinner";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveSpacing, useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";
import { RadioTower, Square } from "lucide-react-native";

import {
  findNetworkDropTarget,
  type NetworkDropZone,
} from "../components/network-device-drop";
import type { NetworkDeviceDragEvent } from "../components/network-device-drag";
import { NetworkDeviceSection } from "../components/network-device-section";
import { DeviceSettingsModal } from "../device-settings-modal";
import { usePansManager } from "../manager-context";
import { displayError } from "../manager-utils";
import { NetworkEditModal } from "../network-edit-modal";
import { useTestbedToolbarAction } from "../../../components/testbed-toolbar";

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

type DropAssignmentStatus =
  | { kind: "progress"; message: "Persisting…" | "Assigning…" }
  | {
      kind: "error";
      message: string;
      retry?: DropAssignmentRequest;
    };

export function NetworksDevicesScreen() {
  const theme = useEight2FiveTheme();
  const manager = usePansManager();
  const [selectedNetworkId, setSelectedNetworkId] = React.useState<string>();
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>();
  const liveSections = React.useMemo(
    () =>
      selectNetworkDeviceSections(
        manager.networks,
        manager.devices,
        manager.discoveries,
      ),
    [manager.networks, manager.devices, manager.discoveries],
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
  const snapshotsRef = React.useRef(manager.deviceSnapshots);
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
  const hasDeviceRows = liveSections.some(
    (section) => section.devices.length > 0,
  );
  const emptyMessage =
    manager.initialization === "ready" && !hasDeviceRows
      ? manager.isScanning
        ? "Scanning…"
        : "No devices"
      : undefined;
  React.useEffect(() => {
    liveSectionsRef.current = liveSections;
    snapshotsRef.current = manager.deviceSnapshots;
    expandedSectionsRef.current = expandedSections;
    emptyMessageRef.current = emptyMessage;
  }, [emptyMessage, expandedSections, liveSections, manager.deviceSnapshots]);
  const sections = frozenDisplay?.sections ?? liveSections;
  const displayedSnapshots =
    frozenDisplay?.snapshots ?? manager.deviceSnapshots;
  const displayedEmptyMessage = frozenDisplay
    ? frozenDisplay.emptyMessage
    : emptyMessage;

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
  }, [expandedSections, measureDropZones, sections]);

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
          const persisted = await manager.persistDiscovery(discovery);
          persistedDeviceId = persisted.id;
          stage = "assigning";
          setAssignmentStatus({ kind: "progress", message: "Assigning…" });
        }
        const result = await manager.assignDeviceToNetworkProfile({
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
              : `${displayError(error)} Assignment status could not be confirmed. Hardware PAN or app association may have changed; the saved device record was retained.`,
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
    [finishDrag, manager],
  );
  const handleDragEnd = React.useCallback(
    (event: NetworkDeviceDragEvent) => {
      const activeDrag = activeDragRef.current;
      if (!activeDrag || activeDrag.deviceKey !== event.deviceKey) return;
      if (event.cancelled) {
        finishDrag();
        return;
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
        return;
      }
      setSectionExpanded(`network:${targetNetworkId}`, true);
      clearHover();
      void runDropAssignment({
        device: activeDrag.device,
        targetNetworkId,
      });
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
        (device.discovery
          ? await manager.persistDiscovery(device.discovery)
          : undefined);
      if (!saved) throw new Error("Device discovery is unavailable.");
      setSelectedNetworkId(undefined);
      setSelectedDeviceId(saved.id);
    },
    [manager],
  );

  const selectedDevice = manager.devices.find(
    (device) => device.id === selectedDeviceId,
  );
  const selectedDiscovery = selectedDevice
    ? manager.discoveries.find(
        (discovery) =>
          discovery.transportDeviceId === selectedDevice.transportDeviceId,
      )
    : undefined;
  const scanAction = React.useMemo(
    () =>
      manager.initialization === "initializing" ? (
        <HStack
          accessible
          accessibilityLabel="Native Module Loading"
          accessibilityState={{ busy: true, disabled: true }}
          pointerEvents="none"
          className="min-h-11 items-center"
          style={{ gap: eight2FiveSpacing.sm }}
        >
          <Spinner color={theme.raw.white} />
          <Text style={{ color: theme.raw.white }}>Native Module Loading</Text>
        </HStack>
      ) : manager.initialization === "ready" ? (
        <Button
          testID="scan-control"
          size="sm"
          accessibilityLabel={
            manager.isScanning ? "Stop device scan" : "Start device scan"
          }
          accessibilityState={{ selected: manager.isScanning }}
          onPress={() => {
            if (manager.isScanning) manager.stopDiscovery();
            else void manager.startDiscovery();
          }}
        >
          <ButtonIcon as={manager.isScanning ? Square : RadioTower} />
          <ButtonText>{manager.isScanning ? "Stop" : "Scan"}</ButtonText>
        </Button>
      ) : null,
    [manager, theme.raw.white],
  );
  useTestbedToolbarAction("pans-discovery-scan", scanAction);

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <VStack className="flex-1">
        {manager.initializationError ? (
          <InlineError
            testID="initialization-error"
            message={manager.initializationError}
            onRetry={manager.retryInitialization}
          />
        ) : null}
        {manager.discoveryError ? (
          <InlineError
            testID="discovery-error"
            message={manager.discoveryError}
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
          data={sections}
          keyExtractor={(section) => section.key}
          extraData={`${Array.from(expandedSections)
            .sort()
            .join("|")}::${Array.from(expandedDevices).sort().join("|")}::${
            displayedEmptyMessage ?? ""
          }::${hoveredNetworkId ?? ""}::${activeDragDeviceKey ?? ""}::${
            assignmentStatus?.kind ?? ""
          }`}
          contentContainerStyle={{
            paddingHorizontal: eight2FiveSpacing.md,
            paddingBottom: eight2FiveSpacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!activeDragDeviceKey && !assignmentInFlight}
          scrollEventThrottle={32}
          onScroll={measureDropZones}
          renderItem={({ item }) => (
            <NetworkDeviceSection
              section={item}
              expanded={expandedSections.has(item.key)}
              onExpandedChange={(expanded) =>
                setSectionExpanded(item.key, expanded)
              }
              expandedDeviceKeys={expandedDevices}
              onDeviceExpandedChange={setDeviceExpanded}
              snapshots={displayedSnapshots}
              emptyMessage={
                item.type === "unassigned" ? displayedEmptyMessage : undefined
              }
              onEditNetwork={(networkId) => {
                setSelectedDeviceId(undefined);
                setSelectedNetworkId(networkId);
              }}
              onOpenDeviceSettings={openDeviceSettings}
              onRefreshDevice={manager.inspectDevice}
              dragEnabled={!assignmentInFlight}
              activeDragDeviceKey={activeDragDeviceKey}
              interactionsDisabled={
                activeDragDeviceKey !== undefined || assignmentInFlight
              }
              dragCallbacks={dragCallbacks}
              hoveredNetworkId={hoveredNetworkId}
              onRegisterDropZone={registerDropZone}
              onDropZoneChange={updateDropZone}
            />
          )}
        />
        <NetworkEditModal
          network={manager.networks.find(
            (network) => network.id === selectedNetworkId,
          )}
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
