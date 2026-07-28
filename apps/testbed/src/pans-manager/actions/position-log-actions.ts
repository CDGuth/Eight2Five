import React from "react";

import { usePansActions } from "../manager-context";

export function usePositionLogActions() {
  const actions = usePansActions();
  return React.useMemo(
    () => ({
      runBatch: actions.runBatch,
      startLog: actions.startPositionLog,
      appendSample: actions.appendPositionSample,
      stopLog: actions.stopPositionLog,
      listLogs: actions.listPositionLogs,
      listSamples: actions.listPositionSamples,
      exportLog: actions.exportPositionLog,
      refreshTopology: actions.refreshTopology,
      createPositionStream: actions.createPositionStream,
    }),
    [actions],
  );
}
