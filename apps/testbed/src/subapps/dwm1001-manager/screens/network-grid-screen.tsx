import React from "react";
import { useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { PansNetworkGrid } from "@eight2five/mobile/pans-manager/PansNetworkGrid";
import type { PansGridNode } from "@eight2five/mobile/pans-manager/PansNetworkGrid";
import {
  boundsForPoints,
  chooseGridInterval,
  DEFAULT_GRID_VIEWPORT,
  fitGridBounds,
} from "@eight2five/mobile/pans-manager/pans-network-grid-math";
import type {
  GridPoint,
  GridViewport,
} from "@eight2five/mobile/pans-manager/pans-network-grid-math";
import type { PansPositionStreamService } from "@eight2five/mobile/pans-manager/PansPositionStreamService";
import { HStack } from "@eight2five/ui/hstack";
import { Text } from "@eight2five/ui/text";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  SelectField,
  StatePanel,
  SwitchField,
} from "../components/manager-ui";
import {
  useManagedNetwork,
  usePansLiveNetwork,
  usePansManager,
} from "../manager-context";
import { displayError } from "../manager-utils";

export function NetworkGridScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const theme = useEight2FiveTheme();
  const live = usePansLiveNetwork();
  const manager = usePansManager();
  const { network, devices } = useManagedNetwork(networkId);
  const { width } = useWindowDimensions();
  const gridWidth = Math.max(280, width - 32);
  const gridHeight = 420;
  const [viewport, setViewport] = React.useState<GridViewport>(
    DEFAULT_GRID_VIEWPORT,
  );
  const [selectedId, setSelectedId] = React.useState<string>();
  const [tagId, setTagId] = React.useState("");
  const [tagPositions, setTagPositions] = React.useState<
    Record<string, GridPoint>
  >({});
  const [showLabels, setShowLabels] = React.useState(true);
  const [showOffline, setShowOffline] = React.useState(true);
  const [editMode, setEditMode] = React.useState(false);
  const [pendingCoordinate, setPendingCoordinate] = React.useState<GridPoint>();
  const [positionMessage, setPositionMessage] = React.useState<string>();
  const [follow, setFollow] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [diagnostic, setDiagnostic] = React.useState<string>();
  const [renderedAt] = React.useState(() => Date.now());
  const stream = React.useRef<PansPositionStreamService | undefined>(undefined);
  const startRequested = React.useRef(false);
  const followRef = React.useRef(follow);
  const selectedIdRef = React.useRef(selectedId);

  React.useEffect(() => {
    followRef.current = follow;
    selectedIdRef.current = selectedId;
  }, [follow, selectedId]);

  React.useEffect(
    () => () => {
      void stream.current?.stop();
    },
    [],
  );

  if (!network)
    return (
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );

  const offline = (lastSeenAt?: number) =>
    !lastSeenAt ||
    renderedAt - lastSeenAt > network.settings.staleDeviceTimeoutMs;
  const anchors: PansGridNode[] = devices
    .filter(
      (device) =>
        device.lastKnownConfig?.role === "anchor" &&
        device.lastKnownConfig.position,
    )
    .filter((device) => showOffline || !offline(device.lastSeenAt))
    .map((device) => {
      const config = device.lastKnownConfig!;
      return {
        id: device.id,
        label: device.nickname || device.label || device.nodeIdHex || device.id,
        role: "anchor" as const,
        position:
          config.role === "anchor"
            ? config.position!
            : { xMeters: 0, yMeters: 0 },
        initiator: config.role === "anchor" && config.initiatorEnabled,
        status: offline(device.lastSeenAt)
          ? ("offline" as const)
          : ("normal" as const),
      };
    });
  const tags: PansGridNode[] = devices
    .filter((device) => device.role === "tag" && tagPositions[device.id])
    .map((device) => ({
      id: device.id,
      label: device.nickname || device.label || device.nodeIdHex || device.id,
      role: "tag" as const,
      position: tagPositions[device.id],
      status:
        diagnostic && device.id === tagId
          ? ("warning" as const)
          : ("normal" as const),
    }));
  const nodes = [...anchors, ...tags];

  const fit = (points: GridPoint[]) =>
    setViewport(
      fitGridBounds(boundsForPoints(points), {
        width: gridWidth,
        height: gridHeight,
      }),
    );
  const start = async () => {
    const device = devices.find((item) => item.id === tagId);
    if (!device || running || startRequested.current) return;
    startRequested.current = true;
    setStarting(true);
    let next: PansPositionStreamService | undefined;
    try {
      setDiagnostic(undefined);
      setSelectedId(device.id);
      selectedIdRef.current = device.id;
      next = live.createPositionStream();
      stream.current = next;
      await next.start({
        deviceId: device.id,
        transportDeviceId: device.transportDeviceId,
        onSample: (sample) => {
          if (!sample.position) return;
          const point = {
            xMeters: sample.position.xMeters,
            yMeters: sample.position.yMeters,
          };
          setTagPositions((current) => ({ ...current, [device.id]: point }));
          if (followRef.current && selectedIdRef.current === device.id)
            setViewport((current) => ({
              ...current,
              centerXMeters: point.xMeters,
              centerYMeters: point.yMeters,
            }));
          if (sample.diagnostics.length)
            setDiagnostic(sample.diagnostics.join("; "));
        },
        onDiagnostic: setDiagnostic,
      });
      setRunning(true);
    } catch (error) {
      await next?.stop();
      if (stream.current === next) stream.current = undefined;
      setDiagnostic(displayError(error));
    } finally {
      startRequested.current = false;
      setStarting(false);
    }
  };
  const stop = async () => {
    await stream.current?.stop();
    stream.current = undefined;
    startRequested.current = false;
    setRunning(false);
  };
  const confirmPosition = async () => {
    const device = devices.find((item) => item.id === selectedId);
    if (
      !device ||
      !pendingCoordinate ||
      device.lastKnownConfig?.role !== "anchor"
    )
      return;
    try {
      setPositionMessage(undefined);
      const current = device.lastKnownConfig;
      const result = await manager.configureDevice(device.id, {
        ...current,
        position: {
          xMeters: pendingCoordinate.xMeters,
          yMeters: pendingCoordinate.yMeters,
          zMeters:
            current.position?.zMeters ??
            network.settings.defaultAnchorHeightMeters,
          quality: current.position?.quality ?? 100,
        },
      });
      if (result.outcome === "failure")
        throw new Error(result.error?.message ?? "Position write failed.");
      setPositionMessage(
        "Position written. The BLE interface cannot read persisted coordinates back, so this result remains explicitly unverified.",
      );
      setPendingCoordinate(undefined);
    } catch (error) {
      setPositionMessage(displayError(error));
    }
  };
  return (
    <ManagerScreen>
      <SectionCard
        title="Position anchors"
        description="Enter measured coordinates or place anchors on the grid. X increases right; Y increases up."
        tone="accent"
      >
        <PansNetworkGrid
          nodes={nodes}
          viewport={viewport}
          onViewportChange={setViewport}
          selectedNodeId={selectedId}
          onSelectNode={setSelectedId}
          showLabels={showLabels}
          editMode={editMode}
          onLongPressCoordinate={(point) => {
            const selected = devices.find((item) => item.id === selectedId);
            if (selected?.lastKnownConfig?.role === "anchor")
              setPendingCoordinate(point);
          }}
          height={gridHeight}
        />
        <Text selectable size="xs" style={{ color: theme.textMuted }}>
          {chooseGridInterval(viewport.metersPerPixel)} m grid interval
        </Text>
        <HStack className="flex-wrap gap-2">
          <ManagerButton
            label="Fit all"
            size="sm"
            onPress={() => fit(nodes.map((node) => node.position))}
          />
          <ManagerButton
            label="Fit anchors"
            size="sm"
            variant="outline"
            onPress={() => fit(anchors.map((node) => node.position))}
          />
          <ManagerButton
            label="Reset"
            size="sm"
            variant="ghost"
            onPress={() => setViewport(DEFAULT_GRID_VIEWPORT)}
          />
        </HStack>
        <SwitchField
          label="Labels"
          value={showLabels}
          onChange={setShowLabels}
        />
        <SwitchField
          label="Show offline anchors"
          value={showOffline}
          onChange={setShowOffline}
        />
        <SwitchField
          label="Follow selected live tag"
          value={follow}
          onChange={setFollow}
        />
        <SwitchField
          label="Edit anchor position"
          description="Select an anchor, enable editing, then long-press its measured coordinate."
          value={editMode}
          onChange={(enabled) => {
            setEditMode(enabled);
            if (!enabled) setPendingCoordinate(undefined);
          }}
          disabled={running}
        />
        {pendingCoordinate ? (
          <SectionCard title="Confirm anchor position" tone="quiet">
            <Text selectable size="sm" style={{ color: theme.text }}>
              Move the selected anchor to X{" "}
              {pendingCoordinate.xMeters.toFixed(3)} m, Y{" "}
              {pendingCoordinate.yMeters.toFixed(3)} m. Existing Z and quality
              values will be retained.
            </Text>
            <ManagerButton
              label="Save anchor position"
              onPress={() => void confirmPosition()}
            />
            <ManagerButton
              label="Cancel"
              variant="ghost"
              onPress={() => setPendingCoordinate(undefined)}
            />
          </SectionCard>
        ) : null}
        {positionMessage ? (
          <StatePanel state="info" message={positionMessage} />
        ) : null}
      </SectionCard>

      <SectionCard
        title="Track tags"
        description="Choose a configured tag to show its live position."
      >
        <SelectField
          label="Tag"
          value={tagId}
          onChange={(value) => {
            if (!running && !starting) setTagId(value);
          }}
          choices={devices
            .filter((device) => device.role === "tag")
            .map((device) => ({
              label: device.nickname || device.label || device.id,
              value: device.id,
            }))}
        />
        {running ? (
          <ManagerButton
            label="Stop tracking"
            variant="outline"
            onPress={() => void stop()}
          />
        ) : (
          <ManagerButton
            label="Start tracking"
            loading={starting}
            isDisabled={!tagId || starting}
            onPress={() => void start()}
          />
        )}
        {diagnostic ? <StatePanel state="info" message={diagnostic} /> : null}
      </SectionCard>
    </ManagerScreen>
  );
}
