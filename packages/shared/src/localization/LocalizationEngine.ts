import { BeaconState } from "../types/BeaconProtocol";
import { MFASAOptimizer } from "./algorithms/MFASA";
import {
  DEFAULT_PROPAGATION_CONSTANTS,
  DEFAULT_FIELD_DIMENSIONS,
  DEFAULT_SOLVER_THROTTLE_MS,
  DEFAULT_STALE_BEACON_MS,
  DEFAULT_KALMAN_CONFIG,
} from "./LocalizationConfig";
import { KalmanFilter } from "./filters/KalmanFilter";
import { LogNormalModel } from "./models/LogNormalModel";
import { TwoRayGroundModel } from "./models/TwoRayGroundModel";
import {
  BeaconMeasurement,
  EnvironmentConfigUpdate,
  EnvironmentMode,
  FieldDimensions,
  LocalizationEngineApi,
  OptimizationInput,
  LocalizationOptimizer,
  LocalizationSnapshot,
  PropagationConstants,
  PropagationModel,
  SearchBounds,
} from "./types";

export interface LocalizationEngineOptions {
  environment?: EnvironmentMode;
  propagationConstants?: Partial<PropagationConstants>;
  fieldDimensions?: FieldDimensions;
  solverThrottleMs?: number;
  staleBeaconMs?: number;
}

/**
 * Orchestrates the Kalman filtering, distance modeling, and MFASA optimization.
 */
export class LocalizationEngine implements LocalizationEngineApi {
  private readonly filters = new Map<string, KalmanFilter>();
  private readonly beacons = new Map<string, BeaconMeasurement>();
  private readonly optimizer: LocalizationOptimizer;
  private indoorModel: PropagationModel;
  private outdoorModel: PropagationModel;
  private currentModel: PropagationModel;
  private constants: PropagationConstants;
  private fieldDimensions: FieldDimensions;
  private bounds: SearchBounds;
  private environment: EnvironmentMode;
  private solverThrottleMs: number;
  private staleBeaconMs: number;
  private pendingSolve = false;
  private solveTimeout: any = null;
  private snapshot: LocalizationSnapshot = { beacons: [] };

  constructor(options: LocalizationEngineOptions = {}) {
    this.optimizer = new MFASAOptimizer();
    this.indoorModel = new LogNormalModel();
    this.outdoorModel = new TwoRayGroundModel();

    this.environment = options.environment ?? "outdoor";
    this.currentModel =
      this.environment === "outdoor" ? this.outdoorModel : this.indoorModel;

    this.constants = {
      ...DEFAULT_PROPAGATION_CONSTANTS,
      ...options.propagationConstants,
    };

    this.fieldDimensions = options.fieldDimensions ?? DEFAULT_FIELD_DIMENSIONS;
    this.bounds = {
      xMin: 0,
      xMax: this.fieldDimensions.widthMeters,
      yMin: 0,
      yMax: this.fieldDimensions.lengthMeters,
    };

    this.solverThrottleMs =
      options.solverThrottleMs ?? DEFAULT_SOLVER_THROTTLE_MS;
    this.staleBeaconMs = options.staleBeaconMs ?? DEFAULT_STALE_BEACON_MS;
  }

  ingest(state: BeaconState) {
    const filter = this.getFilter(state.mac);
    const filteredRssi = filter.filterSample(state.rssi);

    const next: BeaconMeasurement = {
      mac: state.mac,
      lastSeen: Date.now(),
      filteredRssi,
      txPower: state.identity?.txPower,
      xPercent: state.position?.xPercent,
      yPercent: state.position?.yPercent,
      zCm: state.position?.zCm,
    };

    this.beacons.set(state.mac, next);
    this.snapshot = {
      ...this.snapshot,
      beacons: Array.from(this.beacons.values()),
    };
    this.scheduleSolve();
  }

  getSnapshot(): LocalizationSnapshot {
    return {
      position: this.snapshot.position,
      beacons: Array.from(this.beacons.values()),
    };
  }

  setEnvironment(config: EnvironmentConfigUpdate) {
    if (config.environment) {
      this.environment = config.environment;
      this.currentModel =
        this.environment === "outdoor" ? this.outdoorModel : this.indoorModel;
    }

    if (config.fieldDimensions) {
      this.fieldDimensions = config.fieldDimensions;
      this.bounds = {
        xMin: 0,
        xMax: this.fieldDimensions.widthMeters,
        yMin: 0,
        yMax: this.fieldDimensions.lengthMeters,
      };
    }

    if (config.propagationConstants) {
      this.constants = {
        ...this.constants,
        ...config.propagationConstants,
      };
    }
  }

  private getFilter(mac: string) {
    if (!this.filters.has(mac)) {
      this.filters.set(
        mac,
        new KalmanFilter({
          processNoise: DEFAULT_KALMAN_CONFIG.processNoise,
          measurementNoise: DEFAULT_KALMAN_CONFIG.measurementNoise,
        }),
      );
    }
    return this.filters.get(mac)!;
  }

  destroy() {
    if (this.solveTimeout) {
      clearTimeout(this.solveTimeout);
      this.solveTimeout = null;
    }
    this.optimizer.cancel();
  }

  private scheduleSolve() {
    if (this.pendingSolve) return;
    this.pendingSolve = true;
    this.solveTimeout = setTimeout(() => {
      this.pendingSolve = false;
      this.solveTimeout = null;
      void this.solve();
    }, this.solverThrottleMs);
  }

  private async solve() {
    const input = this.buildOptimizationInput();
    if (!input) {
      return;
    }

    try {
      const position = await this.optimizer.solve(input);
      this.snapshot = {
        beacons: input.candidate,
        position,
      };
    } catch (error) {
      console.error("Localization solve failed", error);
    }
  }

  private buildOptimizationInput(): OptimizationInput | undefined {
    const nowTs = Date.now();
    const fresh = Array.from(this.beacons.values()).filter(
      (beacon) => nowTs - beacon.lastSeen <= this.staleBeaconMs,
    );

    if (fresh.length < 3) {
      return undefined;
    }

    const anchors = fresh
      .filter(
        (beacon) =>
          beacon.xPercent !== undefined && beacon.yPercent !== undefined,
      )
      .map((beacon) => ({
        mac: beacon.mac,
        x: ((beacon.xPercent ?? 0) / 100) * this.fieldDimensions.widthMeters,
        y: ((beacon.yPercent ?? 0) / 100) * this.fieldDimensions.lengthMeters,
      }));

    if (anchors.length < 3) {
      return undefined;
    }

    return {
      candidate: fresh,
      anchors,
      propagation: this.currentModel,
      constants: this.constants,
      bounds: this.bounds,
      timeBudgetMs: this.solverThrottleMs / 2,
    };
  }
}
