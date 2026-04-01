import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { MFASAOptimizer } from "@eight2five/shared/localization/algorithms/MFASA";
import { LogNormalModel } from "@eight2five/shared/localization/models/LogNormalModel";
import { TwoRayGroundModel } from "@eight2five/shared/localization/models/TwoRayGroundModel";
import {
  DEFAULT_PROPAGATION_CONSTANTS,
  DEFAULT_FIELD_DIMENSIONS,
  DEFAULT_MFASA_OPTIONS,
  DEFAULT_TX_POWER_DBM,
  DEFAULT_SIMULATION_NOISE,
  DEFAULT_ANCHOR_SIGMA,
} from "@eight2five/shared/localization/LocalizationConfig";
import {
  AnchorGeometry,
  PropagationConstants,
} from "@eight2five/shared/localization/types";
import {
  BatchAnalysis,
  FIELD_PRESETS,
  LogBatch,
  LogEntry,
  RunParameters,
  RunResult,
  SimulationSourceMode,
  SweepConfig,
  SweepStepResult,
  TestMode,
} from "../types";
import { generateSimulationCandidates } from "../simulation/simulationProviders";

export function useOptimizationRunner() {
  // --- Configuration State ---
  const [inputWidth, setInputWidth] = useState(
    DEFAULT_FIELD_DIMENSIONS.widthMeters.toString(),
  );
  const [inputLength, setInputLength] = useState(
    DEFAULT_FIELD_DIMENSIONS.lengthMeters.toString(),
  );
  const [fieldWidth, setFieldWidth] = useState(
    DEFAULT_FIELD_DIMENSIONS.widthMeters,
  );
  const [fieldLength, setFieldLength] = useState(
    DEFAULT_FIELD_DIMENSIONS.lengthMeters,
  );
  const [fieldPreset, setFieldPreset] = useState("custom");
  const [numAnchors, setNumAnchors] = useState("8");

  // Propagation
  const [txHeight, setTxHeight] = useState(
    DEFAULT_PROPAGATION_CONSTANTS.transmitterHeightMeters.toString(),
  );
  const [rxHeight, setRxHeight] = useState(
    DEFAULT_PROPAGATION_CONSTANTS.receiverHeightMeters.toString(),
  );
  const [freq, setFreq] = useState(
    DEFAULT_PROPAGATION_CONSTANTS.frequencyHz.toString(),
  );
  const [txGain, setTxGain] = useState(
    DEFAULT_PROPAGATION_CONSTANTS.transmitterGain.toString(),
  );
  const [rxGain, setRxGain] = useState(
    DEFAULT_PROPAGATION_CONSTANTS.receiverGain.toString(),
  );
  const [refCoeff, setRefCoeff] = useState(
    DEFAULT_PROPAGATION_CONSTANTS.reflectionCoefficient.toString(),
  );

  // MFASA Options
  const [iterationTimeLimit, setIterationTimeLimit] = useState(
    DEFAULT_MFASA_OPTIONS.timeBudgetMs.toString(),
  );
  const [maxIterations, setMaxIterations] = useState(
    DEFAULT_MFASA_OPTIONS.maxIterations.toString(),
  );
  const [populationSize, setPopulationSize] = useState(
    DEFAULT_MFASA_OPTIONS.populationSize.toString(),
  );
  const [beta0, setBeta0] = useState(DEFAULT_MFASA_OPTIONS.beta0.toString());
  const [lightAbsorption, setLightAbsorption] = useState(
    DEFAULT_MFASA_OPTIONS.lightAbsorption.toString(),
  );
  const [alpha, setAlpha] = useState(DEFAULT_MFASA_OPTIONS.alpha.toString());
  const [initialTemperature, setInitialTemperature] = useState(
    DEFAULT_MFASA_OPTIONS.initialTemperature.toString(),
  );
  const [coolingRate, setCoolingRate] = useState(
    DEFAULT_MFASA_OPTIONS.coolingRate.toString(),
  );

  // Selections
  const [selectedModel, setSelectedModel] = useState("TwoRayGround");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("MFASA");
  const [selectedFilter, setSelectedFilter] = useState("Kalman");
  const [sourceMode, setSourceMode] =
    useState<SimulationSourceMode>("ble-rssi");
  const [uwbDistanceSigma, setUwbDistanceSigma] = useState("0.15");

  // Algorithm Weighting
  const [isSolverWeighted, setIsSolverWeighted] = useState(false);
  const [solverWeightingModel, setSolverWeightingModel] = useState<
    "linear" | "inverse-rssi"
  >("linear");
  const [solverWeightingBase, setSolverWeightingBase] = useState("120");
  const [solverWeightingScale, setSolverWeightingScale] = useState("1.0");
  const [solverWeightingParam, setSolverWeightingParam] = useState("1.0");

  // Simulation Noise
  const [isNoiseEnabled, setIsNoiseEnabled] = useState(true);
  const [noiseWeightingModel, setNoiseWeightingModel] = useState<
    "linear" | "logarithmic" | "exponential"
  >("linear");
  const [noiseBase, setNoiseBase] = useState(
    DEFAULT_SIMULATION_NOISE.baseSigma.toString(),
  );
  const [noiseScale, setNoiseScale] = useState(
    DEFAULT_SIMULATION_NOISE.distanceSlope.toString(),
  );
  // Optional parameter for log/exp models
  const [noiseParameter, setNoiseParameter] = useState("10");

  // True Position
  const [isRandomTruePos, setIsRandomTruePos] = useState(true);
  const [manualTrueX, setManualTrueX] = useState("25");
  const [manualTrueY, setManualTrueY] = useState("15");
  const [currentTruePos, setCurrentTruePos] = useState({ x: 25, y: 15 });

  // Anchors
  const [anchorPlacementMode, setAnchorPlacementMode] = useState<
    "random" | "border" | "grid"
  >("border");
  const [anchorSigma, setAnchorSigma] = useState(
    DEFAULT_ANCHOR_SIGMA.toString(),
  );
  const [currentAnchors, setCurrentAnchors] = useState<AnchorGeometry[]>([]);

  // Fireflies
  const [fireflyPlacementMode, setFireflyPlacementMode] = useState<
    "random" | "border" | "grid"
  >("random");
  const [fireflySigma, setFireflySigma] = useState("0.0");
  const [isRegenerateFirefliesEveryRun, setIsRegenerateFirefliesEveryRun] =
    useState(true);
  const [currentInitialFireflies, setCurrentInitialFireflies] = useState<
    { x: number; y: number }[]
  >([]);

  // Test Execution
  const [testMode, setTestMode] = useState<TestMode>("standard");
  const [numRuns, setNumRuns] = useState("10");
  const [sweepConfig, setSweepConfig] = useState<SweepConfig>({
    param: "populationSize",
    min: "10",
    max: "100",
    step: "10",
    runsPerStep: "5",
  });
  const [heatmapResolution, setHeatmapResolution] = useState("50");

  // --- Runtime State ---
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logBatches, setLogBatches] = useState<LogBatch[]>([]);
  const [results, setResults] = useState<RunResult[]>([]);
  const [sweepResults, setSweepResults] = useState<SweepStepResult[]>([]);
  const [batchAnalysis, setBatchAnalysis] = useState<BatchAnalysis | null>(
    null,
  );

  // View State
  const [viewMode, setViewMode] = useState<"config" | "results">("config");

  const isCancelledRef = useRef(false);
  const currentOptimizerRef = useRef<MFASAOptimizer | null>(null);

  const calculatePlacement = useCallback(
    (
      mode: "random" | "border" | "grid",
      n: number,
      w: number,
      l: number,
      sigma: number,
    ) => {
      const points: { x: number; y: number }[] = [];

      if (mode === "random") {
        for (let i = 0; i < n; i++) {
          points.push({ x: Math.random() * w, y: Math.random() * l });
        }
      } else if (mode === "grid") {
        const ratio = l / w;
        let cols = Math.max(1, Math.round(Math.sqrt(n / ratio)));
        let rows = Math.ceil(n / cols);
        if (cols * (rows - 1) >= n) rows--;

        const stepX = w / cols;
        const stepY = l / rows;

        for (let i = 0; i < n; i++) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const numInRow = r === rows - 1 ? n % cols || cols : cols;
          const rowOffset = ((cols - numInRow) * stepX) / 2;
          const x = (c + 0.5) * stepX + rowOffset;
          const y = (r + 0.5) * stepY;
          points.push({ x, y });
        }
      } else {
        // Border
        const perimeter = 2 * (w + l);
        const step = perimeter / n;
        for (let i = 0; i < n; i++) {
          const dist = i * step;
          let x = 0,
            y = 0;
          if (dist < w) {
            x = dist;
            y = 0;
          } else if (dist < w + l) {
            x = w;
            y = dist - w;
          } else if (dist < 2 * w + l) {
            x = w - (dist - (w + l));
            y = l;
          } else {
            x = 0;
            y = l - (dist - (2 * w + l));
          }
          points.push({ x, y });
        }
      }

      if (sigma > 0) {
        points.forEach((p) => {
          const u1 = Math.random();
          const u2 = Math.random();
          const mag = Math.sqrt(-2.0 * Math.log(u1)) * sigma;
          const phase = 2.0 * Math.PI * u2;
          p.x = Math.max(0, Math.min(w, p.x + mag * Math.cos(phase)));
          p.y = Math.max(0, Math.min(l, p.y + mag * Math.sin(phase)));
        });
      }
      return points;
    },
    [],
  );

  const addLog = useCallback((msg: string) => {
    const entry: LogEntry = { timestamp: Date.now(), message: msg };
    setLogBatches((prev) => {
      if (prev.length === 0) return prev;
      const newBatches = [...prev];
      newBatches[0] = {
        ...newBatches[0],
        entries: [entry, ...newBatches[0].entries],
      };
      return newBatches;
    });
  }, []);

  const handlePresetChange = useCallback((presetValue: string) => {
    setFieldPreset(presetValue);
    const preset = FIELD_PRESETS.find((p) => p.value === presetValue);
    if (preset && presetValue !== "custom") {
      setInputWidth(preset.width.toString());
      setInputLength(preset.length.toString());
      setFieldWidth(preset.width);
      setFieldLength(preset.length);
    }
  }, []);

  const generateAnchors = useCallback(() => {
    const n = parseInt(numAnchors) || 8;
    const points = calculatePlacement(
      anchorPlacementMode,
      n,
      fieldWidth,
      fieldLength,
      parseFloat(anchorSigma) || 0,
    );
    setCurrentAnchors(
      points.map((p, i) => ({
        mac: `00:11:22:33:44:0${i}`,
        x: p.x,
        y: p.y,
      })),
    );
  }, [
    numAnchors,
    calculatePlacement,
    anchorPlacementMode,
    fieldWidth,
    fieldLength,
    anchorSigma,
  ]);

  const generateFireflies = useCallback(() => {
    const n = parseInt(populationSize) || 25;
    const points = calculatePlacement(
      fireflyPlacementMode,
      n,
      fieldWidth,
      fieldLength,
      parseFloat(fireflySigma) || 0,
    );
    setCurrentInitialFireflies(points);
  }, [
    populationSize,
    calculatePlacement,
    fireflyPlacementMode,
    fieldWidth,
    fieldLength,
    fireflySigma,
  ]);

  useEffect(() => {
    if (currentAnchors.length === 0) generateAnchors();
  }, [generateAnchors, currentAnchors.length]);

  const performSimulation = useCallback(
    async (
      runId: number,
      paramOverrides: Partial<RunParameters> = {},
    ): Promise<RunResult> => {
      const width = fieldWidth;
      const length = fieldLength;

      const constants: PropagationConstants = {
        transmitterHeightMeters:
          parseFloat(txHeight) ||
          DEFAULT_PROPAGATION_CONSTANTS.transmitterHeightMeters,
        receiverHeightMeters:
          parseFloat(rxHeight) ||
          DEFAULT_PROPAGATION_CONSTANTS.receiverHeightMeters,
        frequencyHz:
          parseFloat(freq) || DEFAULT_PROPAGATION_CONSTANTS.frequencyHz,
        transmitterGain:
          parseFloat(txGain) || DEFAULT_PROPAGATION_CONSTANTS.transmitterGain,
        receiverGain:
          parseFloat(rxGain) || DEFAULT_PROPAGATION_CONSTANTS.receiverGain,
        reflectionCoefficient:
          parseFloat(refCoeff) ||
          DEFAULT_PROPAGATION_CONSTANTS.reflectionCoefficient,
      };

      const params = {
        iterationTimeLimitMs:
          parseFloat(iterationTimeLimit) || DEFAULT_MFASA_OPTIONS.timeBudgetMs,
        maxIterations:
          parseInt(maxIterations) || DEFAULT_MFASA_OPTIONS.maxIterations,
        populationSize:
          parseInt(populationSize) || DEFAULT_MFASA_OPTIONS.populationSize,
        beta0: parseFloat(beta0) || DEFAULT_MFASA_OPTIONS.beta0,
        lightAbsorption:
          parseFloat(lightAbsorption) || DEFAULT_MFASA_OPTIONS.lightAbsorption,
        alpha: parseFloat(alpha) || DEFAULT_MFASA_OPTIONS.alpha,
        initialTemperature:
          parseFloat(initialTemperature) ||
          DEFAULT_MFASA_OPTIONS.initialTemperature,
        coolingRate:
          parseFloat(coolingRate) || DEFAULT_MFASA_OPTIONS.coolingRate,
        solverWeightingBase: parseFloat(solverWeightingBase) || 0,
        solverWeightingScale: parseFloat(solverWeightingScale) || 1,
        solverWeightingParam: parseFloat(solverWeightingParam) || 1,
        ...paramOverrides,
      };

      let model;
      if (selectedModel === "TwoRayGround") model = new TwoRayGroundModel();
      else model = new LogNormalModel();

      const optimizer = new MFASAOptimizer({
        ...params,
        timeBudgetMs: 10,
      });
      currentOptimizerRef.current = optimizer;

      let trueX, trueY;
      if (isRandomTruePos) {
        trueX = Math.random() * width;
        trueY = Math.random() * length;
      } else {
        trueX = parseFloat(manualTrueX) || width / 2;
        trueY = parseFloat(manualTrueY) || length / 2;
      }

      const { candidates, measurementKinds } = generateSimulationCandidates({
        anchors: currentAnchors,
        truePosition: { x: trueX, y: trueY },
        propagationModel: model,
        constants,
        sourceMode,
        txPowerDbm: DEFAULT_TX_POWER_DBM,
        sampleCount: 20,
        isNoiseEnabled,
        noiseWeightingModel,
        noiseBase: parseFloat(noiseBase) || 0,
        noiseScale: parseFloat(noiseScale) || 0,
        noiseParameter: parseFloat(noiseParameter) || 1,
        uwbDistanceSigma: Math.max(0, parseFloat(uwbDistanceSigma) || 0),
      });

      const startTime = performance.now();

      const initialPopulation = isRegenerateFirefliesEveryRun
        ? calculatePlacement(
            fireflyPlacementMode,
            parseInt(populationSize) || 25,
            width,
            length,
            parseFloat(fireflySigma) || 0,
          )
        : currentInitialFireflies.length > 0
          ? currentInitialFireflies
          : undefined;

      const result = await optimizer.solve({
        candidate: candidates,
        anchors: currentAnchors,
        propagation: model,
        constants: constants,
        bounds: { xMin: 0, xMax: width, yMin: 0, yMax: length },
        iterationTimeLimitMs: params.iterationTimeLimitMs,
        initialPopulation,
        weighting: {
          enabled: isSolverWeighted,
          model: solverWeightingModel,
          base: params.solverWeightingBase,
          scale: params.solverWeightingScale,
          param: params.solverWeightingParam,
        },
      });
      const endTime = performance.now();

      const errorDist = Math.sqrt(
        (result.x - trueX) ** 2 + (result.y - trueY) ** 2,
      );

      return {
        id: runId,
        params,
        truePos: { x: trueX, y: trueY },
        estPos: { x: result.x, y: result.y },
        error: errorDist,
        rssiRmse: result.errorRmse,
        duration: endTime - startTime,
        iterations: result.iterations,
        initialPopulation: result.diagnostics?.initialPopulation,
        finalPopulation: result.diagnostics?.finalPopulation,
        anchors: [...currentAnchors],
        measurements: candidates,
        modelType: selectedModel,
        sourceMode,
        measurementKinds,
        constants,
        diagnostics: result.diagnostics,
      };
    },
    [
      fieldWidth,
      fieldLength,
      txHeight,
      rxHeight,
      freq,
      txGain,
      rxGain,
      refCoeff,
      iterationTimeLimit,
      maxIterations,
      populationSize,
      beta0,
      lightAbsorption,
      alpha,
      initialTemperature,
      coolingRate,
      selectedModel,
      sourceMode,
      uwbDistanceSigma,
      isRandomTruePos,
      manualTrueX,
      manualTrueY,
      currentAnchors,
      isNoiseEnabled,
      noiseWeightingModel,
      noiseBase,
      noiseScale,
      noiseParameter,
      calculatePlacement,
      currentInitialFireflies,
      fireflyPlacementMode,
      fireflySigma,
      isRegenerateFirefliesEveryRun,
      isSolverWeighted,
      solverWeightingBase,
      solverWeightingModel,
      solverWeightingParam,
      solverWeightingScale,
    ],
  );

  const runOptimizationTest = useCallback(async () => {
    setIsRunning(true);
    isCancelledRef.current = false;

    // Create new log batch
    const newBatch: LogBatch = {
      id: Date.now(),
      startTime: Date.now(),
      entries: [],
      type: testMode === "standard" ? "Standard" : "Sweep",
    };
    setLogBatches((prev) => [newBatch, ...prev]);
    setResults([]);
    setProgress(0);
    setViewMode("results");

    const settingsLog = `Test Configuration:
Mode: ${testMode}
Runs: ${numRuns}
Field: ${fieldWidth}m x ${fieldLength}m
Anchors: ${numAnchors} (${anchorPlacementMode})
Model: ${selectedModel}
Source Mode: ${sourceMode}
Algorithm: ${selectedAlgorithm}
Filter: ${selectedFilter}

Propagation Constants:
Tx Height: ${txHeight}m
Rx Height: ${rxHeight}m
Frequency: ${freq}Hz
Tx Gain: ${txGain}
Rx Gain: ${rxGain}
Reflection Coefficient: ${refCoeff}

MFASA Options:
Time Limit: ${iterationTimeLimit}ms
Max Iterations: ${maxIterations}
Population: ${populationSize}
Beta0: ${beta0}
Light Absorption: ${lightAbsorption}
Alpha: ${alpha}
Initial Temp: ${initialTemperature}
Cooling Rate: ${coolingRate}

Simulation Noise:
Enabled: ${isNoiseEnabled}
Model: ${noiseWeightingModel} (Base: ${noiseBase}, Scale: ${noiseScale}, Param: ${noiseParameter})
UWB Distance Sigma (m): ${uwbDistanceSigma}

Solver Weighting:
Enabled: ${isSolverWeighted}
${
  isSolverWeighted
    ? `Model: ${solverWeightingModel} (Base: ${solverWeightingBase}, Scale: ${solverWeightingScale}, Param: ${solverWeightingParam})`
    : "Model: None"
}

True Position: ${isRandomTruePos ? "Random" : `Fixed (${manualTrueX}, ${manualTrueY})`}`;

    addLog(settingsLog);
    addLog(
      `Starting ${testMode === "standard" ? "Standard" : "Sweep"} Test...`,
    );

    try {
      const newResults: RunResult[] = [];
      const newSweepResults: SweepStepResult[] = [];

      if (testMode === "standard") {
        const n = parseInt(numRuns) || 10;
        for (let i = 0; i < n; i++) {
          if (isCancelledRef.current) break;
          await new Promise((r) => setTimeout(r, 0));
          const res = await performSimulation(i + 1);
          newResults.push(res);

          const runLog = `Run ${i + 1}:
Error: ${res.error.toFixed(2)}m
RSSI RMSE: ${res.rssiRmse.toFixed(2)}
Time: ${res.duration.toFixed(2)}ms
Iterations: ${res.iterations}
Est Pos: (${res.estPos.x.toFixed(2)}, ${res.estPos.y.toFixed(2)})
${isRandomTruePos ? `True Pos: (${res.truePos.x.toFixed(2)}, ${res.truePos.y.toFixed(2)})` : ""}`;

          addLog(runLog);
          setProgress((i + 1) / n);
        }
      } else {
        // Sweep
        const min = parseFloat(sweepConfig.min);
        const max = parseFloat(sweepConfig.max);
        const step = parseFloat(sweepConfig.step);
        const runsPerStep = parseInt(sweepConfig.runsPerStep) || 1;
        const paramName = sweepConfig.param;

        if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0)
          throw new Error("Invalid sweep config");

        let val = min;
        let stepIdx = 0;
        const steps = Math.floor((max - min) / step) + 1;
        const totalRuns = steps * runsPerStep;

        while (val <= max + 0.00001) {
          if (isCancelledRef.current) break;
          const stepRuns: RunResult[] = [];
          for (let r = 0; r < runsPerStep; r++) {
            if (isCancelledRef.current) break;
            await new Promise((res) => setTimeout(res, 0));
            const res = await performSimulation(stepIdx * runsPerStep + r + 1, {
              [paramName]: val,
            });
            stepRuns.push(res);
            newResults.push(res);
            addLog(
              `Step ${stepIdx + 1}, Run ${r + 1} (${paramName}=${val.toFixed(2)}):
Error: ${res.error.toFixed(2)}m
RSSI RMSE: ${res.rssiRmse.toFixed(2)}
Iterations: ${res.iterations}`,
            );
            setProgress(newResults.length / totalRuns);
          }
          const avgError =
            stepRuns.reduce((a, c) => a + c.error, 0) / stepRuns.length;
          const avgIter =
            stepRuns.reduce((a, c) => a + c.iterations, 0) / stepRuns.length;
          const stdDev =
            stepRuns.length > 1
              ? Math.sqrt(
                  stepRuns.reduce(
                    (a, c) => a + Math.pow(c.error - avgError, 2),
                    0,
                  ) / stepRuns.length,
                )
              : 0;

          addLog(
            `Step ${stepIdx + 1} Summary (${paramName}=${val.toFixed(2)}):
Avg Error: ${avgError.toFixed(3)}m
Std Dev: ${stdDev.toFixed(3)}m
Avg Iter: ${avgIter.toFixed(1)}`,
          );

          newSweepResults.push({
            val,
            avgError,
            stdDev,
            avgIterations: avgIter,
            runs: stepRuns,
          });
          val += step;
          stepIdx++;
        }
      }

      setResults(newResults);
      setSweepResults(newSweepResults);

      // Analysis
      const errors = newResults.map((r) => r.error);
      if (errors.length > 0) {
        const n = errors.length;
        const avgError = errors.reduce((a, b) => a + b, 0) / n;
        const avgDuration = newResults.reduce((a, b) => a + b.duration, 0) / n;
        const avgIter = newResults.reduce((a, b) => a + b.iterations, 0) / n;
        const rmse = Math.sqrt(errors.reduce((a, b) => a + b * b, 0) / n);
        const avgRssiRmse = newResults.reduce((a, b) => a + b.rssiRmse, 0) / n;
        const stdDev = Math.sqrt(
          errors.reduce((a, b) => a + Math.pow(b - avgError, 2), 0) / n,
        );
        const sortedErrors = [...errors].sort((a, b) => a - b);
        const medianError =
          n % 2 === 0
            ? (sortedErrors[n / 2 - 1] + sortedErrors[n / 2]) / 2
            : sortedErrors[Math.floor(n / 2)];

        const successRate1m = (errors.filter((e) => e < 1).length / n) * 100;
        const successRate2m = (errors.filter((e) => e < 2).length / n) * 100;

        const analysis = {
          avgError,
          stdDev,
          rmse,
          avgRssiRmse,
          medianError,
          minError: sortedErrors[0],
          maxError: sortedErrors[n - 1],
          avgDuration,
          avgIterations: avgIter,
          successRate1m,
          successRate2m,
          totalRuns: n,
          bestRuns: [...newResults].sort((a, b) => a.error - b.error),
        };

        setBatchAnalysis(analysis);

        addLog(`Batch Analysis:
Avg Error: ${analysis.avgError.toFixed(3)}m
Position RMSE: ${analysis.rmse.toFixed(3)}m
Avg RSSI RMSE: ${analysis.avgRssiRmse.toFixed(3)}
Std Dev: ${analysis.stdDev.toFixed(3)}m
Median: ${analysis.medianError.toFixed(3)}m
Avg Iterations: ${analysis.avgIterations.toFixed(1)}
Min/Max: ${analysis.minError.toFixed(3)}m / ${analysis.maxError.toFixed(3)}m
Avg Time: ${analysis.avgDuration.toFixed(2)}ms
Success <1m: ${analysis.successRate1m.toFixed(1)}%
Success <2m: ${analysis.successRate2m.toFixed(1)}%`);
      }
    } catch (e: any) {
      if (e.message !== "Cancelled") {
        addLog(`Error: ${e.message}`);
        console.error(e);
      }
    } finally {
      setIsRunning(false);
    }
  }, [
    testMode,
    numRuns,
    sweepConfig,
    performSimulation,
    selectedModel,
    sourceMode,
    addLog,
    fieldWidth,
    fieldLength,
    numAnchors,
    anchorPlacementMode,
    selectedAlgorithm,
    selectedFilter,
    txHeight,
    rxHeight,
    freq,
    txGain,
    rxGain,
    refCoeff,
    iterationTimeLimit,
    maxIterations,
    populationSize,
    beta0,
    lightAbsorption,
    alpha,
    initialTemperature,
    coolingRate,
    isRandomTruePos,
    manualTrueX,
    manualTrueY,
    isNoiseEnabled,
    isSolverWeighted,
    noiseBase,
    noiseParameter,
    noiseScale,
    noiseWeightingModel,
    uwbDistanceSigma,
    solverWeightingBase,
    solverWeightingModel,
    solverWeightingParam,
    solverWeightingScale,
  ]);

  const cancelTest = useCallback(() => {
    isCancelledRef.current = true;
    currentOptimizerRef.current?.cancel();
    addLog("Cancelling...");
  }, [addLog]);

  const resetResults = useCallback(() => setResults([]), []);

  return useMemo(
    () => ({
      state: {
        inputWidth,
        inputLength,
        fieldWidth,
        fieldLength,
        fieldPreset,
        numAnchors,
        txHeight,
        rxHeight,
        freq,
        txGain,
        rxGain,
        refCoeff,
        iterationTimeLimit,
        maxIterations,
        populationSize,
        beta0,
        lightAbsorption,
        alpha,
        initialTemperature,
        coolingRate,
        selectedModel,
        selectedAlgorithm,
        selectedFilter,
        sourceMode,
        uwbDistanceSigma,
        isSolverWeighted,
        solverWeightingModel,
        solverWeightingBase,
        solverWeightingScale,
        solverWeightingParam,
        isNoiseEnabled,
        noiseWeightingModel,
        noiseBase,
        noiseScale,
        noiseParameter,
        isRandomTruePos,
        manualTrueX,
        manualTrueY,
        currentTruePos,
        anchorPlacementMode,
        anchorSigma,
        currentAnchors,
        fireflyPlacementMode,
        fireflySigma,
        currentInitialFireflies,
        isRegenerateFirefliesEveryRun,
        testMode,
        numRuns,
        sweepConfig,
        heatmapResolution,
        isRunning,
        progress,
        logBatches,
        results,
        sweepResults,
        batchAnalysis,
        viewMode,
      },
      setters: {
        setInputWidth,
        setInputLength,
        setFieldWidth,
        setFieldLength,
        setNumAnchors,
        setTxHeight,
        setRxHeight,
        setFreq,
        setTxGain,
        setRxGain,
        setRefCoeff,
        setIterationTimeLimit,
        setMaxIterations,
        setPopulationSize,
        setBeta0,
        setLightAbsorption,
        setAlpha,
        setInitialTemperature,
        setCoolingRate,
        setSelectedModel,
        setSelectedAlgorithm,
        setSelectedFilter,
        setSourceMode,
        setUwbDistanceSigma,
        setIsSolverWeighted,
        setSolverWeightingModel,
        setSolverWeightingBase,
        setSolverWeightingScale,
        setSolverWeightingParam,
        setIsNoiseEnabled,
        setNoiseWeightingModel,
        setNoiseBase,
        setNoiseScale,
        setNoiseParameter,
        setIsRandomTruePos,
        setManualTrueX,
        setManualTrueY,
        setCurrentTruePos,
        setAnchorPlacementMode,
        setAnchorSigma,
        setCurrentAnchors,
        setFireflyPlacementMode,
        setFireflySigma,
        setIsRegenerateFirefliesEveryRun,
        setCurrentInitialFireflies,
        setTestMode,
        setNumRuns,
        setSweepConfig,
        setHeatmapResolution,
        setLogBatches,
        setViewMode,
      },
      actions: {
        handlePresetChange,
        generateAnchors,
        generateFireflies,
        runOptimizationTest,
        cancelTest,
        resetResults,
      },
    }),
    [
      inputWidth,
      inputLength,
      fieldWidth,
      fieldLength,
      fieldPreset,
      numAnchors,
      txHeight,
      rxHeight,
      freq,
      txGain,
      rxGain,
      refCoeff,
      iterationTimeLimit,
      maxIterations,
      populationSize,
      beta0,
      lightAbsorption,
      alpha,
      initialTemperature,
      coolingRate,
      selectedModel,
      selectedAlgorithm,
      selectedFilter,
      sourceMode,
      uwbDistanceSigma,
      isSolverWeighted,
      solverWeightingModel,
      solverWeightingBase,
      solverWeightingScale,
      solverWeightingParam,
      isNoiseEnabled,
      noiseWeightingModel,
      noiseBase,
      noiseScale,
      noiseParameter,
      isRandomTruePos,
      manualTrueX,
      manualTrueY,
      currentTruePos,
      anchorPlacementMode,
      anchorSigma,
      currentAnchors,
      fireflyPlacementMode,
      fireflySigma,
      currentInitialFireflies,
      isRegenerateFirefliesEveryRun,
      testMode,
      numRuns,
      sweepConfig,
      heatmapResolution,
      isRunning,
      progress,
      logBatches,
      results,
      sweepResults,
      batchAnalysis,
      viewMode,
      handlePresetChange,
      generateAnchors,
      generateFireflies,
      runOptimizationTest,
      cancelTest,
      resetResults,
    ],
  );
}
