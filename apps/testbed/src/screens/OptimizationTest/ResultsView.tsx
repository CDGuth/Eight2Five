import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
import {
  RunResult,
  BatchAnalysis,
  LogBatch,
  SweepStepResult,
  SweepConfig,
} from "./types";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { Dropdown } from "./components/Dropdown";
import { SweepGraph } from "./components/SweepGraph";
import { ScrollLockView } from "./components/ScrollLockView";
import { styles } from "./styles";

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
  const [showBestAverages, setShowBestAverages] = useState(false);
  const graphRef = useRef<View>(null);

  const copyGraph = async () => {
    try {
      const base64 = await captureRef(graphRef, {
        format: "png",
        quality: 0.8,
        result: "base64",
      });
      await Clipboard.setImageAsync(base64);
      Alert.alert("Success", "Graph copied");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to copy graph");
    }
  };

  const selectedResult = results[selectedResultIndex];

  // Logic to filter best runs
  const bestItems = React.useMemo(() => {
    if (showBestAverages && sweepResults.length > 0) {
      return [...sweepResults]
        .sort((a, b) => a.avgError - b.avgError)
        .slice(0, 50) // Limit display
        .map((s, i) => ({
          label: `${i + 1}. ${sweepConfig.param}=${s.val.toFixed(2)}: Avg Err ${s.avgError.toFixed(3)}m`,
          onPress: () => {
            // Find original index of this step
            const idx = sweepResults.findIndex((sr) => sr.val === s.val);
            setSelectedSweepIndex(idx);
            if (s.runs.length > 0) {
              const rId = s.runs[0].id;
              const rIdx = results.findIndex((r) => r.id === rId);
              if (rIdx !== -1) onSelectResultIndex(rIdx);
            }
          },
        }));
    } else {
      return (
        batchAnalysis?.bestRuns.map((r, i) => ({
          label: `${i + 1}. Run ${r.id}: ${r.error.toFixed(3)}m (${r.duration.toFixed(1)}ms)`,
          onPress: () => {
            const idx = results.findIndex((res) => res.id === r.id);
            if (idx !== -1) onSelectResultIndex(idx);
          },
        })) || []
      );
    }
  }, [
    showBestAverages,
    sweepResults,
    batchAnalysis,
    sweepConfig.param,
    results,
    onSelectResultIndex,
  ]);

  // Logic for filtering individual runs dropdown
  const filteredRunOptions = React.useMemo(() => {
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

  return (
    <>
      {batchAnalysis && (
        <CollapsibleSection title="Batch Analysis">
          <View style={styles.logBatchContainer}>
            <View style={styles.logBatchHeader}>
              <View>
                <Text style={styles.logBatchTitle}>Summary Statistics</Text>
                <Text style={styles.logBatchTime}>
                  {batchAnalysis.totalRuns} Runs Total
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={async () => {
                  const text = `Batch Analysis:\nAvg Error: ${batchAnalysis.avgError.toFixed(3)}m\nAvg Time: ${batchAnalysis.avgDuration.toFixed(2)}ms`;
                  await Clipboard.setStringAsync(text);
                  Alert.alert("Copied", "Analysis copied to clipboard");
                }}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.logEntries, { maxHeight: undefined }]}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultText, { fontWeight: "bold" }]}>
                    Accuracy
                  </Text>
                  <Text style={styles.resultText}>
                    Avg Error: {batchAnalysis.avgError.toFixed(3)}m
                  </Text>
                  <Text style={styles.resultText}>
                    RMSE: {batchAnalysis.rmse.toFixed(3)}m
                  </Text>
                  <Text style={styles.resultText}>
                    Std Dev: {batchAnalysis.stdDev.toFixed(3)}m
                  </Text>
                  <Text style={styles.resultText}>
                    Median: {batchAnalysis.medianError.toFixed(3)}m
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultText, { fontWeight: "bold" }]}>
                    Performance
                  </Text>
                  <Text style={styles.resultText}>
                    Avg Time: {batchAnalysis.avgDuration.toFixed(2)}ms
                  </Text>
                  <Text style={styles.resultText}>
                    Avg Iter: {batchAnalysis.avgIterations.toFixed(1)}
                  </Text>
                  <Text style={styles.resultText}>
                    Min/Max: {batchAnalysis.minError.toFixed(3)}m /{" "}
                    {batchAnalysis.maxError.toFixed(3)}m
                  </Text>
                </View>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#eee",
                  paddingTop: 10,
                  marginBottom: 10,
                }}
              >
                <Text style={[styles.resultText, { fontWeight: "bold" }]}>
                  Success Rates
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={styles.resultText}>
                    Error &lt; 1.0m: {batchAnalysis.successRate1m.toFixed(1)}%
                  </Text>
                  <Text style={styles.resultText}>
                    Error &lt; 2.0m: {batchAnalysis.successRate2m.toFixed(1)}%
                  </Text>
                </View>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#eee",
                  paddingTop: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 5,
                  }}
                >
                  <Text style={[styles.resultText, { fontWeight: "bold" }]}>
                    Best Runs
                  </Text>
                  {testMode === "sweep" && (
                    <TouchableOpacity
                      onPress={() => setShowBestAverages(!showBestAverages)}
                      style={[
                        styles.copyButton,
                        { paddingHorizontal: 8, paddingVertical: 4 },
                      ]}
                    >
                      <Text style={[styles.copyButtonText, { fontSize: 10 }]}>
                        {showBestAverages ? "Show Individual" : "Show Averages"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollLockView
                  onToggleScroll={onToggleScroll}
                  style={{
                    maxHeight: 180,
                    marginTop: 5,
                    borderWidth: 1,
                    borderColor: "#eee",
                    borderRadius: 4,
                    backgroundColor: "#fafafa",
                  }}
                >
                  <ScrollView
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    style={{ padding: 5 }}
                  >
                    {bestItems.map((item, i) => (
                      <TouchableOpacity key={i} onPress={item.onPress}>
                        <Text style={[styles.resultText, { color: "#666" }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </ScrollLockView>
              </View>

              {testMode === "sweep" && sweepResults.length > 0 && (
                <View
                  style={{
                    marginTop: 15,
                    borderTopWidth: 1,
                    borderTopColor: "#eee",
                    paddingTop: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 5,
                    }}
                  >
                    <Text style={[styles.resultText, { fontWeight: "bold" }]}>
                      Parameter Sweep
                    </Text>
                    <TouchableOpacity
                      onPress={copyGraph}
                      style={[
                        styles.copyButton,
                        { paddingHorizontal: 8, paddingVertical: 4 },
                      ]}
                    >
                      <Text style={[styles.copyButtonText, { fontSize: 10 }]}>
                        Copy Graph
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View
                    ref={graphRef}
                    collapsable={false}
                    style={{ backgroundColor: "#fafafa" }}
                  >
                    <SweepGraph
                      results={sweepResults}
                      paramName={sweepConfig.param}
                      selectedIndex={selectedSweepIndex}
                      onSelectPoint={(idx) => {
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
                      }}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
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
        {selectedResult && (
          <View style={styles.logBatchContainer}>
            <View style={styles.logEntries}>
              <Text style={styles.resultText}>
                Error: {selectedResult.error.toFixed(3)}m
              </Text>
              <Text style={styles.resultText}>
                True Pos: ({selectedResult.truePos.x.toFixed(2)},{" "}
                {selectedResult.truePos.y.toFixed(2)})
              </Text>
              <Text style={styles.resultText}>
                Est Pos: ({selectedResult.estPos.x.toFixed(2)},{" "}
                {selectedResult.estPos.y.toFixed(2)})
              </Text>
            </View>
          </View>
        )}
      </CollapsibleSection>

      {logBatches.length > 0 && (
        <CollapsibleSection title="Logs" defaultOpen={false}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: "#d32f2f", marginBottom: 15 },
            ]}
            onPress={onClearLogs}
          >
            <Text style={styles.buttonText}>Clear Logs</Text>
          </TouchableOpacity>
          {logBatches.map((batch) => (
            <View key={batch.id} style={styles.logBatchContainer}>
              <View style={styles.logBatchHeader}>
                <View>
                  <Text style={styles.logBatchTitle}>{batch.type} Run</Text>
                  <Text style={styles.logBatchTime}>
                    {new Date(batch.startTime).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={async () => {
                    const text = batch.entries
                      .map(
                        (e) =>
                          `[${new Date(e.timestamp).toLocaleTimeString()}] ${
                            e.message
                          }`,
                      )
                      .join("\n");
                    await Clipboard.setStringAsync(text);
                    Alert.alert("Copied", "Logs copied to clipboard");
                  }}
                >
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <ScrollLockView onToggleScroll={onToggleScroll}>
                <ScrollView style={styles.logEntries} nestedScrollEnabled>
                  {batch.entries.map((e, i) => (
                    <Text key={i} style={styles.logText}>
                      <Text style={styles.logTimestamp}>
                        [{new Date(e.timestamp).toLocaleTimeString()}]
                      </Text>{" "}
                      {e.message}
                    </Text>
                  ))}
                </ScrollView>
              </ScrollLockView>
            </View>
          ))}
        </CollapsibleSection>
      )}
    </>
  );
};
