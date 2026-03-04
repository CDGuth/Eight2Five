import { BeaconState } from "../types/BeaconProtocol";

/**
 * Represents raw beacon sample enriched with parsed packets.
 */
export interface BeaconMeasurement {
  mac: string;
  /** Timestamp (ms) most recent packet arrived. */
  lastSeen: number;
  /** Most recent filtered RSSI value (dBm). */
  filteredRssi: number;
  /** Tx power from identity frame if available (dBm). */
  txPower?: number;
  /**
   * Beacon-provided relative coordinates in percent (0-100).
   * Optional because not every advertisement contains the slot yet.
   */
  xPercent?: number;
  yPercent?: number;
  zCm?: number;
}

/**
 * Describes the geometry of field anchors for conversion from percent to meters.
 */
export interface FieldDimensions {
  widthMeters: number;
  lengthMeters: number;
  /** Optional altitude reference for anchors (meters). */
  altitudeMeters?: number;
}

export type EnvironmentMode = "indoor" | "outdoor";

/**
 * Provides heights needed by propagation models.
 */
export interface HeightConfig {
  transmitterHeightMeters: number;
  receiverHeightMeters: number;
}

/**
 * Envelope of constants required by propagation formulas.
 */
export interface PropagationConstants extends HeightConfig {
  /** Carrier frequency in Hz. */
  frequencyHz: number;
  /** Transmitter antenna gain (linear, not dBi). */
  transmitterGain: number;
  /** Receiver antenna gain (linear, not dBi). */
  receiverGain: number;
  /** Reflection coefficient magnitude (0-1). */
  reflectionCoefficient: number;
}

export interface SearchBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * Contract every propagation model must follow. Each model can interpret
 * the optional parameters differently.
 */
export interface PropagationModel {
  estimateRssi(params: {
    distanceMeters: number;
    txPowerDbm: number;
    constants: PropagationConstants;
  }): number;
}

/**
 * Base contract for RSSI smoothing implementations.
 */
export interface RssiFilter {
  filterSample(rssi: number): number;
}

export interface WeightingConfig {
  enabled: boolean;
  model: "linear" | "inverse-rssi";
  base?: number;
  scale?: number;
  param?: number;
}

/**
 * Structure consumed by optimization layers.
 */
export interface OptimizationInput {
  candidate: BeaconMeasurement[];
  anchors: AnchorGeometry[];
  propagation: PropagationModel;
  constants: PropagationConstants;
  bounds: SearchBounds;
  timeBudgetMs?: number;
  iterationTimeLimitMs?: number;
  initialPopulation?: { x: number; y: number }[];
  weighting?: WeightingConfig;
}

export interface AnchorGeometry {
  mac: string;
  /** Absolute meter coordinates of anchor (x, y). */
  x: number;
  y: number;
  /** Optional altitude difference relative to receiver plane. */
  z?: number;
}

export interface AlgorithmDiagnostics {
  executionTimeMs: number;
  evaluations: number;
  iterations: number;
  initialError: number;
  finalError: number;
  finalTemperature?: number;
  initialPopulation?: { x: number; y: number; error: number }[];
  finalPopulation?: { x: number; y: number; error: number }[];
}

export interface PositionEstimate {
  x: number;
  y: number;
  errorRmse: number;
  iterations: number;
  diagnostics?: AlgorithmDiagnostics;
}

/**
 * Optimizer contract that returns a best-effort position in meters.
 */
export interface LocalizationOptimizer {
  solve(opts: OptimizationInput): Promise<PositionEstimate>;
  cancel(): void;
}

/**
 * Exposed API for the localization engine to provide data back to UI.
 */
export interface LocalizationSnapshot {
  beacons: BeaconMeasurement[];
  position?: PositionEstimate;
}

export interface EnvironmentConfigUpdate {
  environment?: EnvironmentMode;
  fieldDimensions?: FieldDimensions;
  propagationConstants?: Partial<PropagationConstants>;
}

export interface LocalizationEngineApi {
  ingest(beacon: BeaconState): void;
  getSnapshot(): LocalizationSnapshot;
  setEnvironment(config: EnvironmentConfigUpdate): void;
  destroy(): void;
}
