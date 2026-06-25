import React, { useState, useRef } from "react";
import type { View } from "react-native";
import { Box } from "@eight2five/ui/box";
import { ScrollView } from "@eight2five/ui/scroll-view";

import { ActionButton } from "../../components/ActionButton";
import { useCaptureToClipboard } from "../../hooks/useCaptureToClipboard";
import { useOptimizationRunner } from "./hooks/useOptimizationRunner";
import { ResultsView } from "./ResultsView";
import { AlgorithmSection } from "./sections/AlgorithmSection";
import { FieldAnchorsSection } from "./sections/FieldAnchorsSection";
import { ModelFilterSection } from "./sections/ModelFilterSection";
import { NoiseSection } from "./sections/NoiseSection";
import { PropagationSection } from "./sections/PropagationSection";
import { TestControlSection } from "./sections/TestControlSection";
import { TruePositionSection } from "./sections/TruePositionSection";
import { VisualizationSection } from "./sections/VisualizationSection";
import type { SimulationSourceMode, TestMode } from "./types";

export interface OptimizationTestScreenProps {
  onExit?: () => void;
  forcedViewMode?: "config" | "results";
  onRunComplete?: () => void;
  onBackToConfiguration?: () => void;
}

export default function OptimizationTestScreen({
  forcedViewMode,
  onRunComplete,
  onBackToConfiguration,
}: OptimizationTestScreenProps) {
  const { state, setters, actions } = useOptimizationRunner();
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const useWhiteBackground = true;
  const { isCapturing, capture } = useCaptureToClipboard();
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  const visualizationRef = useRef<View>(null);

  const effectiveViewMode = forcedViewMode ?? state.viewMode;

  const handleRunOptimizationTest = async () => {
    await actions.runOptimizationTest();
    onRunComplete?.();
  };

  const handleBackToConfiguration = () => {
    if (!forcedViewMode) {
      setters.setViewMode("config");
    }
    actions.resetResults();
    onBackToConfiguration?.();
  };

  const onToggleScroll = (open: boolean) => setScrollEnabled(!open);

  return (
    <Box className="flex-1 bg-background">
      <ScrollView
        className="flex-1 pb-5"
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
      >
        <VisualizationSection
          visualizationRef={visualizationRef}
          fieldWidth={state.fieldWidth}
          fieldLength={state.fieldLength}
          result={state.results[selectedResultIndex]}
          currentAnchors={state.currentAnchors}
          currentTruePos={state.currentTruePos}
          currentInitialFireflies={state.currentInitialFireflies}
          onUpdateTruePos={(x, y) => setters.setCurrentTruePos({ x, y })}
          onUpdateAnchor={(i, x, y) => {
            const newAnchors = [...state.currentAnchors];
            newAnchors[i] = { ...newAnchors[i], x, y };
            setters.setCurrentAnchors(newAnchors);
          }}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
          isRandomTruePos={state.isRandomTruePos}
          isRunning={state.isRunning}
          showHeatmap={showHeatmap}
          onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
          isSetup={effectiveViewMode === "config"}
          isCapturing={isCapturing}
          useWhiteBackground={useWhiteBackground}
          heatmapResolution={state.heatmapResolution}
          onResolutionChange={setters.setHeatmapResolution}
          progress={state.progress}
          onCopyImage={() => capture(visualizationRef)}
          onCancelRun={actions.cancelTest}
        />

        {effectiveViewMode === "config" ? (
          <>
            <TestControlSection
              sourceMode={state.sourceMode}
              setSourceMode={(v) =>
                setters.setSourceMode(v as SimulationSourceMode)
              }
              uwbDistanceSigma={state.uwbDistanceSigma}
              setUwbDistanceSigma={setters.setUwbDistanceSigma}
              testMode={state.testMode}
              setTestMode={(v) => setters.setTestMode(v as TestMode)}
              numRuns={state.numRuns}
              setNumRuns={setters.setNumRuns}
              iterationTimeLimit={state.iterationTimeLimit}
              setIterationTimeLimit={setters.setIterationTimeLimit}
              sweepConfig={state.sweepConfig}
              setSweepConfig={setters.setSweepConfig}
              isRunning={state.isRunning}
              onRun={handleRunOptimizationTest}
              onToggleScroll={onToggleScroll}
            />

            {!state.isRunning && (
              <>
                <FieldAnchorsSection
                  fieldPreset={state.fieldPreset}
                  onPresetChange={actions.handlePresetChange}
                  inputWidth={state.inputWidth}
                  setInputWidth={setters.setInputWidth}
                  inputLength={state.inputLength}
                  setInputLength={setters.setInputLength}
                  setFieldWidth={setters.setFieldWidth}
                  setFieldLength={setters.setFieldLength}
                  numAnchors={state.numAnchors}
                  setNumAnchors={setters.setNumAnchors}
                  anchorPlacementMode={state.anchorPlacementMode}
                  setAnchorPlacementMode={(v) =>
                    setters.setAnchorPlacementMode(
                      v as "random" | "border" | "grid",
                    )
                  }
                  anchorSigma={state.anchorSigma}
                  setAnchorSigma={setters.setAnchorSigma}
                  onGenerateAnchors={actions.generateAnchors}
                  onToggleScroll={onToggleScroll}
                />

                <ModelFilterSection
                  selectedModel={state.selectedModel}
                  setSelectedModel={setters.setSelectedModel}
                  selectedFilter={state.selectedFilter}
                  setSelectedFilter={setters.setSelectedFilter}
                  onToggleScroll={onToggleScroll}
                />

                <PropagationSection
                  txHeight={state.txHeight}
                  setTxHeight={setters.setTxHeight}
                  rxHeight={state.rxHeight}
                  setRxHeight={setters.setRxHeight}
                  freq={state.freq}
                  setFreq={setters.setFreq}
                  txGain={state.txGain}
                  setTxGain={setters.setTxGain}
                  rxGain={state.rxGain}
                  setRxGain={setters.setRxGain}
                  refCoeff={state.refCoeff}
                  setRefCoeff={setters.setRefCoeff}
                />

                <AlgorithmSection
                  selectedAlgorithm={state.selectedAlgorithm}
                  setSelectedAlgorithm={setters.setSelectedAlgorithm}
                  populationSize={state.populationSize}
                  setPopulationSize={setters.setPopulationSize}
                  maxIterations={state.maxIterations}
                  setMaxIterations={setters.setMaxIterations}
                  beta0={state.beta0}
                  setBeta0={setters.setBeta0}
                  lightAbsorption={state.lightAbsorption}
                  setLightAbsorption={setters.setLightAbsorption}
                  alpha={state.alpha}
                  setAlpha={setters.setAlpha}
                  initialTemperature={state.initialTemperature}
                  setInitialTemperature={setters.setInitialTemperature}
                  coolingRate={state.coolingRate}
                  setCoolingRate={setters.setCoolingRate}
                  isSolverWeighted={state.isSolverWeighted}
                  setIsSolverWeighted={setters.setIsSolverWeighted}
                  solverWeightingModel={state.solverWeightingModel}
                  setSolverWeightingModel={(v) =>
                    setters.setSolverWeightingModel(
                      v as "linear" | "inverse-rssi",
                    )
                  }
                  solverWeightingBase={state.solverWeightingBase}
                  setSolverWeightingBase={setters.setSolverWeightingBase}
                  solverWeightingScale={state.solverWeightingScale}
                  setSolverWeightingScale={setters.setSolverWeightingScale}
                  solverWeightingParam={state.solverWeightingParam}
                  setSolverWeightingParam={setters.setSolverWeightingParam}
                  isRegenerateFirefliesEveryRun={
                    state.isRegenerateFirefliesEveryRun
                  }
                  setIsRegenerateFirefliesEveryRun={
                    setters.setIsRegenerateFirefliesEveryRun
                  }
                  fireflyPlacementMode={state.fireflyPlacementMode}
                  setFireflyPlacementMode={(v) =>
                    setters.setFireflyPlacementMode(
                      v as "random" | "border" | "grid",
                    )
                  }
                  fireflySigma={state.fireflySigma}
                  setFireflySigma={setters.setFireflySigma}
                  onGenerateFireflies={actions.generateFireflies}
                  isRunning={state.isRunning}
                  onToggleScroll={onToggleScroll}
                />

                <NoiseSection
                  isNoiseEnabled={state.isNoiseEnabled}
                  setIsNoiseEnabled={setters.setIsNoiseEnabled}
                  isRunning={state.isRunning}
                  noiseWeightingModel={state.noiseWeightingModel}
                  setNoiseWeightingModel={(v) =>
                    setters.setNoiseWeightingModel(
                      v as "linear" | "logarithmic" | "exponential",
                    )
                  }
                  noiseBase={state.noiseBase}
                  setNoiseBase={setters.setNoiseBase}
                  noiseScale={state.noiseScale}
                  setNoiseScale={setters.setNoiseScale}
                  noiseParameter={state.noiseParameter}
                  setNoiseParameter={setters.setNoiseParameter}
                  onToggleScroll={onToggleScroll}
                />

                <TruePositionSection
                  isRandomTruePos={state.isRandomTruePos}
                  setIsRandomTruePos={setters.setIsRandomTruePos}
                  isRunning={state.isRunning}
                  manualTrueX={state.manualTrueX}
                  setManualTrueX={setters.setManualTrueX}
                  manualTrueY={state.manualTrueY}
                  setManualTrueY={setters.setManualTrueY}
                  currentTruePos={state.currentTruePos}
                  setCurrentTruePos={setters.setCurrentTruePos}
                />
              </>
            )}
          </>
        ) : (
          <>
            {!state.isRunning && (
              <ActionButton
                onPress={handleBackToConfiguration}
                className="mb-3"
              >
                Back to Configuration
              </ActionButton>
            )}
            <ResultsView
              results={state.results}
              batchAnalysis={state.batchAnalysis}
              logBatches={state.logBatches}
              sweepResults={state.sweepResults}
              sweepConfig={state.sweepConfig}
              testMode={state.testMode}
              selectedResultIndex={selectedResultIndex}
              onSelectResultIndex={setSelectedResultIndex}
              onClearLogs={() => setters.setLogBatches([])}
              onToggleScroll={setScrollEnabled}
            />
          </>
        )}
        <Box className="h-10" />
      </ScrollView>
    </Box>
  );
}
