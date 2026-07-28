import React from "react";

import { usePansActions } from "../manager-context";

export function useRepositoryNetworkActions() {
  const actions = usePansActions();
  return React.useMemo(
    () => ({
      refresh: actions.refreshPersisted,
      createNetwork: actions.createNetwork,
      saveNetwork: actions.saveNetwork,
      saveNetworkLocalDetails: actions.saveNetworkLocalDetails,
      deleteNetwork: actions.deleteNetwork,
      importNetwork: actions.importNetwork,
      exportNetwork: actions.exportNetwork,
      saveManagerSettings: actions.saveManagerSettings,
    }),
    [actions],
  );
}
