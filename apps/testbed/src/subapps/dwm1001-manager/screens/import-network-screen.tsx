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
      const imported = await manager.importNetwork(json);
      router.replace(
        `/(subapps)/dwm1001-manager/networks/${imported.network.id}` as never,
      );
    } catch (importError) {
      setError(displayError(importError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManagerScreen>
      <SectionCard
        title="Import network JSON"
        description="Paste an Eight2Five PANS network export. Schema, version, settings, devices, duplicate IDs, and secret-like fields are validated before storage."
      >
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
