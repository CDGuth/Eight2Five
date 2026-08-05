import React from "react";
import { DEFAULT_PANS_MANAGER_SETTINGS } from "@eight2five/mobile/pans-manager";

import { useManagerSettings } from "../manager-context";
import { useRepositoryNetworkActions } from "../actions/repository-network-actions";
import { displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
  TextField,
} from "../components/manager-ui";

export function ManagerSettingsScreen() {
  const managerSettings = useManagerSettings();
  const { saveManagerSettings } = useRepositoryNetworkActions();
  const settings = managerSettings ?? DEFAULT_PANS_MANAGER_SETTINGS;
  const [stale, setStale] = React.useState(
    String(settings.discoveryStaleAfterMs),
  );
  const [timeout, setTimeout] = React.useState(
    String(settings.connectionTimeoutMs),
  );
  const [memoryCap, setMemoryCap] = React.useState(
    String(settings.positionLogMemoryCap),
  );
  const [flushSize, setFlushSize] = React.useState(
    String(settings.positionLogFlushSize),
  );
  const [message, setMessage] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const isPristine = React.useRef(true);
  const isHydrated = managerSettings !== undefined;

  React.useEffect(() => {
    if (!managerSettings || !isPristine.current) return;

    setStale(String(managerSettings.discoveryStaleAfterMs));
    setTimeout(String(managerSettings.connectionTimeoutMs));
    setMemoryCap(String(managerSettings.positionLogMemoryCap));
    setFlushSize(String(managerSettings.positionLogFlushSize));
  }, [managerSettings]);

  const edit =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (value: string) => {
      isPristine.current = false;
      setter(value);
    };

  const save = async () => {
    if (!isHydrated) return;

    setError(undefined);
    setMessage(undefined);
    const values = [stale, timeout, memoryCap, flushSize].map(Number);
    if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
      setError("All manager settings must be positive integers.");
      return;
    }
    if (values[3] > values[2]) {
      setError("Position log flush size cannot exceed the memory cap.");
      return;
    }
    try {
      await saveManagerSettings({
        ...settings,
        discoveryStaleAfterMs: values[0],
        connectionTimeoutMs: values[1],
        positionLogMemoryCap: values[2],
        positionLogFlushSize: values[3],
      });
      setMessage(
        "Settings saved. Restart the application to apply service timing changes.",
      );
    } catch (saveError) {
      setError(displayError(saveError));
    }
  };

  return (
    <ManagerScreen>
      <SectionCard title="Manager behavior">
        <TextField
          testID="manager-settings-discovery-stale"
          label="Discovery stale after (ms)"
          value={stale}
          onChangeText={edit(setStale)}
          keyboardType="number-pad"
          editable={isHydrated}
          accessibilityState={{ disabled: !isHydrated }}
        />
        <TextField
          testID="manager-settings-connection-timeout"
          label="Connection timeout (ms)"
          value={timeout}
          onChangeText={edit(setTimeout)}
          keyboardType="number-pad"
          editable={isHydrated}
          accessibilityState={{ disabled: !isHydrated }}
        />
        <TextField
          testID="manager-settings-position-memory-cap"
          label="Position log memory cap"
          value={memoryCap}
          onChangeText={edit(setMemoryCap)}
          keyboardType="number-pad"
          editable={isHydrated}
          accessibilityState={{ disabled: !isHydrated }}
        />
        <TextField
          testID="manager-settings-position-flush-size"
          label="Position log flush size"
          value={flushSize}
          onChangeText={edit(setFlushSize)}
          keyboardType="number-pad"
          editable={isHydrated}
          accessibilityState={{ disabled: !isHydrated }}
        />
        {!isHydrated ? (
          <StatePanel state="loading" message="Loading manager settings…" />
        ) : null}
        <ManagerButton
          testID="manager-settings-save"
          label="Save settings"
          loading={!isHydrated}
          isDisabled={!isHydrated}
          onPress={() => void save()}
        />
        {message ? <StatePanel state="success" message={message} /> : null}
        {error ? <StatePanel state="error" message={error} /> : null}
      </SectionCard>
    </ManagerScreen>
  );
}
