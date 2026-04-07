import {
  AlgorithmDiagnostics,
  AnchorGeometry,
  BeaconMeasurement,
  PropagationConstants,
} from "@eight2five/shared/localization/types";

export type TestMode = "standard" | "sweep";
export type SimulationSourceMode = "ble-rssi" | "uwb-distance" | "hybrid";

export interface RunParameters {
  iterationTimeLimitMs: number;
  maxIterations: number;
  populationSize: number;
  beta0: number;
  lightAbsorption: number;
  alpha: number;
  initialTemperature: number;
  coolingRate: number;
  solverWeightingBase: number;
  solverWeightingScale: number;
  solverWeightingParam: number;
  [key: string]: number;
}

export interface SweepConfig {
  param: string;
  min: string;
  max: string;
  step: string;
  runsPerStep: string;
}

export interface RunResult {
  id: number;
  params: Partial<RunParameters>;
  truePos: { x: number; y: number };
  estPos: { x: number; y: number };
  error: number;
  rssiRmse: number;
  duration: number;
  iterations: number;
  initialPopulation?: { x: number; y: number }[];
  finalPopulation?: { x: number; y: number }[];
  anchors: AnchorGeometry[];
  measurements: BeaconMeasurement[];
  modelType: string;
  sourceMode?: SimulationSourceMode;
  measurementKinds?: ("rssi" | "distance")[];
  constants: PropagationConstants;
  diagnostics?: AlgorithmDiagnostics;
}

export interface SweepStepResult {
  val: number;
  avgError: number;
  stdDev: number;
  avgIterations: number;
  runs: RunResult[];
}

export interface BatchAnalysis {
  avgError: number;
  stdDev: number;
  rmse: number;
  avgRssiRmse: number;
  medianError: number;
  minError: number;
  maxError: number;
  avgDuration: number;
  avgIterations: number;
  successRate1m: number;
  successRate2m: number;
  totalRuns: number;
  bestRuns: RunResult[];
}

export interface LogEntry {
  timestamp: number;
  message: string;
}

export interface LogBatch {
  id: number;
  startTime: number;
  entries: LogEntry[];
  type: string;
}

export const FIELD_PRESETS = [
  { label: "Custom", value: "custom", width: 100, length: 100 },
  {
    label: "Football Field",
    value: "football",
    width: 109.73,
    length: 48.77,
  },
];
