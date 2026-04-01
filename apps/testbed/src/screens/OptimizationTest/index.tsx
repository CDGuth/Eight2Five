import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Clipboard from "expo-clipboard";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MaterialIcons } from "@expo/vector-icons";

import { useOptimizationRunner } from "./hooks/useOptimizationRunner";
import { ResultsView } from "./ResultsView";
import { Visualization } from "./components/Visualization";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { InputRow } from "./components/InputRow";
import { Dropdown } from "./components/Dropdown";
import { styles, ACCENT_COLOR } from "./styles";
import { FIELD_PRESETS } from "./types";

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
  const [useWhiteBackground] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);

  const visualizationRef = useRef<View>(null);

  const copyImage = async () => {
    try {
      setIsCapturing(true);
      await new Promise((r) => setTimeout(r, 100));
      const base64 = await captureRef(visualizationRef, {
        format: "png",
        quality: 0.8,
        result: "base64",
      });
      await Clipboard.setImageAsync(base64);
      Alert.alert("Success", "Image copied");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to copy");
    } finally {
      setIsCapturing(false);
    }
  };

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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Visualization</Text>
            {!state.isRunning && (
              <TouchableOpacity onPress={copyImage} style={styles.copyButton}>
                <Text style={styles.copyButtonText}>Copy Image</Text>
              </TouchableOpacity>
            )}
          </View>
          <View
            ref={visualizationRef}
            collapsable={false}
            style={[
              styles.sectionContent,
              useWhiteBackground && { backgroundColor: "#fff" },
            ]}
          >
            <Visualization
              width={state.fieldWidth}
              length={state.fieldLength}
              result={state.results[selectedResultIndex]}
              currentAnchors={state.currentAnchors}
              currentTruePos={state.currentTruePos}
              currentInitialFireflies={state.currentInitialFireflies}
              onUpdateTruePos={(x, y) => setters.setCurrentTruePos({ x, y })}
              onUpdateAnchor={(i, x, y) => {
                const newA = [...state.currentAnchors];
                newA[i] = { ...newA[i], x, y };
                setters.setCurrentAnchors(newA);
              }}
              onDragStart={() => setScrollEnabled(false)}
              onDragEnd={() => setScrollEnabled(true)}
              isRandomTruePos={state.isRandomTruePos}
              isRunning={state.isRunning}
              showHeatmap={showHeatmap}
              onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
              isSetup={effectiveViewMode === "config"}
              hideControls={isCapturing}
              useWhiteBackground={useWhiteBackground}
              heatmapResolution={state.heatmapResolution}
              onResolutionChange={setters.setHeatmapResolution}
            />
            {state.isRunning && (
              <View style={{ marginTop: 20 }}>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${state.progress * 100}%` },
                    ]}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: "#d32f2f", marginTop: 10 },
                  ]}
                  onPress={actions.cancelTest}
                >
                  <Text style={styles.buttonText}>CANCEL RUN</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {effectiveViewMode === "config" ? (
          <>
            <CollapsibleSection title="Test Configuration & Control">
              <Dropdown
                label="Simulation Source"
                value={state.sourceMode}
                options={[
                  { label: "BLE RSSI", value: "ble-rssi" },
                  { label: "UWB Distance", value: "uwb-distance" },
                  { label: "Hybrid (BLE + UWB)", value: "hybrid" },
                ]}
                onSelect={(v) => setters.setSourceMode(v as any)}
                onToggle={(open) => setScrollEnabled(!open)}
                disabled={state.isRunning}
                tooltip="Choose the measurement source used for simulation runs. Hybrid mode feeds both RSSI and distance observations into the optimizer."
              />
              {state.sourceMode !== "ble-rssi" && (
                <InputRow
                  label="UWB Sigma (m)"
                  value={state.uwbDistanceSigma}
                  onChange={setters.setUwbDistanceSigma}
                  disabled={state.isRunning}
                  tooltip="Standard deviation applied to simulated UWB distance measurements in meters. Lower values approximate cleaner LOS measurements."
                />
              )}
              <Dropdown
                label="Test Mode"
                value={state.testMode}
                options={[
                  { label: "Standard", value: "standard" },
                  { label: "Parameter Sweep", value: "sweep" },
                ]}
                onSelect={(v) => setters.setTestMode(v as any)}
                onToggle={(open) => setScrollEnabled(!open)}
                disabled={state.isRunning}
              />
              {state.testMode === "standard" ? (
                <>
                  <InputRow
                    label="Number of Runs"
                    value={state.numRuns}
                    onChange={setters.setNumRuns}
                    disabled={state.isRunning}
                    tooltip="The number of simulations to run for this test. Results will be averaged in the analysis view."
                  />
                  <InputRow
                    label="Iteration Time Limit (ms)"
                    value={state.iterationTimeLimit}
                    onChange={setters.setIterationTimeLimit}
                    disabled={state.isRunning}
                    tooltip="The maximum time allowed for each iteration step (ms). This ensures the UI remains responsive during optimization. Increase this for faster convergence on powerful devices."
                  />
                </>
              ) : (
                <>
                  <Dropdown
                    label="Sweep Parameter"
                    value={state.sweepConfig.param}
                    options={[
                      {
                        label: "Iteration Time Limit",
                        value: "iterationTimeLimitMs",
                      },
                      { label: "Max Iterations", value: "maxIterations" },
                      { label: "Population Size", value: "populationSize" },
                      { label: "Beta0", value: "beta0" },
                      { label: "Light Absorption", value: "lightAbsorption" },
                      { label: "Alpha", value: "alpha" },
                      { label: "Initial Temp", value: "initialTemperature" },
                      { label: "Cooling Rate", value: "coolingRate" },
                      {
                        label: "Solver Weighting Base",
                        value: "solverWeightingBase",
                      },
                      {
                        label: "Solver Weighting Scale",
                        value: "solverWeightingScale",
                      },
                      {
                        label: "Solver Weighting Param",
                        value: "solverWeightingParam",
                      },
                    ]}
                    onSelect={(v) =>
                      setters.setSweepConfig({ ...state.sweepConfig, param: v })
                    }
                    onToggle={(open) => setScrollEnabled(!open)}
                    disabled={state.isRunning}
                  />
                  <InputRow
                    label="Min"
                    value={state.sweepConfig.min}
                    onChange={(v) =>
                      setters.setSweepConfig({ ...state.sweepConfig, min: v })
                    }
                    disabled={state.isRunning}
                  />
                  <InputRow
                    label="Max"
                    value={state.sweepConfig.max}
                    onChange={(v) =>
                      setters.setSweepConfig({ ...state.sweepConfig, max: v })
                    }
                    disabled={state.isRunning}
                  />
                  <InputRow
                    label="Runs Per Step"
                    value={state.sweepConfig.runsPerStep}
                    onChange={(v) =>
                      setters.setSweepConfig({
                        ...state.sweepConfig,
                        runsPerStep: v,
                      })
                    }
                    disabled={state.isRunning}
                  />
                  <InputRow
                    label="Step"
                    value={state.sweepConfig.step}
                    onChange={(v) =>
                      setters.setSweepConfig({ ...state.sweepConfig, step: v })
                    }
                    disabled={state.isRunning}
                  />
                </>
              )}
              <View style={styles.controls}>
                {state.isRunning ? (
                  <ActivityIndicator />
                ) : (
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleRunOptimizationTest}
                  >
                    <Text style={styles.buttonText}>Run Optimization Test</Text>
                  </TouchableOpacity>
                )}
              </View>
            </CollapsibleSection>

            {!state.isRunning && (
              <>
                <CollapsibleSection title="Field & Anchors">
                  <Dropdown
                    label="Field Preset"
                    value={state.fieldPreset}
                    options={FIELD_PRESETS}
                    onSelect={actions.handlePresetChange}
                    onToggle={(open) => setScrollEnabled(!open)}
                    tooltip="Quickly set the field dimensions and anchor configuration based on common scenarios (e.g. standard field or custom presets)."
                  />
                  <InputRow
                    label="Width (m)"
                    value={state.inputWidth}
                    onChange={setters.setInputWidth}
                    tooltip="The width of the practice field in meters. This defines the X-axis bounds for localization."
                  />
                  <InputRow
                    label="Length (m)"
                    value={state.inputLength}
                    onChange={setters.setInputLength}
                    tooltip="The length of the practice field in meters. This defines the Y-axis bounds for localization."
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setters.setFieldWidth(parseFloat(state.inputWidth));
                      setters.setFieldLength(parseFloat(state.inputLength));
                    }}
                    style={[
                      styles.button,
                      { marginBottom: 10, backgroundColor: ACCENT_COLOR },
                    ]}
                  >
                    <Text style={styles.buttonText}>Resize Field</Text>
                  </TouchableOpacity>
                  <InputRow
                    label="Number of Anchors"
                    value={state.numAnchors}
                    onChange={setters.setNumAnchors}
                    tooltip="Total number of beacons to simulate on the field. More anchors generally improve accuracy but increase computational load."
                  />
                  <Dropdown
                    label="Anchor Placement"
                    value={state.anchorPlacementMode}
                    options={[
                      { label: "Border", value: "border" },
                      { label: "Grid", value: "grid" },
                      { label: "Random", value: "random" },
                    ]}
                    onSelect={(v) => setters.setAnchorPlacementMode(v as any)}
                    onToggle={(open) => setScrollEnabled(!open)}
                    tooltip="Determines the spatial distribution of anchors. 'Grid' is often best for coverage, while 'Border' simulates perimeter-only setups."
                  />
                  <InputRow
                    label="Anchor Sigma (m)"
                    value={state.anchorSigma}
                    onChange={setters.setAnchorSigma}
                    tooltip="The standard deviation of random error added to anchor positions during generation. Increase this to simulate field setup inaccuracies. Even small values (0.1m - 0.5m) can significantly impact localization accuracy."
                  />
                  <TouchableOpacity
                    onPress={actions.generateAnchors}
                    style={[styles.button, { marginTop: 10 }]}
                  >
                    <Text style={styles.buttonText}>Generate Anchors</Text>
                  </TouchableOpacity>
                </CollapsibleSection>

                <CollapsibleSection title="Model & Filter">
                  <Dropdown
                    label="Propagation Model"
                    value={state.selectedModel}
                    options={[
                      { label: "Two Ray Ground", value: "TwoRayGround" },
                      { label: "Log Normal", value: "LogNormal" },
                    ]}
                    onSelect={setters.setSelectedModel}
                    onToggle={(open) => setScrollEnabled(!open)}
                    tooltip="The mathematical model used to predict RSSI from distance. Two Ray Ground is better for outdoors; Log Normal is standard for indoors."
                  />
                  <Dropdown
                    label="RSSI Filter"
                    value={state.selectedFilter}
                    options={[{ label: "Kalman", value: "Kalman" }]}
                    onSelect={setters.setSelectedFilter}
                    onToggle={(open) => setScrollEnabled(!open)}
                    tooltip="The filtering algorithm applied to raw simulated measurements. Kalman filtering smooths out noise peaks based on process/measurement variance."
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Propagation Constants">
                  <InputRow
                    label="Tx Height (m)"
                    value={state.txHeight}
                    onChange={setters.setTxHeight}
                    tooltip="Height of the transmitter (beacon) in meters. In the Two-Ray model, this determines the destructive interference patterns."
                  />
                  <InputRow
                    label="Rx Height (m)"
                    value={state.rxHeight}
                    onChange={setters.setRxHeight}
                    tooltip="Height of the receiver (mobile device) in meters. This is the height at which the performer carries their phone."
                  />
                  <InputRow
                    label="Frequency (Hz)"
                    value={state.freq}
                    onChange={setters.setFreq}
                    tooltip="Operating frequency in Hertz. Standard Bluetooth Low Energy operates at 2.4e9 Hz (2.4 GHz)."
                  />
                  <InputRow
                    label="Tx Gain"
                    value={state.txGain}
                    onChange={setters.setTxGain}
                    tooltip="Transmitter antenna gain (linear scale). A value of 1.0 represents an isotropic antenna."
                  />
                  <InputRow
                    label="Rx Gain"
                    value={state.rxGain}
                    onChange={setters.setRxGain}
                    tooltip="Receiver antenna gain (linear scale). Combined with Tx Gain, this scales the overall received power."
                  />
                  <InputRow
                    label="Reflection Coeff"
                    value={state.refCoeff}
                    onChange={setters.setRefCoeff}
                    tooltip="Ground reflection coefficient (0 to 1). A value of 1.0 represents a perfect reflector (typical for flat asphalt or concrete)."
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Algorithm">
                  <Dropdown
                    label="Algorithm"
                    value={state.selectedAlgorithm}
                    options={[{ label: "MFASA", value: "MFASA" }]}
                    onSelect={setters.setSelectedAlgorithm}
                    onToggle={(open) => setScrollEnabled(!open)}
                    tooltip="The optimization algorithm used to solve for X,Y coordinates. MFASA is a Memetic Firefly Algorithm combined with Simulated Annealing."
                  />
                  <InputRow
                    label="Population Size"
                    value={state.populationSize}
                    onChange={setters.setPopulationSize}
                    tooltip="The number of candidate fireflies. Larger populations (50+) explore the search space better but slow down execution."
                  />
                  <InputRow
                    label="Max Iterations"
                    value={state.maxIterations}
                    onChange={setters.setMaxIterations}
                    tooltip="The maximum iterations for the optimization. Increase this for better precision, especially when Alpha is low."
                  />
                  <InputRow
                    label="Beta0"
                    value={state.beta0}
                    onChange={setters.setBeta0}
                    tooltip="Attractiveness at distance 0. Controls how strongly fireflies are attracted to brighter ones. Lower values (1-2) prevent early convergence; higher values (3+) make the algorithm more aggressive but risk local minima."
                  />
                  <InputRow
                    label="Light Absorption"
                    value={state.lightAbsorption}
                    onChange={setters.setLightAbsorption}
                    tooltip="Controls how quickly attractiveness decreases with distance. High values (0.5+) mean local search around better fireflies; low values (0.01-0.1) mean global search. Tune this based on field size - larger fields often need lower values."
                  />
                  <InputRow
                    label="Alpha"
                    value={state.alpha}
                    onChange={setters.setAlpha}
                    tooltip="Randomization parameter. Controls the randomness of movement. Start with 0.2. Decrease this as you increase max iterations to let the fireflies 'settle' into the solution."
                  />
                  <InputRow
                    label="Initial Temperature"
                    value={state.initialTemperature}
                    onChange={setters.setInitialTemperature}
                    tooltip="Starting temperature for Simulated Annealing. Higher means more random movement initially to help escape local minima. Try 10-20 for high-noise environments."
                  />
                  <InputRow
                    label="Cooling Rate"
                    value={state.coolingRate}
                    onChange={setters.setCoolingRate}
                    tooltip="How fast the temperature decreases (0-1). Closer to 1 means slower cooling and more exhaustive exploration. Faster cooling (0.8-0.9) speed up convergence but might be less accurate."
                  />

                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#eee",
                      marginVertical: 15,
                    }}
                  />

                  <Text
                    style={[
                      styles.labelText,
                      { fontWeight: "bold", marginBottom: 10 },
                    ]}
                  >
                    Solver Weighting
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.checkboxRow,
                      state.isRunning && { opacity: 0.5 },
                      { marginBottom: 10 },
                    ]}
                    onPress={() =>
                      !state.isRunning &&
                      setters.setIsSolverWeighted(!state.isSolverWeighted)
                    }
                    disabled={state.isRunning}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        state.isSolverWeighted && styles.checkboxChecked,
                      ]}
                    >
                      {state.isSolverWeighted && (
                        <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.labelText}>Enable Weighted Solver</Text>
                  </TouchableOpacity>

                  {state.isSolverWeighted && (
                    <Dropdown
                      label="Weighting Model"
                      value={state.solverWeightingModel}
                      options={[
                        { label: "Linear", value: "linear" },
                        { label: "Inverse RSSI", value: "inverse-rssi" },
                      ]}
                      onSelect={(v) =>
                        setters.setSolverWeightingModel(v as any)
                      }
                      onToggle={(open) => setScrollEnabled(!open)}
                    />
                  )}

                  {state.isSolverWeighted && (
                    <>
                      {state.solverWeightingModel === "linear" && (
                        <InputRow
                          label="Weighting Base"
                          value={state.solverWeightingBase}
                          onChange={setters.setSolverWeightingBase}
                          tooltip="The base value added to RSSI for linear weighting (e.g. 120). This ensures the weights are positive. Higher values make the weights more uniform across different RSSI levels; lower values (closer to the absolute max RSSI) emphasize strong signals more heavily."
                        />
                      )}
                      <InputRow
                        label="Weighting Scale"
                        value={state.solverWeightingScale}
                        onChange={setters.setSolverWeightingScale}
                        tooltip="Multiplicative scale factor for the calculated weight. Use this to amplify the effect of weighting in the objective function. Higher values (~5-10) can help the optimizer prioritize high-quality signals more aggressively."
                      />
                      {state.solverWeightingModel !== "linear" && (
                        <InputRow
                          label="Curvature (Param)"
                          value={state.solverWeightingParam}
                          onChange={setters.setSolverWeightingParam}
                          tooltip="Power parameter for inverse weighting models. At 1.0, weighting is inverse; at 2.0, it becomes inverse-squared. Increase this (>2.0) to exponentially favor fireflies near the strongest anchors, which is useful when noise increases heavily with distance."
                        />
                      )}
                    </>
                  )}

                  <View
                    style={{
                      height: 1,
                      backgroundColor: "#eee",
                      marginVertical: 15,
                    }}
                  />

                  <Text
                    style={[
                      styles.labelText,
                      { fontWeight: "bold", marginBottom: 10 },
                    ]}
                  >
                    Initial Population
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.checkboxRow,
                      state.isRunning && { opacity: 0.5 },
                      { marginBottom: 10 },
                    ]}
                    onPress={() =>
                      !state.isRunning &&
                      setters.setIsRegenerateFirefliesEveryRun(
                        !state.isRegenerateFirefliesEveryRun,
                      )
                    }
                    disabled={state.isRunning}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        state.isRegenerateFirefliesEveryRun &&
                          styles.checkboxChecked,
                      ]}
                    >
                      {state.isRegenerateFirefliesEveryRun && (
                        <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.labelText}>Regenerate Every Run</Text>
                  </TouchableOpacity>

                  <Dropdown
                    label="Firefly Placement"
                    value={state.fireflyPlacementMode}
                    options={[
                      { label: "Border", value: "border" },
                      { label: "Grid", value: "grid" },
                      { label: "Random", value: "random" },
                    ]}
                    onSelect={(v) => setters.setFireflyPlacementMode(v as any)}
                    onToggle={(open) => setScrollEnabled(!open)}
                    tooltip="Determines how the initial firefly population is scattered. 'Grid' or 'Border' can provide a systematic starting coverage, while 'Random' is standard."
                  />
                  <InputRow
                    label="Firefly Sigma (m)"
                    value={state.fireflySigma}
                    onChange={setters.setFireflySigma}
                    tooltip="The standard deviation of random error added to initial firefly positions during generation."
                  />
                  {!state.isRegenerateFirefliesEveryRun && (
                    <TouchableOpacity
                      onPress={actions.generateFireflies}
                      style={[styles.button, { marginTop: 10 }]}
                    >
                      <Text style={styles.buttonText}>Generate Fireflies</Text>
                    </TouchableOpacity>
                  )}
                </CollapsibleSection>

                <CollapsibleSection title="Simulation Noise">
                  <TouchableOpacity
                    style={[
                      styles.checkboxRow,
                      state.isRunning && { opacity: 0.5 },
                      { marginBottom: 10 },
                    ]}
                    onPress={() =>
                      !state.isRunning &&
                      setters.setIsNoiseEnabled(!state.isNoiseEnabled)
                    }
                    disabled={state.isRunning}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        state.isNoiseEnabled && styles.checkboxChecked,
                      ]}
                    >
                      {state.isNoiseEnabled && (
                        <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.labelText}>Enable Noise</Text>
                  </TouchableOpacity>

                  {state.isNoiseEnabled && (
                    <Dropdown
                      label="Noise Model"
                      value={state.noiseWeightingModel}
                      options={[
                        { label: "Linear (Default)", value: "linear" },
                        { label: "Logarithmic", value: "logarithmic" },
                        { label: "Exponential", value: "exponential" },
                      ]}
                      onSelect={(v) => setters.setNoiseWeightingModel(v as any)}
                      onToggle={(open) => setScrollEnabled(!open)}
                    />
                  )}

                  {state.isNoiseEnabled && (
                    <>
                      <InputRow
                        label="Base Sigma (dBm)"
                        value={state.noiseBase}
                        onChange={setters.setNoiseBase}
                        tooltip="The base noise level at 0 distance. Typical values are 2.0-4.0 dBm. This represents environment noise floor and hardware inconsistencies."
                      />
                      <InputRow
                        label="Noise Scale"
                        value={state.noiseScale}
                        onChange={setters.setNoiseScale}
                        tooltip="Scaling factor for the distance-dependent noise term. Typical values (0.05-0.1) represent how signal variance increases as the device moves further from an anchor."
                      />
                      {state.noiseWeightingModel !== "linear" && (
                        <InputRow
                          label="Model Parameter"
                          value={state.noiseParameter}
                          onChange={setters.setNoiseParameter}
                          tooltip="Additional parameter for Logarithmic (multiplier) or Exponential (divisor) models. Logarithmic: increase for steeper growth. Exponential: decrease to make noise explode faster at range."
                        />
                      )}
                    </>
                  )}
                </CollapsibleSection>

                <CollapsibleSection title="True Position">
                  <TouchableOpacity
                    style={[
                      styles.checkboxRow,
                      state.isRunning && { opacity: 0.5 },
                    ]}
                    onPress={() =>
                      !state.isRunning &&
                      setters.setIsRandomTruePos(!state.isRandomTruePos)
                    }
                    disabled={state.isRunning}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        state.isRandomTruePos && styles.checkboxChecked,
                      ]}
                    >
                      {state.isRandomTruePos && (
                        <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.labelText}>
                      Randomly Select True Position
                    </Text>
                  </TouchableOpacity>

                  {!state.isRandomTruePos && (
                    <>
                      <InputRow
                        label="True X (m)"
                        value={state.manualTrueX}
                        onChange={(v) => {
                          setters.setManualTrueX(v);
                          setters.setCurrentTruePos({
                            ...state.currentTruePos,
                            x: parseFloat(v) || 0,
                          });
                        }}
                        disabled={state.isRunning}
                        tooltip="Manually set the true X coordinate of the performer. This will be used as the ground truth for error calculation."
                      />
                      <InputRow
                        label="True Y (m)"
                        value={state.manualTrueY}
                        onChange={(v) => {
                          setters.setManualTrueY(v);
                          setters.setCurrentTruePos({
                            ...state.currentTruePos,
                            y: parseFloat(v) || 0,
                          });
                        }}
                        disabled={state.isRunning}
                        tooltip="Manually set the true Y coordinate of the performer. This will be used as the ground truth for error calculation."
                      />
                    </>
                  )}
                </CollapsibleSection>
              </>
            )}
          </>
        ) : (
          <>
            {!state.isRunning && (
              <TouchableOpacity
                onPress={handleBackToConfiguration}
                style={[styles.button, { marginBottom: 12 }]}
              >
                <Text style={styles.buttonText}>Back to Configuration</Text>
              </TouchableOpacity>
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
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
