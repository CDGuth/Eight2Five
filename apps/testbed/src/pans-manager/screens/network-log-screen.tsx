import React from "react";
import { useLocalSearchParams } from "expo-router";
import {
  formatMapDistance,
  getDeviceDisplayName,
  type PansPositionStreamService,
  type PositionLogSample,
  type PositionLogSession,
} from "@eight2five/mobile/pans-manager";
import { Text } from "@eight2five/ui/components/text";
import { eight2FiveRadii, useEight2FiveTheme } from "@eight2five/ui/theme";
import { VStack } from "@eight2five/ui/components/vstack";

import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  SelectField,
  StatePanel,
  TextField,
} from "../components/manager-ui";
import {
  useManagedNetwork,
  usePansBatchAndLogs,
  usePansLiveNetwork,
} from "../manager-context";
import { displayError } from "../manager-utils";

export function NetworkLogScreen() {
  const { networkId } = useLocalSearchParams<{ networkId: string }>();
  const theme = useEight2FiveTheme();
  const { network, devices } = useManagedNetwork(networkId);
  const { startLog, appendSample, stopLog, listLogs, listSamples, exportLog } =
    usePansBatchAndLogs();
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
  const [exportFormat, setExportFormat] = React.useState<"csv" | "json">("csv");
  const [exportText, setExportText] = React.useState("");
  const [error, setError] = React.useState<string>();
  const stream = React.useRef<PansPositionStreamService | undefined>(undefined);
  const activeSession = React.useRef<PositionLogSession | undefined>(undefined);
  const startRequested = React.useRef(false);

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
      <ManagerScreen>
        <StatePanel state="error" message="Network not found." />
      </ManagerScreen>
    );

  const start = async () => {
    const device = devices.find((item) => item.id === tagId);
    if (!device || startRequested.current || running) return;
    startRequested.current = true;
    setStarting(true);
    try {
      setError(undefined);
      const session = await startLog({
        networkId: network.id,
        panId: network.panId,
        deviceId: device.id,
        notes: notes.trim() || undefined,
        metadata: { solver: "dwm1001-internal" },
      });
      activeSession.current = session;
      setSelectedSessionId(session.id);
      const nextStream = live.createPositionStream();
      stream.current = nextStream;
      await nextStream.start({
        deviceId: device.id,
        transportDeviceId: device.transportDeviceId,
        onSample: (sample) => {
          if (!sample.position || !activeSession.current) return;
          const currentMarker = markerRef.current.trim();
          if (currentMarker) {
            markerRef.current = "";
            setMarker("");
          }
          void appendSample(activeSession.current.id, sample.position, {
            timestampMs: sample.receivedAt,
            nodeId: device.nodeIdHex,
            label: getDeviceDisplayName(device),
            solver: "dwm1001-internal",
            anchorCount: sample.distances.length,
            distances: sample.distances,
            ...(currentMarker ? { eventMarker: currentMarker } : {}),
          })
            .then((saved) => {
              setRecent((current) => [...current.slice(-49), saved]);
            })
            .catch((appendError) => {
              if (currentMarker && !markerRef.current) {
                markerRef.current = currentMarker;
                setMarker(currentMarker);
              }
              setError(displayError(appendError));
            });
        },
        onDiagnostic: setError,
      });
      setRunning(true);
      await refreshSessions();
    } catch (startError) {
      const currentStream = stream.current;
      const session = activeSession.current;
      stream.current = undefined;
      activeSession.current = undefined;
      setRunning(false);
      setError(displayError(startError));
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
      await refreshSessions();
    } catch (stopError) {
      setError(displayError(stopError));
    }
  };
  const chooseSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setRecent((await listSamples(sessionId)).slice(-50));
    setExportText("");
  };
  const generateExport = async () => {
    if (!selectedSessionId) return;
    try {
      setExportText(await exportLog(selectedSessionId, exportFormat));
    } catch (exportError) {
      setError(displayError(exportError));
    }
  };

  return (
    <ManagerScreen>
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
          onChangeText={setMarker}
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
      </SectionCard>

      <SectionCard title="Saved sessions">
        <SelectField
          label="Session"
          value={selectedSessionId}
          onChange={(value) => void chooseSession(value)}
          choices={sessions.map((session) => ({
            label: `${new Date(session.startedAt).toLocaleString()} · ${session.endedAt ? "closed" : "interrupted/open"}`,
            value: session.id,
          }))}
        />
        <SelectField
          label="Export format"
          value={exportFormat}
          onChange={(value) => setExportFormat(value as "csv" | "json")}
          choices={[
            { label: "CSV", value: "csv" },
            { label: "JSON", value: "json" },
          ]}
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

      <SectionCard title={`Recent samples (${recent.length})`}>
        <VStack space="xs">
          {recent.map((sample) => (
            <Text
              key={`${sample.sessionId}-${sample.sequence}`}
              selectable
              size="xs"
              style={{ color: theme.text, fontFamily: "monospace" }}
            >
              {sample.sequence}: X{" "}
              {formatMapDistance(sample.xMeters, network.settings.mapUnits)}, Y{" "}
              {formatMapDistance(sample.yMeters, network.settings.mapUnits)}, Z{" "}
              {formatMapDistance(sample.zMeters, network.settings.mapUnits)} ·
              anchors {sample.anchorCount}
              {sample.eventMarker ? ` · ${sample.eventMarker}` : ""}
            </Text>
          ))}
          {!recent.length ? (
            <Text selectable size="sm" style={{ color: theme.textMuted }}>
              No samples loaded.
            </Text>
          ) : null}
        </VStack>
      </SectionCard>
    </ManagerScreen>
  );
}
