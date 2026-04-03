import { BeaconState } from "../types/BeaconProtocol";
import { MFASAOptimizer } from "./algorithms/MFASA";
import {
  DEFAULT_PROPAGATION_CONSTANTS,
  DEFAULT_FIELD_DIMENSIONS,
  DEFAULT_SOLVER_THROTTLE_MS,
  DEFAULT_STALE_BEACON_MS,
  DEFAULT_KALMAN_CONFIG,
  DEFAULT_TX_POWER_DBM,
} from "./LocalizationConfig";
import { KalmanFilter } from "./filters/KalmanFilter";
import { LogNormalModel } from "./models/LogNormalModel";
import { TwoRayGroundModel } from "./models/TwoRayGroundModel";
import {
  BeaconMeasurement,
  EnvironmentConfigUpdate,
  EnvironmentMode,
  FieldConfiguration,
  FieldDimensions,
  LocalizationObservation,
  LocalizationEngineApi,
  OptimizationInput,
  LocalizationOptimizer,
  LocalizationSnapshot,
  PropagationConstants,
  PropagationModel,
  RssiDistanceEstimator,
  SearchBounds,
} from "./types";

export interface LocalizationEngineOptions {
  environment?: EnvironmentMode;
  propagationConstants?: Partial<PropagationConstants>;
  fieldDimensions?: FieldDimensions;
  fieldConfiguration?: FieldConfiguration;
  solverThrottleMs?: number;
  staleBeaconMs?: number;
  rssiDistanceEstimator?: RssiDistanceEstimator;
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
  private readonly rssiDistanceEstimator: RssiDistanceEstimator;
  private fieldConfiguration?: FieldConfiguration;
  private pendingSolve = false;
  private solveTimeout: any = null;
  private snapshot: LocalizationSnapshot = { beacons: [] };
  private directPositionSeenAt = 0;
  private directPositionStaleMs: number;
  private pansDistanceSeenAt = 0;

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
    this.directPositionStaleMs = this.staleBeaconMs;
    this.rssiDistanceEstimator =
      options.rssiDistanceEstimator ?? new GridSearchDistanceEstimator();

    if (options.fieldConfiguration) {
      this.applyFieldConfiguration(options.fieldConfiguration);
    }
  }

  ingest(state: BeaconState) {
    this.ingestObservation({
      mac: state.mac,
      observedAtMs: Date.now(),
      source: "kbeacon",
      measurementKind: "rssi",
      rssiDbm: state.rssi,
      txPowerDbm: state.identity?.txPower,
      xPercent: state.position?.xPercent,
      yPercent: state.position?.yPercent,
      zCm: state.position?.zCm,
    });
  }

  ingestObservation(observation: LocalizationObservation) {
    if (
      observation.measurementKind === "position" &&
      typeof observation.positionXMeters === "number" &&
      typeof observation.positionYMeters === "number"
    ) {
      const qf = observation.quality ?? 100;
      const normalizedError = Math.max(0.01, (101 - qf) / 100);

      this.directPositionSeenAt = observation.observedAtMs;
      this.snapshot = {
        ...this.snapshot,
        position: {
          x: observation.positionXMeters,
          y: observation.positionYMeters,
          errorRmse: normalizedError,
          iterations: 0,
        },
      };
      return;
    }

    const isPansDistanceObservation =
      observation.source.startsWith("pans-ble") &&
      observation.measurementKind === "distance";

    if (isPansDistanceObservation) {
      this.pansDistanceSeenAt = observation.observedAtMs;
    }

    const shouldDropRssiFallback =
      this.hasFreshPansDistance() &&
      observation.measurementKind === "rssi" &&
      !observation.source.startsWith("pans-ble");

    if (shouldDropRssiFallback) {
      return;
    }

    const current = this.beacons.get(observation.mac);
    const previousRssi = current?.filteredRssi;

    const filteredRssi =
      observation.measurementKind === "rssi" &&
      typeof observation.rssiDbm === "number"
        ? this.getFilter(observation.mac).filterSample(observation.rssiDbm)
        : (previousRssi ?? Number.NaN);

    const distanceMeters =
      observation.measurementKind === "distance"
        ? observation.distanceMeters
        : observation.measurementKind === "rssi" &&
            Number.isFinite(filteredRssi)
          ? this.rssiDistanceEstimator.estimateDistanceMeters({
              rssiDbm: filteredRssi,
              txPowerDbm: observation.txPowerDbm ?? DEFAULT_TX_POWER_DBM,
              propagation: this.currentModel,
              constants: this.constants,
              searchBounds: this.bounds,
            })
          : observation.distanceMeters;

    const next: BeaconMeasurement = {
      mac: observation.mac,
      lastSeen: observation.observedAtMs,
      filteredRssi,
      measurementKind: observation.measurementKind,
      distanceMeters,
      quality: observation.quality,
      source: observation.source,
      txPower: observation.txPowerDbm,
      xPercent: observation.xPercent,
      yPercent: observation.yPercent,
      zCm: observation.zCm,
    };

    this.beacons.set(observation.mac, next);
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

  setFieldConfiguration(config?: FieldConfiguration) {
    this.fieldConfiguration = undefined;
    if (!config) {
      return;
    }

    this.applyFieldConfiguration(config);
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
    if (this.hasFreshDirectPosition()) return;
    if (this.pendingSolve) return;
    this.pendingSolve = true;
    this.solveTimeout = setTimeout(() => {
      this.pendingSolve = false;
      this.solveTimeout = null;
      void this.solve();
    }, this.solverThrottleMs);
  }

  private async solve() {
    if (this.hasFreshDirectPosition()) {
      return;
    }

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
    if (!this.fieldConfiguration) {
      return undefined;
    }

    const nowTs = Date.now();
    const fresh = Array.from(this.beacons.values()).filter(
      (beacon) =>
        nowTs - beacon.lastSeen <= this.staleBeaconMs &&
        (Number.isFinite(beacon.distanceMeters) ||
          Number.isFinite(beacon.filteredRssi)),
    );

    if (fresh.length < 3) {
      return undefined;
    }

    const fieldAnchorMap = new Map(
      this.fieldConfiguration.anchors.map((anchor) => [anchor.mac, anchor]),
    );

    const anchors = fresh
      .map((measurement) => fieldAnchorMap.get(measurement.mac))
      .filter((anchor): anchor is NonNullable<typeof anchor> => !!anchor)
      .map((anchor) => ({
        mac: anchor.mac,
        x: anchor.x,
        y: anchor.y,
        z: anchor.z,
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

  private applyFieldConfiguration(config: FieldConfiguration) {
    this.fieldConfiguration = config;
    this.fieldDimensions = config.fieldDimensions;
    this.bounds = {
      xMin: 0,
      xMax: this.fieldDimensions.widthMeters,
      yMin: 0,
      yMax: this.fieldDimensions.lengthMeters,
    };
    this.environment = config.environment;
    this.currentModel =
      this.environment === "outdoor" ? this.outdoorModel : this.indoorModel;
  }

  private hasFreshDirectPosition() {
    if (!this.snapshot.position) return false;

    return Date.now() - this.directPositionSeenAt <= this.directPositionStaleMs;
  }

  private hasFreshPansDistance() {
    return Date.now() - this.pansDistanceSeenAt <= this.staleBeaconMs;
  }
}

class GridSearchDistanceEstimator implements RssiDistanceEstimator {
  estimateDistanceMeters(params: {
    rssiDbm: number;
    txPowerDbm: number;
    propagation: PropagationModel;
    constants: PropagationConstants;
    searchBounds: SearchBounds;
  }): number {
    const { rssiDbm, txPowerDbm, propagation, constants, searchBounds } =
      params;

    const maxDistance = Math.hypot(
      searchBounds.xMax - searchBounds.xMin,
      searchBounds.yMax - searchBounds.yMin,
    );

    let bestDistance = 0.1;
    let bestDiff = Number.POSITIVE_INFINITY;

    const samples = 120;
    for (let i = 1; i <= samples; i += 1) {
      const distanceMeters = (i / samples) * Math.max(1, maxDistance);
      const estimatedRssi = propagation.estimateRssi({
        distanceMeters,
        txPowerDbm,
        constants,
      });

      const diff = Math.abs(rssiDbm - estimatedRssi);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestDistance = distanceMeters;
      }
    }

    return bestDistance;
  }
}
