import React, { useMemo, useState } from "react";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { Dropdown } from "./components/Dropdown";
import { BatchSummaryCard } from "./components/BatchSummaryCard";
import { BestRunsList } from "./components/BestRunsList";
import { SweepResultsCard } from "./components/SweepResultsCard";
import { RunDetailsCard } from "./components/RunDetailsCard";
import { LogBatchList } from "./components/LogBatchList";
import {
  RunResult,
  BatchAnalysis,
  LogBatch,
  SweepStepResult,
  SweepConfig,
} from "./types";

interface ResultsViewProps {
  results: RunResult[];
  batchAnalysis: BatchAnalysis | null;
  logBatches: LogBatch[];
  sweepResults: SweepStepResult[];
  sweepConfig: SweepConfig;
  testMode: string;
  selectedResultIndex: number;
  onSelectResultIndex: (index: number) => void;
  onClearLogs: () => void;
  onToggleScroll?: (enabled: boolean) => void;
}

export const ResultsView = ({
  results,
  batchAnalysis,
  logBatches,
  sweepResults,
  sweepConfig,
  testMode,
  selectedResultIndex,
  onSelectResultIndex,
  onClearLogs,
  onToggleScroll,
}: ResultsViewProps) => {
  const [selectedSweepIndex, setSelectedSweepIndex] = useState<number | null>(
    null,
  );
  const selectedResult = results[selectedResultIndex];

  const filteredRunOptions = useMemo(() => {
    if (selectedSweepIndex !== null && sweepResults[selectedSweepIndex]) {
      return sweepResults[selectedSweepIndex].runs.map((r) => {
        const globalIndex = results.findIndex((res) => res.id === r.id);
        return {
          label: `Run ${globalIndex + 1} - Err: ${r.error.toFixed(2)}m`,
          value: globalIndex.toString(),
        };
      });
    }
    return results.map((r, i) => ({
      label: `Run ${i + 1} - Err: ${r.error.toFixed(2)}m`,
      value: i.toString(),
    }));
  }, [selectedSweepIndex, sweepResults, results]);

  const handleSelectPoint = (idx: number) => {
    if (selectedSweepIndex === idx) {
      setSelectedSweepIndex(null);
    } else {
      setSelectedSweepIndex(idx);
      const sweepStep = sweepResults[idx];
      if (sweepStep?.runs.length > 0) {
        const rId = sweepStep.runs[0].id;
        const rIdx = results.findIndex((r) => r.id === rId);
        if (rIdx !== -1) onSelectResultIndex(rIdx);
      }
    }
  };

  return (
    <>
      {batchAnalysis && (
        <CollapsibleSection title="Batch Analysis">
          <BatchSummaryCard batchAnalysis={batchAnalysis} />
          <BestRunsList
            results={results}
            sweepResults={sweepResults}
            batchAnalysis={batchAnalysis}
            sweepConfig={sweepConfig}
            testMode={testMode}
            onSelectResultIndex={onSelectResultIndex}
            onSelectSweepIndex={setSelectedSweepIndex}
            onToggleScroll={onToggleScroll}
          />
          {testMode === "sweep" && sweepResults.length > 0 && (
            <SweepResultsCard
              sweepResults={sweepResults}
              sweepConfig={sweepConfig}
              selectedSweepIndex={selectedSweepIndex}
              onSelectPoint={handleSelectPoint}
            />
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Individual Runs">
        <Dropdown
          label={
            selectedSweepIndex !== null ? "Select Run from Step" : "Select Run"
          }
          value={selectedResultIndex.toString()}
          options={filteredRunOptions}
          onSelect={(v) => onSelectResultIndex(parseInt(v))}
          onToggle={(open) => onToggleScroll?.(!open)}
        />
        {selectedResult && <RunDetailsCard result={selectedResult} />}
      </CollapsibleSection>

      {logBatches.length > 0 && (
        <CollapsibleSection title="Logs" defaultOpen={false}>
          <LogBatchList
            logBatches={logBatches}
            onClearLogs={onClearLogs}
            onToggleScroll={onToggleScroll}
          />
        </CollapsibleSection>
      )}
    </>
  );
};
