import React from "react";

import { usePansActions } from "../manager-context";

export function useDeviceConfigurationActions() {
  const actions = usePansActions();
  return React.useMemo(
    () => ({
      inspect: actions.inspectDevice,
      inspectDiagnostics: actions.inspectDiagnostics,
      configure: actions.configureDevice,
      applyConfiguration: actions.applyDeviceConfiguration,
      assignToNetwork: actions.assignDeviceToNetworkProfile,
      migrateNetworkPan: actions.migrateNetworkProfilePan,
      unassignOnline: actions.unassignOnlineDevice,
      deleteOffline: actions.deleteOfflineDevice,
      disconnect: actions.disconnectDevice,
    }),
    [actions],
  );
}
