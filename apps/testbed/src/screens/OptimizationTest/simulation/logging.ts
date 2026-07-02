import {
  BatchAnalysis,
  LogBatch,
  LogEntry,
  RunResult,
  TestMode,
} from "../types";

/**
 * Creates a timestamped log entry for the given message.
 *
 * Pure except for reading `Date.now()`.
 */
export function createLogEntry(message: string): LogEntry {
  return { timestamp: Date.now(), message };
}

/**
 * Creates a new (empty) log batch labelled with the test type.
 *
 * Pure except for reading `Date.now()` for the id/startTime.
 */
export function createLogBatch(
  type: string,
  startTime: number = Date.now(),
): LogBatch {
  return {
    id: startTime,
    startTime,
    entries: [],
    type,
  };
}

/**
 * Returns a new batches array with `entry` prepended to the most recent batch.
 * Returns the input unchanged when there are no batches (matching the hook's
 * previous guard).
 *
 * Pure.
 */
export function prependEntryToBatches(
  batches: LogBatch[],
  entry: LogEntry,
): LogBatch[] {
  if (batches.length === 0) return batches;
  const newBatches = [...batches];
  newBatches[0] = {
    ...newBatches[0],
    entries: [entry, ...newBatches[0].entries],
  };
  return newBatches;
}

/** Configuration values consumed by {@link formatSettingsLog}. */
export interface SettingsLogConfig {
  testMode: TestMode;
  numRuns: string;
  fieldWidth: number;
  fieldLength: number;
  numAnchors: string;
  anchorPlacementMode: string;
  selectedModel: string;
  sourceMode: string;
  selectedAlgorithm: string;
  selectedFilter: string;
  txHeight: string;
  rxHeight: string;
  freq: string;
  txGain: string;
  rxGain: string;
  refCoeff: string;
  iterationTimeLimit: string;
  maxIterations: string;
  populationSize: string;
  beta0: string;
  lightAbsorption: string;
  alpha: string;
  initialTemperature: string;
  coolingRate: string;
  isNoiseEnabled: boolean;
  noiseWeightingModel: string;
  noiseBase: string;
  noiseScale: string;
  noiseParameter: string;
  uwbDistanceSigma: string;
  isSolverWeighted: boolean;
  solverWeightingModel: string;
  solverWeightingBase: string;
  solverWeightingScale: string;
  solverWeightingParam: string;
  isRandomTruePos: boolean;
  manualTrueX: string;
  manualTrueY: string;
}

/**
 * Builds the human-readable "Test Configuration" settings log string.
 *
 * Pure.
 */
export function formatSettingsLog(config: SettingsLogConfig): string {
  return `Test Configuration:
Mode: ${config.testMode}
Runs: ${config.numRuns}
Field: ${config.fieldWidth}m x ${config.fieldLength}m
Anchors: ${config.numAnchors} (${config.anchorPlacementMode})
Model: ${config.selectedModel}
Source Mode: ${config.sourceMode}
Algorithm: ${config.selectedAlgorithm}
Filter: ${config.selectedFilter}

Propagation Constants:
Tx Height: ${config.txHeight}m
Rx Height: ${config.rxHeight}m
Frequency: ${config.freq}Hz
Tx Gain: ${config.txGain}
Rx Gain: ${config.rxGain}
Reflection Coefficient: ${config.refCoeff}

MFASA Options:
Time Limit: ${config.iterationTimeLimit}ms
Max Iterations: ${config.maxIterations}
Population: ${config.populationSize}
Beta0: ${config.beta0}
Light Absorption: ${config.lightAbsorption}
Alpha: ${config.alpha}
Initial Temp: ${config.initialTemperature}
Cooling Rate: ${config.coolingRate}

Simulation Noise:
Enabled: ${config.isNoiseEnabled}
Model: ${config.noiseWeightingModel} (Base: ${config.noiseBase}, Scale: ${config.noiseScale}, Param: ${config.noiseParameter})
UWB Distance Sigma (m): ${config.uwbDistanceSigma}

Solver Weighting:
Enabled: ${config.isSolverWeighted}
${
  config.isSolverWeighted
    ? `Model: ${config.solverWeightingModel} (Base: ${config.solverWeightingBase}, Scale: ${config.solverWeightingScale}, Param: ${config.solverWeightingParam})`
    : "Model: None"
}

True Position: ${config.isRandomTruePos ? "Random" : `Fixed (${config.manualTrueX}, ${config.manualTrueY})`}`;
}

/**
 * Builds the per-run log string for a standard test run.
 *
 * Pure.
 */
export function formatRunLog(
  run: RunResult,
  runIndex: number,
  isRandomTruePos: boolean,
): string {
  return `Run ${runIndex}:
Error: ${run.error.toFixed(2)}m
RSSI RMSE: ${run.rssiRmse.toFixed(2)}
Time: ${run.duration.toFixed(2)}ms
Iterations: ${run.iterations}
Est Pos: (${run.estPos.x.toFixed(2)}, ${run.estPos.y.toFixed(2)})
${isRandomTruePos ? `True Pos: (${run.truePos.x.toFixed(2)}, ${run.truePos.y.toFixed(2)})` : ""}`;
}

/**
 * Builds the per-run log string for a sweep step run.
 *
 * Pure.
 */
export function formatSweepRunLog(
  stepIdx: number,
  runIdx: number,
  paramName: string,
  paramValue: number,
  run: RunResult,
): string {
  return `Step ${stepIdx + 1}, Run ${runIdx + 1} (${paramName}=${paramValue.toFixed(2)}):
Error: ${run.error.toFixed(2)}m
RSSI RMSE: ${run.rssiRmse.toFixed(2)}
Iterations: ${run.iterations}`;
}

/**
 * Builds the summary log string for a completed sweep step.
 *
 * Pure.
 */
export function formatSweepStepLog(
  stepIdx: number,
  paramName: string,
  paramValue: number,
  avgError: number,
  stdDev: number,
  avgIter: number,
): string {
  return `Step ${stepIdx + 1} Summary (${paramName}=${paramValue.toFixed(2)}):
Avg Error: ${avgError.toFixed(3)}m
Std Dev: ${stdDev.toFixed(3)}m
Avg Iter: ${avgIter.toFixed(1)}`;
}

/**
 * Builds the final batch-analysis log string.
 *
 * Pure.
 */
export function formatBatchAnalysisLog(analysis: BatchAnalysis): string {
  return `Batch Analysis:
Avg Error: ${analysis.avgError.toFixed(3)}m
Position RMSE: ${analysis.rmse.toFixed(3)}m
Avg RSSI RMSE: ${analysis.avgRssiRmse.toFixed(3)}
Std Dev: ${analysis.stdDev.toFixed(3)}m
Median: ${analysis.medianError.toFixed(3)}m
Avg Iterations: ${analysis.avgIterations.toFixed(1)}
Min/Max: ${analysis.minError.toFixed(3)}m / ${analysis.maxError.toFixed(3)}m
Avg Time: ${analysis.avgDuration.toFixed(2)}ms
Success <1m: ${analysis.successRate1m.toFixed(1)}%
Success <2m: ${analysis.successRate2m.toFixed(1)}%`;
}
