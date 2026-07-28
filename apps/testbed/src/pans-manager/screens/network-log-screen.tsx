import React from "react";
import { FlatList, Platform, type ListRenderItemInfo } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  formatMapDistance,
  getDeviceDisplayName,
  type PansPositionStreamService,
  type PositionLogSample,
  type PositionLogSession,
  type PositionLogIngestionCounters,
} from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveRadii, useEight2FiveTheme } from "@eight2five/ui/theme";

import {
  ManagerButton,
  SectionCard,
  SelectField,
  StatePanel,
  TextField,
} from "../components/manager-ui";
import {
  EXPORT_FORMAT_CHOICES,
  type ExportFormat,
} from "../settings-definitions";
import { useManagedNetwork, usePansLiveNetwork } from "../manager-context";
import { displayError } from "../manager-utils";
import { usePositionLogActions } from "../actions/position-log-actions";

const RECENT_SAMPLE_CAP = 50;
const UI_PUBLISH_INTERVAL_MS = 250;

const RecentSampleRow = React.memo(function RecentSampleRow({
  sample,
  units,
  color,
}: {
  sample: PositionLogSample;
  units: Parameters<typeof formatMapDistance>[1];
  color: string;
}) {
  return (
    <Text
      selectable
      size="xs"
      style={{ color, fontFamily: "monospace", paddingVertical: 6 }}
    >
      {sample.sequence}: X {formatMapDistance(sample.xMeters, units)}, Y{" "}
      {formatMapDistance(sample.yMeters, units)}, Z{" "}
      {formatMapDistance(sample.zMeters, units)} · anchors {sample.anchorCount}
      {sample.eventMarker ? ` · ${sample.eventMarker}` : ""}
    </Text>
  );
});

export function NetworkLogScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const theme = useEight2FiveTheme();
  const { network, devices } = useManagedNetwork(networkId);
  const {
    startLog,
    ingestSample,
    getCounters,
    stopLog,
    listLogs,
    listSamples,
    exportLog,
  } = usePositionLogActions();
  const live = usePansLiveNetwork();
  const [tagId, setTagId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [marker, setMarker] = React.useState("");
  const markerRef = React.useRef("");
  const [running, setRunning] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [sessions, setSessions] = React.useState<PositionLogSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState("");
  const [recent, setRecent] = React.useState<PositionLogSample[]>([]);
  const [counters, setCounters] =
    React.useState<PositionLogIngestionCounters>();
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("csv");
  const [exportText, setExportText] = React.useState("");
  const [error, setError] = React.useState<string>();
  const errorRef = React.useRef<string | undefined>(undefined);
  const stream = React.useRef<PansPositionStreamService | undefined>(undefined);
  const activeSession = React.useRef<PositionLogSession | undefined>(undefined);
  const startRequested = React.useRef(false);
  const recentRing = React.useRef<PositionLogSample[]>([]);
  const countersRef = React.useRef<PositionLogIngestionCounters | undefined>(
    undefined,
  );
  const publishTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastPublishedAt = React.useRef(0);

  const publishSnapshots = React.useCallback(() => {
    publishTimer.current = undefined;
    lastPublishedAt.current = Date.now();
    setRecent([...recentRing.current]);
    setCounters(countersRef.current);
  }, []);

  const scheduleSnapshotPublish = React.useCallback(() => {
    if (publishTimer.current) return;
    const delay = Math.max(
      0,
      UI_PUBLISH_INTERVAL_MS - (Date.now() - lastPublishedAt.current),
    );
    publishTimer.current = setTimeout(publishSnapshots, delay);
  }, [publishSnapshots]);

  const publishError = React.useCallback((nextError: string | undefined) => {
    if (errorRef.current === nextError) return;
    errorRef.current = nextError;
    setError(nextError);
  }, []);

  React.useEffect(() => {
    markerRef.current = marker;
  }, [marker]);

  const refreshSessions = React.useCallback(async () => {
    if (!network) return;
    const next = await listLogs(network.id);
    setSessions(next.sort((left, right) => right.startedAt - left.startedAt));
  }, [listLogs, network]);

  React.useEffect(() => {
    let active = true;
    if (network) {
      void listLogs(network.id).then((next) => {
        if (active)
          setSessions(
            next.sort((left, right) => right.startedAt - left.startedAt),
          );
      });
    }
    return () => {
      active = false;
    };
  }, [listLogs, network]);
  React.useEffect(
    () => () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
      const currentStream = stream.current;
      const session = activeSession.current;
      stream.current = undefined;
      activeSession.current = undefined;
      void (async () => {
        try {
          await currentStream?.stop();
        } finally {
          if (session) await stopLog(session.id);
        }
      })().catch(() => undefined);
    },
    [stopLog],
  );

  if (!network)
    return (
      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={
          <StatePanel state="error" message="Network not found." />
        }
      />
    );

  const start = async () => {
    const device = devices.find((item) => item.id === tagId);
    if (!device || startRequested.current || running) return;
    startRequested.current = true;
    setStarting(true);
    try {
      publishError(undefined);
      const session = await startLog({
        networkId: network.id,
        panId: network.panId,
        deviceId: device.id,
        notes: notes.trim() || undefined,
        metadata: { solver: "dwm1001-internal" },
      });
      activeSession.current = session;
      recentRing.current = [];
      countersRef.current = getCounters(session.id);
      publishSnapshots();
      setSelectedSessionId(session.id);
      const nextStream = live.createPositionStream();
      stream.current = nextStream;
      await nextStream.start({
        deviceId: device.id,
        transportDeviceId: device.transportDeviceId,
        onSample: (sample) => {
          if (!sample.position || !activeSession.current) return;
          const currentMarker = markerRef.current.trim();
          const result = ingestSample(
            activeSession.current.id,
            sample.position,
            {
              timestampMs: sample.receivedAt,
              nodeId: device.nodeIdHex,
              label: getDeviceDisplayName(device),
              solver: "dwm1001-internal",
              anchorCount: sample.distances.length,
              distances: sample.distances,
              ...(currentMarker ? { eventMarker: currentMarker } : {}),
            },
          );
          countersRef.current = result.counters;
          if (!result.accepted) {
            scheduleSnapshotPublish();
            publishError(displayError(result.error));
            return;
          }
          if (currentMarker) {
            markerRef.current = "";
            setMarker("");
          }
          recentRing.current = [
            ...recentRing.current.slice(-(RECENT_SAMPLE_CAP - 1)),
            result.sample,
          ];
          scheduleSnapshotPublish();
        },
        onDiagnostic: publishError,
      });
      setRunning(true);
      await refreshSessions();
    } catch (startError) {
      const currentStream = stream.current;
      const session = activeSession.current;
      stream.current = undefined;
      activeSession.current = undefined;
      setRunning(false);
      publishError(displayError(startError));
      await Promise.allSettled([
        currentStream?.stop() ?? Promise.resolve(),
        session ? stopLog(session.id) : Promise.resolve(),
      ]);
    } finally {
      startRequested.current = false;
      setStarting(false);
    }
  };
  const stop = async () => {
    const currentStream = stream.current;
    const session = activeSession.current;
    stream.current = undefined;
    activeSession.current = undefined;
    startRequested.current = false;
    setRunning(false);
    try {
      const results = await Promise.allSettled([
        currentStream?.stop() ?? Promise.resolve(),
        session ? stopLog(session.id) : Promise.resolve(),
      ]);
      const failure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (failure) throw failure.reason;
      if (session) {
        countersRef.current = getCounters(session.id);
        publishSnapshots();
      }
      await refreshSessions();
    } catch (stopError) {
      publishError(displayError(stopError));
    }
  };
  const chooseSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    recentRing.current = (await listSamples(sessionId)).slice(
      -RECENT_SAMPLE_CAP,
    );
    countersRef.current = getCounters(sessionId);
    publishSnapshots();
    setExportText("");
  };
  const generateExport = async () => {
    if (!selectedSessionId) return;
    try {
      setExportText(await exportLog(selectedSessionId, exportFormat));
    } catch (exportError) {
      publishError(displayError(exportError));
    }
  };

  const renderSample = ({ item }: ListRenderItemInfo<PositionLogSample>) => (
    <RecentSampleRow
      sample={item}
      units={network.settings.mapUnits}
      color={theme.text}
    />
  );

  return (
    <FlatList
      testID="position-log-sample-list"
      data={recent}
      keyExtractor={(sample) => `${sample.sessionId}-${sample.sequence}`}
      renderItem={renderSample}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      removeClippedSubviews={Platform.OS === "android"}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
      ListHeaderComponent={
        <>
          <SectionCard title="Live position log">
            <SelectField
              label="Tag"
              value={tagId}
              onChange={(value) => {
                if (!running && !starting) setTagId(value);
              }}
              choices={devices
                .filter((device) => device.role === "tag")
                .map((device) => ({
                  label: getDeviceDisplayName(device),
                  value: device.id,
                }))}
            />
            <TextField
              label="Session notes"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <TextField
              label="Next-sample event marker"
              value={marker}
              onChangeText={(value) => {
                markerRef.current = value;
                setMarker(value);
              }}
              helper="The marker is attached to the next received position sample."
            />
            {running ? (
              <ManagerButton
                label="Stop and close log session"
                variant="outline"
                onPress={() => void stop()}
              />
            ) : (
              <ManagerButton
                label="Start live log session"
                loading={starting}
                isDisabled={!tagId || starting}
                onPress={() => void start()}
              />
            )}
            {error ? <StatePanel state="error" message={error} /> : null}
            {counters ? (
              <Text selectable size="xs" style={{ color: theme.textMuted }}>
                Accepted {counters.accepted} · persisted {counters.persisted} ·
                queued {counters.queuedSamples} · dropped{" "}
                {counters.droppedBackpressure + counters.droppedInvalid} · flush
                failures {counters.flushFailures}
              </Text>
            ) : null}
          </SectionCard>

          <SectionCard title="Saved sessions">
            <SelectField
              label="Session"
              value={selectedSessionId}
              onChange={(value) => void chooseSession(value)}
              choices={sessions.map((session) => ({
                label: `${new Date(session.startedAt).toLocaleString()} · ${
                  session.endedAt ? "closed" : "interrupted/open"
                }`,
                value: session.id,
              }))}
            />
            <SelectField<ExportFormat>
              label="Export format"
              value={exportFormat}
              onChange={setExportFormat}
              choices={EXPORT_FORMAT_CHOICES}
            />
            <ManagerButton
              label="Generate selectable export"
              variant="outline"
              isDisabled={!selectedSessionId}
              onPress={() => void generateExport()}
            />
            {exportText ? (
              <Text
                selectable
                size="xs"
                style={{
                  borderRadius: eight2FiveRadii.sm,
                  backgroundColor: theme.surface,
                  color: theme.text,
                  fontFamily: "monospace",
                  padding: 12,
                }}
              >
                {exportText}
              </Text>
            ) : null}
          </SectionCard>

          <SectionCard title={`Recent samples (${recent.length})`} />
        </>
      }
      ListEmptyComponent={
        <Text selectable size="sm" style={{ color: theme.textMuted }}>
          No samples loaded.
        </Text>
      }
    />
  );
}
