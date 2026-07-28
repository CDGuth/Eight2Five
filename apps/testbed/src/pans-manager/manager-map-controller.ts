import React from "react";
import {
  boundsForPoints,
  DEFAULT_GRID_VIEWPORT,
  DEFAULT_MANAGED_NETWORK_SETTINGS,
  fitGridBounds,
  getDeviceDisplayName,
  normalizeGridViewport,
  type GridBounds,
  type GridPoint,
  type GridSize,
  type GridViewport,
  type MapAreaMode,
  type MapUnits,
  type ManagedDevice,
  type ManagedNetwork,
  type ObservedPansTopology,
  type PansDistance,
  type PansGridCameraSharedValues,
  type PansGridNode,
  type PansGridObservedEdge,
  type PansPositionStreamCounters,
  type PansPositionStreamSample,
} from "@eight2five/mobile/pans-manager";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { useManagedDevices, useManagedNetworks } from "./manager-context";
import { useRepositoryNetworkActions } from "./actions/repository-network-actions";
import { useDeviceConfigurationActions } from "./actions/device-configuration-actions";
import { usePositionLogActions } from "./actions/position-log-actions";
import { displayError } from "./manager-utils";

export interface PansMapVisibilityOptions {
  anchors: boolean;
  tags: boolean;
  initiators: boolean;
  offline: boolean;
  labels: boolean;
  panMismatchIndicators: boolean;
  rangingLines: boolean;
}

export interface PansMapGridOptions {
  showGrid: boolean;
  fixedIntervalMeters?: number;
  showOrigin: boolean;
}

export interface LastKnownTagPosition {
  position: GridPoint;
  receivedAt: number;
}

export interface PendingAnchorEdit {
  anchorId: string;
  coordinate: GridPoint;
  zMeters: number;
  quality: number;
}

export interface PansMapPipelineCounters extends PansPositionStreamCounters {
  mapPositionUpdates: number;
}

export type PansMapTrackingStatus =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "error";

export interface PansMapDataController {
  networks: ManagedNetwork[];
  devices: ManagedDevice[];
  selectedNetworkIds: Set<string>;
  selectAllNetworks(): void;
  clearAllNetworks(): void;
  setNetworkVisible(networkId: string, visible: boolean): void;
  visibility: PansMapVisibilityOptions;
  setVisibility<K extends keyof PansMapVisibilityOptions>(
    key: K,
    value: PansMapVisibilityOptions[K],
  ): void;
  grid: PansMapGridOptions;
  setGrid(options: Partial<PansMapGridOptions>): void;
  mapUnits: MapUnits;
  mapAreaMode: MapAreaMode;
  selectedAreaBounds: GridBounds[];
  setMapUnits(units: MapUnits): Promise<void>;
  setMapAreaMode(mode: MapAreaMode): Promise<void>;
  gridSize: GridSize;
  setGridSize(size: GridSize): void;
  viewport: GridViewport;
  camera: PansGridCameraSharedValues;
  setViewport(viewport: GridViewport): void;
  fitVisible(): void;
  fitAnchors(): void;
  resetCamera(): void;
  nodes: PansGridNode[];
  anchors: PansGridNode[];
  rangingEdges: PansGridObservedEdge[];
  topologyCache: Readonly<Record<string, ObservedPansTopology>>;
  refreshNetworkTopology(networkId: string): Promise<void>;
  selectedNodeId?: string;
  setSelectedNodeId(nodeId: string | undefined): void;
  selectedAnchorId?: string;
  setSelectedAnchorId(anchorId: string | undefined): void;
  editableAnchors: ManagedDevice[];
  editingEnabled: boolean;
  setEditingEnabled(enabled: boolean): void;
  pendingAnchorEdit?: PendingAnchorEdit;
  setPendingAnchorCoordinate(point: GridPoint): void;
  cancelPendingAnchorEdit(): void;
  savePendingAnchorEdit(zMeters: number, quality?: number): Promise<void>;
  editResult?: string;
  trackingStatus: PansMapTrackingStatus;
  trackingSource: "none" | "direct-ble";
  trackingDiagnostic?: string;
  trackingCounters?: PansMapPipelineCounters;
  setTrackingDiagnosticsVisible(visible: boolean): void;
  selectedDirectTagId: string;
  setSelectedDirectTagId(deviceId: string): void;
  trackableTags: ManagedDevice[];
  follow: boolean;
  setFollow(value: boolean): void;
  retainLastKnown: boolean;
  setRetainLastKnown(value: boolean): void;
  lastKnownTagPositions: Readonly<Record<string, LastKnownTagPosition>>;
  clearLastKnown(): void;
  startDirectTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  proxyStatus: "unavailable";
  proxyMessage: string;
}

const DEFAULT_VISIBILITY: PansMapVisibilityOptions = {
  anchors: true,
  tags: true,
  initiators: true,
  offline: true,
  labels: true,
  panMismatchIndicators: true,
  rangingLines: true,
};

const DEFAULT_GRID: PansMapGridOptions = {
  showGrid: true,
  showOrigin: true,
};

export function usePansMapDataController(
  initialNetworkId?: string,
): PansMapDataController {
  const networks = useManagedNetworks();
  const devices = useManagedDevices();
  const { updateNetworkMapSettings } = useRepositoryNetworkActions();
  const { applyConfiguration: applyDeviceConfiguration } =
    useDeviceConfigurationActions();
  const { createPositionStream, refreshTopology } = usePositionLogActions();
  const [selectedNetworkIds, setSelectedNetworkIds] = React.useState(
    () => new Set<string>(),
  );
  const initializedSelection = React.useRef(false);
  const [visibility, setVisibilityState] = React.useState(DEFAULT_VISIBILITY);
  const [grid, setGridState] = React.useState(DEFAULT_GRID);
  const [gridSize, setGridSize] = React.useState<GridSize>({
    width: 0,
    height: 0,
  });
  const [viewport, setViewportState] = React.useState(DEFAULT_GRID_VIEWPORT);
  const centerX = useSharedValue(DEFAULT_GRID_VIEWPORT.centerXMeters);
  const centerY = useSharedValue(DEFAULT_GRID_VIEWPORT.centerYMeters);
  const metersPerPixel = useSharedValue(DEFAULT_GRID_VIEWPORT.metersPerPixel);
  const liveTagPosition = useSharedValue<GridPoint>({
    xMeters: 0,
    yMeters: 0,
  });
  const camera = React.useMemo(
    () => ({ centerX, centerY, metersPerPixel }),
    [centerX, centerY, metersPerPixel],
  );
  const [selectedNodeId, setSelectedNodeId] = React.useState<string>();
  const [selectedAnchorId, setSelectedAnchorId] = React.useState<string>();
  const [editingEnabled, setEditingEnabledState] = React.useState(false);
  const [pendingAnchorEdit, setPendingAnchorEdit] =
    React.useState<PendingAnchorEdit>();
  const [editResult, setEditResult] = React.useState<string>();
  const [trackingStatus, setTrackingStatus] =
    React.useState<PansMapTrackingStatus>("stopped");
  const [trackingDiagnostic, setTrackingDiagnostic] = React.useState<string>();
  const [trackingCounters, setTrackingCounters] =
    React.useState<PansMapPipelineCounters>();
  const trackingCountersRef = React.useRef<PansMapPipelineCounters | undefined>(
    undefined,
  );
  const mapPositionUpdatesRef = React.useRef(0);
  const trackingDiagnosticsVisibleRef = React.useRef(false);
  const trackingDiagnosticRef = React.useRef<string | undefined>(undefined);
  const [selectedDirectTagId, setSelectedDirectTagIdState] = React.useState("");
  const [activeTagId, setActiveTagId] = React.useState<string>();
  const [activeSampleTagId, setActiveSampleTagId] = React.useState<string>();
  const activeSampleTagIdRef = React.useRef<string | undefined>(undefined);
  const [follow, setFollowState] = React.useState(false);
  const followRef = React.useRef(false);
  const [retainLastKnown, setRetainLastKnownState] = React.useState(true);
  const retainLastKnownRef = React.useRef(true);
  const lastKnownRef = React.useRef<Record<string, LastKnownTagPosition>>({});
  const [lastKnownTagPositions, setLastKnownTagPositions] = React.useState<
    Record<string, LastKnownTagPosition>
  >({});
  const [rangingEdges, setRangingEdges] = React.useState<
    PansGridObservedEdge[]
  >([]);
  const rangingEdgeKeyRef = React.useRef("");
  const [topologyCache, setTopologyCache] = React.useState<
    Record<string, ObservedPansTopology>
  >({});
  const streamRef = React.useRef<
    ReturnType<typeof createPositionStream> | undefined
  >(undefined);
  const startRequestedRef = React.useRef(false);
  const stopPromiseRef = React.useRef<Promise<void> | undefined>(undefined);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    if (initializedSelection.current || networks.length === 0) return;
    initializedSelection.current = true;
    const validInitial = networks.some(
      (network) => network.id === initialNetworkId,
    )
      ? initialNetworkId
      : undefined;
    setSelectedNetworkIds(
      new Set(
        validInitial
          ? [validInitial]
          : initialNetworkId
            ? []
            : networks.map((network) => network.id),
      ),
    );
  }, [initialNetworkId, networks]);

  React.useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  React.useEffect(() => {
    retainLastKnownRef.current = retainLastKnown;
  }, [retainLastKnown]);

  React.useEffect(
    () => () => {
      mountedRef.current = false;
      startRequestedRef.current = false;
      const stream = streamRef.current;
      streamRef.current = undefined;
      void stream?.stop();
    },
    [],
  );

  const selectedNetworks = React.useMemo(
    () => networks.filter((network) => selectedNetworkIds.has(network.id)),
    [networks, selectedNetworkIds],
  );
  const mapUnits =
    selectedNetworks[0]?.settings.mapUnits ??
    DEFAULT_MANAGED_NETWORK_SETTINGS.mapUnits;
  const mapAreaMode =
    selectedNetworks.length > 0 &&
    selectedNetworks.every(
      (network) => network.settings.mapAreaMode === "bounded",
    )
      ? "bounded"
      : "infinite";
  const selectedAreaBounds = React.useMemo(
    () =>
      selectedNetworks
        .filter((network) => network.settings.mapAreaMode === "bounded")
        .map((network) => ({
          minXMeters: network.settings.coordinateBounds.minXMeters,
          maxXMeters: network.settings.coordinateBounds.maxXMeters,
          minYMeters: network.settings.coordinateBounds.minYMeters,
          maxYMeters: network.settings.coordinateBounds.maxYMeters,
        })),
    [selectedNetworks],
  );
  const anchors = React.useMemo(
    () =>
      visibility.anchors
        ? buildVisibleAnchorNodes({
            networks: selectedNetworks,
            devices,
            visibility,
          })
        : [],
    [devices, selectedNetworks, visibility],
  );
  const trackableTags = React.useMemo(
    () =>
      devices
        .filter(
          (device) =>
            Boolean(device.networkId) &&
            selectedNetworkIds.has(device.networkId!) &&
            (device.lastKnownConfig?.role === "tag" || device.role === "tag"),
        )
        .sort((left, right) =>
          getDeviceDisplayName(left).localeCompare(getDeviceDisplayName(right)),
        ),
    [devices, selectedNetworkIds],
  );
  const tagNodes = React.useMemo(
    () =>
      visibility.tags
        ? buildVisibleTagNodes({
            networks: selectedNetworks,
            devices,
            cache: lastKnownTagPositions,
            visibility,
            activeTagId,
            activeSampleTagId,
            livePosition: liveTagPosition,
          })
        : [],
    [
      activeSampleTagId,
      activeTagId,
      devices,
      lastKnownTagPositions,
      liveTagPosition,
      selectedNetworks,
      visibility,
    ],
  );
  const nodes = React.useMemo(
    () => [...anchors, ...tagNodes],
    [anchors, tagNodes],
  );

  const setViewport = React.useCallback(
    (nextViewport: GridViewport) => {
      const next = normalizeGridViewport(nextViewport);
      centerX.set(next.centerXMeters);
      centerY.set(next.centerYMeters);
      metersPerPixel.set(next.metersPerPixel);
      setViewportState(next);
    },
    [centerX, centerY, metersPerPixel],
  );

  const fitNodes = React.useCallback(
    (items: PansGridNode[]) => {
      const points = items.map((node) =>
        node.livePosition ? node.livePosition.value : node.position,
      );
      setViewport(fitGridBounds(boundsForPoints(points), gridSize));
    },
    [gridSize, setViewport],
  );

  const setTrackingDiagnosticsVisible = React.useCallback(
    (visible: boolean) => {
      trackingDiagnosticsVisibleRef.current = visible;
      if (visible && mountedRef.current) {
        const counters = trackingCountersRef.current;
        setTrackingCounters(counters ? { ...counters } : undefined);
      }
    },
    [],
  );

  const stopTracking = React.useCallback(async () => {
    if (stopPromiseRef.current) return await stopPromiseRef.current;
    const operation = (async () => {
      const stream = streamRef.current;
      if (!stream && !startRequestedRef.current) {
        if (mountedRef.current) setTrackingStatus("stopped");
        return;
      }
      startRequestedRef.current = false;
      if (mountedRef.current) setTrackingStatus("stopping");
      await stream?.stop().catch((error) => {
        if (mountedRef.current) setTrackingDiagnostic(displayError(error));
      });
      if (streamRef.current === stream) streamRef.current = undefined;
      if (!retainLastKnownRef.current && activeSampleTagIdRef.current) {
        lastKnownRef.current = removeCachedTagPosition(
          lastKnownRef.current,
          activeSampleTagIdRef.current,
        );
      }
      activeSampleTagIdRef.current = undefined;
      if (mountedRef.current) {
        setActiveTagId(undefined);
        setActiveSampleTagId(undefined);
        setRangingEdges([]);
        rangingEdgeKeyRef.current = "";
        setLastKnownTagPositions(lastKnownRef.current);
        setTrackingStatus("stopped");
      }
    })();
    stopPromiseRef.current = operation;
    try {
      await operation;
    } finally {
      if (stopPromiseRef.current === operation)
        stopPromiseRef.current = undefined;
    }
  }, []);

  const startDirectTracking = React.useCallback(async () => {
    if (
      editingEnabled ||
      !selectedDirectTagId ||
      startRequestedRef.current ||
      trackingStatus === "running" ||
      trackingStatus === "starting" ||
      trackingStatus === "stopping"
    ) {
      if (editingEnabled)
        setTrackingDiagnostic("Disable anchor editing before tracking.");
      return;
    }
    const device = devices.find((item) => item.id === selectedDirectTagId);
    if (!device) {
      setTrackingDiagnostic("Select a saved tag for direct BLE tracking.");
      return;
    }
    startRequestedRef.current = true;
    setTrackingStatus("starting");
    setTrackingDiagnostic(undefined);
    trackingCountersRef.current = undefined;
    mapPositionUpdatesRef.current = 0;
    if (trackingDiagnosticsVisibleRef.current) setTrackingCounters(undefined);
    trackingDiagnosticRef.current = undefined;
    setActiveTagId(device.id);
    setSelectedNodeId(device.id);
    let stream: ReturnType<typeof createPositionStream> | undefined;
    try {
      stream = createPositionStream();
      streamRef.current = stream;
      await stream.start({
        deviceId: device.id,
        transportDeviceId: device.transportDeviceId,
        onSample: (sample) => {
          if (streamRef.current !== stream) return;
          acceptDirectSample({
            sample,
            device,
            visibleAnchors: anchors,
            liveTagPosition,
            lastKnownRef,
            onFirstPosition: () => {
              activeSampleTagIdRef.current = device.id;
              setActiveSampleTagId(device.id);
              setLastKnownTagPositions(lastKnownRef.current);
            },
            hasLiveSample: () => activeSampleTagIdRef.current === device.id,
            onEdges: (nextEdges) => {
              const key = nextEdges
                .map((edge) => `${edge.sourceId}:${edge.targetId}`)
                .sort()
                .join("|");
              if (key === rangingEdgeKeyRef.current) return;
              rangingEdgeKeyRef.current = key;
              setRangingEdges(nextEdges);
            },
            onInitialDiagnostic: (message) =>
              setInitialTrackingDiagnostic(
                trackingDiagnosticRef,
                setTrackingDiagnostic,
                message,
              ),
            follow: followRef,
            camera,
          });
          if (sample.position) {
            mapPositionUpdatesRef.current += 1;
            if (trackingCountersRef.current) {
              trackingCountersRef.current = {
                ...trackingCountersRef.current,
                mapPositionUpdates: mapPositionUpdatesRef.current,
              };
            }
          }
        },
        onCounters: (counters) => {
          if (streamRef.current !== stream) return;
          const snapshot = {
            ...counters,
            mapPositionUpdates: mapPositionUpdatesRef.current,
          };
          trackingCountersRef.current = snapshot;
          if (mountedRef.current && trackingDiagnosticsVisibleRef.current) {
            setTrackingCounters(snapshot);
          }
        },
        onDiagnostic: (message) => {
          if (streamRef.current === stream) {
            trackingDiagnosticRef.current = message;
            setTrackingDiagnostic(message);
          }
        },
      });
      if (streamRef.current === stream && mountedRef.current)
        setTrackingStatus("running");
    } catch (error) {
      if (streamRef.current === stream) streamRef.current = undefined;
      await stream?.stop().catch(() => undefined);
      if (mountedRef.current) {
        setActiveTagId(undefined);
        setTrackingDiagnostic(displayError(error));
        setTrackingStatus("error");
      }
    } finally {
      startRequestedRef.current = false;
    }
  }, [
    anchors,
    camera,
    devices,
    editingEnabled,
    liveTagPosition,
    createPositionStream,
    selectedDirectTagId,
    trackingStatus,
  ]);

  const setEditingEnabled = React.useCallback(
    (enabled: boolean) => {
      if (enabled && trackingStatus !== "stopped" && trackingStatus !== "error")
        return;
      setEditingEnabledState(enabled);
      if (!enabled) setPendingAnchorEdit(undefined);
    },
    [trackingStatus],
  );

  const editableAnchors = React.useMemo(
    () =>
      devices
        .filter(
          (device) =>
            Boolean(device.networkId) &&
            selectedNetworkIds.has(device.networkId!) &&
            (device.lastKnownConfig?.role === "anchor" ||
              device.role === "anchor"),
        )
        .sort((left, right) =>
          getDeviceDisplayName(left).localeCompare(getDeviceDisplayName(right)),
        ),
    [devices, selectedNetworkIds],
  );

  const setPendingAnchorCoordinate = React.useCallback(
    (coordinate: GridPoint) => {
      if (!editingEnabled || !selectedAnchorId) return;
      const device = editableAnchors.find(
        (anchor) => anchor.id === selectedAnchorId,
      );
      if (!device) return;
      const network = networks.find((item) => item.id === device.networkId);
      const existing =
        device.lastKnownConfig?.role === "anchor"
          ? device.lastKnownConfig.position
          : undefined;
      setPendingAnchorEdit({
        anchorId: device.id,
        coordinate,
        zMeters:
          existing?.zMeters ?? network?.settings.defaultAnchorHeightMeters ?? 0,
        quality: existing?.quality ?? 100,
      });
      setEditResult(undefined);
    },
    [editableAnchors, editingEnabled, networks, selectedAnchorId],
  );

  const savePendingAnchorEdit = React.useCallback(
    async (zMeters: number, quality = 100) => {
      if (
        !pendingAnchorEdit ||
        trackingStatus === "running" ||
        trackingStatus === "starting" ||
        trackingStatus === "stopping" ||
        !Number.isFinite(zMeters) ||
        !Number.isInteger(quality) ||
        quality < 1 ||
        quality > 100
      )
        return setEditResult(
          "Enter a finite Z coordinate and an optional integer quality from 1 to 100.",
        );
      try {
        const result = await applyDeviceConfiguration(
          pendingAnchorEdit.anchorId,
          {
            position: {
              xMeters: pendingAnchorEdit.coordinate.xMeters,
              yMeters: pendingAnchorEdit.coordinate.yMeters,
              zMeters,
              quality,
            },
          },
        );
        if (result.outcome === "failure")
          throw new Error(result.error?.message ?? "Position write failed.");
        setEditResult(
          "Position written. The BLE interface cannot read persisted coordinates back, so this write remains unverified.",
        );
        setPendingAnchorEdit(undefined);
      } catch (error) {
        setEditResult(displayError(error));
      }
    },
    [applyDeviceConfiguration, pendingAnchorEdit, trackingStatus],
  );

  const setFollow = React.useCallback((value: boolean) => {
    followRef.current = value;
    setFollowState(value);
  }, []);

  const setRetainLastKnown = React.useCallback((value: boolean) => {
    retainLastKnownRef.current = value;
    setRetainLastKnownState(value);
  }, []);

  const clearLastKnown = React.useCallback(() => {
    lastKnownRef.current = retainOnlyLiveTag(
      lastKnownRef.current,
      activeSampleTagIdRef.current,
    );
    setLastKnownTagPositions(lastKnownRef.current);
  }, []);

  const updateSelectedNetworkMapSetting = React.useCallback(
    async (
      setting: "mapUnits" | "mapAreaMode",
      value: MapUnits | MapAreaMode,
    ) => {
      await updateNetworkMapSettings(
        selectedNetworks.map((network) => network.id),
        { [setting]: value },
      );
    },
    [selectedNetworks, updateNetworkMapSettings],
  );
  const selectAllNetworks = React.useCallback(
    () => setSelectedNetworkIds(new Set(networks.map((network) => network.id))),
    [networks],
  );
  const clearAllNetworks = React.useCallback(
    () => setSelectedNetworkIds(new Set()),
    [],
  );
  const setNetworkVisible = React.useCallback(
    (networkId: string, visible: boolean) =>
      setSelectedNetworkIds((current) => {
        const next = new Set(current);
        if (visible) next.add(networkId);
        else next.delete(networkId);
        return next;
      }),
    [],
  );
  const setVisibility = React.useCallback(
    <K extends keyof PansMapVisibilityOptions>(
      key: K,
      value: PansMapVisibilityOptions[K],
    ) => setVisibilityState((current) => ({ ...current, [key]: value })),
    [],
  );
  const setGrid = React.useCallback(
    (options: Partial<PansMapGridOptions>) =>
      setGridState((current) => ({ ...current, ...options })),
    [],
  );
  const fitVisible = React.useCallback(
    () => fitNodes(nodes),
    [fitNodes, nodes],
  );
  const fitAnchors = React.useCallback(
    () => fitNodes(anchors),
    [anchors, fitNodes],
  );
  const resetCamera = React.useCallback(
    () => setViewport(DEFAULT_GRID_VIEWPORT),
    [setViewport],
  );
  const refreshNetworkTopology = React.useCallback(
    async (networkId: string) => {
      if (
        trackingStatus === "running" ||
        trackingStatus === "starting" ||
        trackingStatus === "stopping"
      )
        return;
      const topology = await refreshTopology(networkId);
      setTopologyCache((current) => ({ ...current, [networkId]: topology }));
    },
    [refreshTopology, trackingStatus],
  );
  const selectAnchor = React.useCallback((anchorId: string | undefined) => {
    setSelectedAnchorId(anchorId);
    if (anchorId) setSelectedNodeId(anchorId);
  }, []);
  const cancelPendingAnchorEdit = React.useCallback(
    () => setPendingAnchorEdit(undefined),
    [],
  );
  const setMapUnits = React.useCallback(
    async (units: MapUnits) =>
      await updateSelectedNetworkMapSetting("mapUnits", units),
    [updateSelectedNetworkMapSetting],
  );
  const setMapAreaMode = React.useCallback(
    async (mode: MapAreaMode) =>
      await updateSelectedNetworkMapSetting("mapAreaMode", mode),
    [updateSelectedNetworkMapSetting],
  );
  const setSelectedDirectTagId = React.useCallback(
    (deviceId: string) => {
      if (trackingStatus === "stopped" || trackingStatus === "error")
        setSelectedDirectTagIdState(deviceId);
    },
    [trackingStatus],
  );

  return {
    networks,
    devices,
    selectedNetworkIds,
    selectAllNetworks,
    clearAllNetworks,
    setNetworkVisible,
    visibility,
    setVisibility,
    grid,
    setGrid,
    mapUnits,
    mapAreaMode,
    selectedAreaBounds,
    setMapUnits,
    setMapAreaMode,
    gridSize,
    setGridSize,
    viewport,
    camera,
    setViewport,
    fitVisible,
    fitAnchors,
    resetCamera,
    nodes,
    anchors,
    rangingEdges: visibility.rangingLines ? rangingEdges : [],
    topologyCache,
    refreshNetworkTopology,
    selectedNodeId,
    setSelectedNodeId,
    selectedAnchorId,
    setSelectedAnchorId: selectAnchor,
    editableAnchors,
    editingEnabled,
    setEditingEnabled,
    pendingAnchorEdit,
    setPendingAnchorCoordinate,
    cancelPendingAnchorEdit,
    savePendingAnchorEdit,
    editResult,
    trackingStatus,
    trackingSource:
      trackingStatus === "running" || trackingStatus === "starting"
        ? "direct-ble"
        : "none",
    trackingDiagnostic,
    trackingCounters,
    setTrackingDiagnosticsVisible,
    selectedDirectTagId,
    setSelectedDirectTagId,
    trackableTags,
    follow,
    setFollow,
    retainLastKnown,
    setRetainLastKnown,
    lastKnownTagPositions,
    clearLastKnown,
    startDirectTracking,
    stopTracking,
    proxyStatus: "unavailable",
    proxyMessage:
      "Proxy tracking is unavailable in this build. Only one direct BLE tag stream is supported.",
  };
}

export function buildVisibleAnchorNodes(options: {
  networks: ManagedNetwork[];
  devices: ManagedDevice[];
  visibility: PansMapVisibilityOptions;
  now?: number;
}): PansGridNode[] {
  const { networks, devices, visibility, now = Date.now() } = options;
  const networkById = new Map(networks.map((network) => [network.id, network]));
  return devices.flatMap((device) => {
    const network = device.networkId
      ? networkById.get(device.networkId)
      : undefined;
    const config = device.lastKnownConfig;
    if (
      !network ||
      config?.role !== "anchor" ||
      !isFiniteAnchorPosition(config.position)
    )
      return [];
    const offline = isDeviceOffline(device, network, now);
    if (offline && !visibility.offline) return [];
    const panMismatch =
      typeof config.panId === "number" && config.panId !== network.panId;
    return [
      {
        id: device.id,
        ...(device.nodeIdHex ? { nodeIdHex: device.nodeIdHex } : {}),
        label: getDeviceDisplayName(device),
        role: "anchor" as const,
        position: {
          xMeters: config.position.xMeters,
          yMeters: config.position.yMeters,
        },
        initiator: visibility.initiators && config.initiatorEnabled,
        panMismatch: visibility.panMismatchIndicators && panMismatch,
        status: offline ? ("offline" as const) : ("normal" as const),
      },
    ];
  });
}

export function buildVisibleTagNodes(options: {
  networks: ManagedNetwork[];
  devices: ManagedDevice[];
  cache: Readonly<Record<string, LastKnownTagPosition>>;
  visibility: PansMapVisibilityOptions;
  activeTagId?: string;
  activeSampleTagId?: string;
  livePosition?: SharedValue<GridPoint>;
  now?: number;
}): PansGridNode[] {
  const {
    networks,
    devices,
    cache,
    visibility,
    activeTagId,
    activeSampleTagId,
    livePosition,
    now = Date.now(),
  } = options;
  const networkById = new Map(networks.map((network) => [network.id, network]));
  return devices.flatMap((device) => {
    const network = device.networkId
      ? networkById.get(device.networkId)
      : undefined;
    const cached = cache[device.id];
    if (
      !network ||
      !cached ||
      (device.lastKnownConfig?.role !== "tag" && device.role !== "tag")
    )
      return [];
    const isLive =
      device.id === activeTagId &&
      device.id === activeSampleTagId &&
      Boolean(livePosition);
    const offline =
      !isLive &&
      now - cached.receivedAt > network.settings.staleDeviceTimeoutMs;
    if (offline && !visibility.offline) return [];
    const config = device.lastKnownConfig;
    const panMismatch =
      typeof config?.panId === "number" && config.panId !== network.panId;
    return [
      {
        id: device.id,
        ...(device.nodeIdHex ? { nodeIdHex: device.nodeIdHex } : {}),
        label: getDeviceDisplayName(device),
        role: "tag" as const,
        position: cached.position,
        ...(isLive ? { livePosition } : {}),
        panMismatch: visibility.panMismatchIndicators && panMismatch,
        status: offline ? ("offline" as const) : ("normal" as const),
      },
    ];
  });
}

export function resolveRangingEdges(
  tagId: string,
  distances: readonly PansDistance[],
  visibleAnchors: readonly PansGridNode[],
): PansGridObservedEdge[] {
  const anchorsByNodeId = new Map<string, PansGridNode>();
  for (const anchor of visibleAnchors) {
    const nodeId = anchor.nodeIdHex;
    if (nodeId) anchorsByNodeId.set(normalizeNodeId(nodeId), anchor);
  }
  // Grid nodes intentionally use managed IDs; callers may attach a source node ID
  // privately while resolving actual ranging frames.
  const targets = new Set<string>();
  return distances.flatMap((distance) => {
    if (
      !Number.isFinite(distance.distanceMeters) ||
      distance.distanceMeters < 0
    )
      return [];
    const anchor =
      anchorsByNodeId.get(normalizeNodeId(distance.anchorKey)) ??
      anchorsByNodeId.get(normalizeNodeId(distance.nodeId.toString(16)));
    if (!anchor || targets.has(anchor.id)) return [];
    targets.add(anchor.id);
    return [
      {
        sourceId: tagId,
        targetId: anchor.id,
        distanceMeters: distance.distanceMeters,
        quality: distance.quality,
      },
    ];
  });
}

export function cacheTagPosition(
  cache: Readonly<Record<string, LastKnownTagPosition>>,
  tagId: string,
  position: GridPoint,
  receivedAt: number,
): Record<string, LastKnownTagPosition> {
  return {
    ...cache,
    [tagId]: { position: { ...position }, receivedAt },
  };
}

export function removeCachedTagPosition(
  cache: Readonly<Record<string, LastKnownTagPosition>>,
  tagId: string,
): Record<string, LastKnownTagPosition> {
  const next = { ...cache };
  delete next[tagId];
  return next;
}

export function retainOnlyLiveTag(
  cache: Readonly<Record<string, LastKnownTagPosition>>,
  liveTagId?: string,
): Record<string, LastKnownTagPosition> {
  return liveTagId && cache[liveTagId] ? { [liveTagId]: cache[liveTagId] } : {};
}

function acceptDirectSample(options: {
  sample: PansPositionStreamSample;
  device: ManagedDevice;
  visibleAnchors: PansGridNode[];
  liveTagPosition: SharedValue<GridPoint>;
  lastKnownRef: React.MutableRefObject<Record<string, LastKnownTagPosition>>;
  onFirstPosition(): void;
  hasLiveSample(): boolean;
  onEdges(edges: PansGridObservedEdge[]): void;
  onInitialDiagnostic(message: string): void;
  follow: React.MutableRefObject<boolean>;
  camera: PansGridCameraSharedValues;
}) {
  const { sample, device } = options;
  if (sample.position) {
    const position = {
      xMeters: sample.position.xMeters,
      yMeters: sample.position.yMeters,
    };
    options.liveTagPosition.set(position);
    options.lastKnownRef.current = cacheTagPosition(
      options.lastKnownRef.current,
      device.id,
      position,
      sample.receivedAt,
    );
    if (!options.hasLiveSample()) options.onFirstPosition();
    if (options.follow.current) {
      options.camera.centerX.set(position.xMeters);
      options.camera.centerY.set(position.yMeters);
    }
  }
  options.onEdges(
    resolveRangingEdges(device.id, sample.distances, options.visibleAnchors),
  );
  const toleratedExtensionMessages = new Set(
    sample.decoderDiagnostics
      .filter((diagnostic) => diagnostic.code === "TRAILING_BYTES")
      .map((diagnostic) => diagnostic.message),
  );
  const actionableDiagnostics = sample.diagnostics.filter(
    (message) => !toleratedExtensionMessages.has(message),
  );
  if (actionableDiagnostics.length)
    options.onInitialDiagnostic(actionableDiagnostics.join("; "));
}

function isFiniteAnchorPosition(
  position:
    | { xMeters: number; yMeters: number; zMeters: number; quality: number }
    | undefined,
): position is {
  xMeters: number;
  yMeters: number;
  zMeters: number;
  quality: number;
} {
  return Boolean(
    position &&
    Number.isFinite(position.xMeters) &&
    Number.isFinite(position.yMeters) &&
    Number.isFinite(position.zMeters) &&
    Number.isFinite(position.quality),
  );
}

function isDeviceOffline(
  device: ManagedDevice,
  network: ManagedNetwork,
  now: number,
): boolean {
  return (
    !device.lastSeenAt ||
    now - device.lastSeenAt > network.settings.staleDeviceTimeoutMs
  );
}

function normalizeNodeId(value: string): string {
  return value.trim().replace(/^0x/i, "").toUpperCase().padStart(4, "0");
}

function setInitialTrackingDiagnostic(
  diagnosticRef: React.MutableRefObject<string | undefined>,
  setDiagnostic: React.Dispatch<React.SetStateAction<string | undefined>>,
  message: string,
) {
  if (diagnosticRef.current) return;
  diagnosticRef.current = message;
  setDiagnostic(message);
}
