import { MFASAOptimizer } from "./algorithms/MFASA";
import {
  DEFAULT_FIELD_DIMENSIONS,
  DEFAULT_SOLVER_THROTTLE_MS,
  DEFAULT_STALE_BEACON_MS,
} from "./LocalizationConfig";
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
  SearchBounds,
} from "./types";

export interface LocalizationEngineOptions {
  environment?: EnvironmentMode;
  fieldDimensions?: FieldDimensions;
  fieldConfiguration?: FieldConfiguration;
  solverThrottleMs?: number;
  staleBeaconMs?: number;
}

/**
 * Orchestrates UWB distance/position ingestion and MFASA optimization. The
 * previous RSSI path-loss / Kalman RSSI-smoothing pipeline has been removed;
 * all measurements now come from direct ranging or position frames.
 */
export class LocalizationEngine implements LocalizationEngineApi {
  private readonly beacons = new Map<string, BeaconMeasurement>();
  private readonly optimizer: LocalizationOptimizer;
  private fieldDimensions: FieldDimensions;
  private bounds: SearchBounds;
  private environment: EnvironmentMode;
  private solverThrottleMs: number;
  private staleBeaconMs: number;
  private fieldConfiguration?: FieldConfiguration;
  private pendingSolve = false;
  private solveTimeout: any = null;
  private snapshot: LocalizationSnapshot = { beacons: [] };
  private directPositionSeenAt = 0;
  private directPositionStaleMs: number;

  constructor(options: LocalizationEngineOptions = {}) {
    this.optimizer = new MFASAOptimizer();

    this.environment = options.environment ?? "outdoor";
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

    if (options.fieldConfiguration) {
      this.applyFieldConfiguration(options.fieldConfiguration);
    }
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

    if (observation.measurementKind !== "distance") {
      return;
    }

    const next: BeaconMeasurement = {
      mac: observation.mac,
      lastSeen: observation.observedAtMs,
      measurementKind: "distance",
      distanceMeters: observation.distanceMeters,
      quality: observation.quality,
      source: observation.source,
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
  }

  setFieldConfiguration(config?: FieldConfiguration) {
    this.fieldConfiguration = undefined;
    if (!config) {
      return;
    }

    this.applyFieldConfiguration(config);
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
        Number.isFinite(beacon.distanceMeters),
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
  }

  private hasFreshDirectPosition() {
    if (!this.snapshot.position) return false;

    return Date.now() - this.directPositionSeenAt <= this.directPositionStaleMs;
  }
}
