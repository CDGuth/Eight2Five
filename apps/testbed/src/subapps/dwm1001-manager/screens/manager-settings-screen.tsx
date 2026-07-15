import React from "react";

import { usePansManager } from "../manager-context";
import { displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
  TextField,
} from "../components/manager-ui";

const FALLBACKS = {
  discoveryStaleAfterMs: 10_000,
  discoveryScanDurationMs: 25_000,
  connectionTimeoutMs: 10_000,
  positionLogMemoryCap: 1_000,
  positionLogFlushSize: 100,
};

export function ManagerSettingsScreen() {
  const manager = usePansManager();
  const settings = manager.managerSettings ?? FALLBACKS;
  const [stale, setStale] = React.useState(
    String(settings.discoveryStaleAfterMs),
  );
  const [timeout, setTimeout] = React.useState(
    String(settings.connectionTimeoutMs),
  );
  const [scanDuration, setScanDuration] = React.useState(
    String(settings.discoveryScanDurationMs),
  );
  const [memoryCap, setMemoryCap] = React.useState(
    String(settings.positionLogMemoryCap),
  );
  const [flushSize, setFlushSize] = React.useState(
    String(settings.positionLogFlushSize),
  );
  const [message, setMessage] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  const save = async () => {
    setError(undefined);
    setMessage(undefined);
    const values = [stale, scanDuration, timeout, memoryCap, flushSize].map(
      Number,
    );
    if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
      setError("All manager settings must be positive integers.");
      return;
    }
    if (values[4] > values[3]) {
      setError("Position log flush size cannot exceed the memory cap.");
      return;
    }
    try {
      await manager.saveManagerSettings({
        discoveryStaleAfterMs: values[0],
        discoveryScanDurationMs: values[1],
        connectionTimeoutMs: values[2],
        positionLogMemoryCap: values[3],
        positionLogFlushSize: values[4],
      });
      setMessage(
        "Settings saved. Reopen the manager to apply service timing changes.",
      );
    } catch (saveError) {
      setError(displayError(saveError));
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Manager behavior"
        description="These values are local to this testbed manager."
      >
        <TextField
          label="Discovery stale after (ms)"
          value={stale}
          onChangeText={setStale}
          keyboardType="number-pad"
        />
        <TextField
          label="Discovery scan duration (ms)"
          value={scanDuration}
          onChangeText={setScanDuration}
          keyboardType="number-pad"
        />
        <TextField
          label="Connection timeout (ms)"
          value={timeout}
          onChangeText={setTimeout}
          keyboardType="number-pad"
        />
        <TextField
          label="Position log memory cap"
          value={memoryCap}
          onChangeText={setMemoryCap}
          keyboardType="number-pad"
        />
        <TextField
          label="Position log flush size"
          value={flushSize}
          onChangeText={setFlushSize}
          keyboardType="number-pad"
        />
        <ManagerButton label="Save settings" onPress={() => void save()} />
        {message ? <StatePanel state="success" message={message} /> : null}
        {error ? <StatePanel state="error" message={error} /> : null}
      </SectionCard>
    </ManagerScreen>
  );
}
