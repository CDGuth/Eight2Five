import { PropagationConstants } from "./types";

/**
 * Centralized defaults for propagation constants. Values come from the paper's
 * simulation setup unless overridden by user input.
 */
export const DEFAULT_PROPAGATION_CONSTANTS: PropagationConstants = {
  transmitterHeightMeters: 4,
  receiverHeightMeters: 1,
  frequencyHz: 2.4e9,
  transmitterGain: 1,
  receiverGain: 1,
  reflectionCoefficient: 1,
};

export const DEFAULT_FIELD_DIMENSIONS = {
  widthMeters: 100,
  lengthMeters: 100,
};

export const DEFAULT_TX_POWER_DBM = 8;

export const DEFAULT_SIMULATION_NOISE = {
  baseSigma: 2.0,
  distanceSlope: 0.05,
} as const;

export const DEFAULT_ANCHOR_SIGMA = 0.0;

export const DEFAULT_KALMAN_CONFIG = {
  processNoise: 0.01,
  measurementNoise: 4.0,
} as const;

export const DEFAULT_MFASA_OPTIONS = {
  populationSize: 25,
  maxIterations: 200,
  beta0: 2,
  lightAbsorption: 0.1,
  alpha: 0.2,
  randomStepScale: 1,
  initialTemperature: 10,
  coolingRate: 0.95,
  timeBudgetMs: 200,
} as const;

export const DEFAULT_SOLVER_THROTTLE_MS = 500;
export const DEFAULT_STALE_BEACON_MS = 5000;
