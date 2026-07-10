export const DEFAULT_FIELD_DIMENSIONS = {
  widthMeters: 100,
  lengthMeters: 100,
};

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
