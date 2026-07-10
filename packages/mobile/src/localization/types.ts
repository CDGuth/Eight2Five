/**
 * Measurement consumed by the localization layer after provider parsing.
 * Purely distance/position based: BLE RSSI ranging has been retired in favor
 * of UWB-derived ranges and direct position reports.
 */
export interface BeaconMeasurement {
  mac: string;
  /** Timestamp (ms) most recent sample arrived. */
  lastSeen: number;
  /** Observation mode used to produce this measurement. */
  measurementKind?: "distance" | "position";
  /** Direct ranging distance in meters (e.g. UWB). */
  distanceMeters?: number;
  /** Optional quality factor on the observation. */
  quality?: number;
  /** Source provider identifier for diagnostics. */
  source?: string;
}

/**
 * Describes the geometry of field anchors for the optimizer.
 */
export interface FieldDimensions {
  widthMeters: number;
  lengthMeters: number;
  /** Optional altitude reference for anchors (meters). */
  altitudeMeters?: number;
}

export type EnvironmentMode = "indoor" | "outdoor";

export interface SearchBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface AnchorGeometry {
  mac: string;
  /** Absolute meter coordinates of anchor (x, y). */
  x: number;
  y: number;
  /** Optional altitude difference relative to receiver plane. */
  z?: number;
}

export interface FieldConfiguration {
  id: string;
  name?: string;
  /** Descriptive only; the distance-based solver does not branch on it. */
  environment: EnvironmentMode;
  fieldDimensions: FieldDimensions;
  anchors: AnchorGeometry[];
}

export interface FieldConfigurationStore {
  getFieldConfiguration(fieldId: string): FieldConfiguration | undefined;
  setFieldConfiguration(config: FieldConfiguration): void;
  listFieldConfigurations(): FieldConfiguration[];
  removeFieldConfiguration(fieldId: string): void;
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
 * Structure consumed by optimization layers.
 */
export interface OptimizationInput {
  candidate: BeaconMeasurement[];
  anchors: AnchorGeometry[];
  bounds: SearchBounds;
  timeBudgetMs?: number;
  iterationTimeLimitMs?: number;
  initialPopulation?: { x: number; y: number }[];
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
}

export interface LocalizationEngineApi {
  ingestObservation(observation: LocalizationObservation): void;
  getSnapshot(): LocalizationSnapshot;
  setEnvironment(config: EnvironmentConfigUpdate): void;
  setFieldConfiguration(config?: FieldConfiguration): void;
  destroy(): void;
}

export interface LocalizationObservation {
  mac: string;
  observedAtMs: number;
  source: string;
  measurementKind: "distance" | "position";
  distanceMeters?: number;
  positionXMeters?: number;
  positionYMeters?: number;
  positionZMeters?: number;
  quality?: number;
}
