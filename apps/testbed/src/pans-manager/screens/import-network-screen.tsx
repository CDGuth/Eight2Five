import React from "react";
import { useRouter } from "expo-router";

import { usePansManager } from "../manager-context";
import { displayError } from "../manager-utils";
import {
  ManagerButton,
  ManagerScreen,
  SectionCard,
  StatePanel,
  TextField,
} from "../components/manager-ui";

export function ImportNetworkScreen() {
  const router = useRouter();
  const manager = usePansManager();
  const [json, setJson] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [loading, setLoading] = React.useState(false);

  const importProfile = async () => {
    setLoading(true);
    setError(undefined);
    try {
      await manager.importNetwork(json);
      router.replace("/(tabs)/networks-devices" as never);
    } catch (importError) {
      setError(displayError(importError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard title="Import network JSON">
        <TextField
          label="Export JSON"
          value={json}
          onChangeText={setJson}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder='{"schema":"eight2five.pans-network",…}'
        />
        <ManagerButton
          label="Validate and import"
          loading={loading}
          isDisabled={!json.trim()}
          onPress={() => void importProfile()}
        />
        {error ? <StatePanel state="error" message={error} /> : null}
      </SectionCard>
    </ManagerScreen>
  );
}
