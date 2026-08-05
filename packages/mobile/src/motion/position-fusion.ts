import type {
  FieldLivePositionSource,
  FusedPositionOutput,
  FieldPoint,
} from "../field";
import type { DeviceMotionSample } from "./device-motion";

export type MotionActivity = "unknown" | "stationary" | "moving";

export interface UwbFusionSample {
  readonly position: FieldPoint;
  readonly receivedAt: number;
}

export interface ConservativePositionFusionOptions {
  readonly predictionHorizonMs?: number;
  readonly smoothingAlpha?: number;
  readonly maxAcceptedSpeedMps?: number;
  readonly maxJumpMeters?: number;
}

export const MAX_MOTION_PREDICTION_MS = 500;
export const DEFAULT_POSITION_SMOOTHING_ALPHA = 0.65;
export const DEFAULT_MAX_ACCEPTED_UWB_SPEED_MPS = 6;
export const DEFAULT_MAX_UWB_JUMP_METERS = 4;

const MIN_ACCEPTED_UWB_STEP_METERS = 0.75;
const MAX_VELOCITY_INTERVAL_MS = 1_500;

/**
 * Conservative UWB-first fusion. Device motion only gates a short prediction
 * along velocity learned from accepted UWB positions. It is deliberately not
 * an inertial-navigation implementation: no acceleration is integrated and no
 * sensor vector is rotated into the field frame.
 */
export class ConservativePositionFusion {
  private readonly predictionHorizonMs: number;
  private readonly smoothingAlpha: number;
  private readonly maxAcceptedSpeedMps: number;
  private readonly maxJumpMeters: number;
  private lastUwb?: {
    readonly position: FieldPoint;
    readonly receivedAt: number;
  };
  private filteredPosition?: FieldPoint;
  private velocity = { xMetersPerSecond: 0, yMetersPerSecond: 0 };
  private activity: MotionActivity = "unknown";
  private motionSensorActive = false;
  private pendingJump?: UwbFusionSample;

  constructor(options: ConservativePositionFusionOptions = {}) {
    this.predictionHorizonMs = boundedPositive(
      options.predictionHorizonMs,
      MAX_MOTION_PREDICTION_MS,
      MAX_MOTION_PREDICTION_MS,
    );
    this.smoothingAlpha = bounded(
      options.smoothingAlpha,
      DEFAULT_POSITION_SMOOTHING_ALPHA,
      0.1,
      1,
    );
    this.maxAcceptedSpeedMps = boundedPositive(
      options.maxAcceptedSpeedMps,
      DEFAULT_MAX_ACCEPTED_UWB_SPEED_MPS,
      DEFAULT_MAX_ACCEPTED_UWB_SPEED_MPS,
    );
    this.maxJumpMeters = boundedPositive(
      options.maxJumpMeters,
      DEFAULT_MAX_UWB_JUMP_METERS,
      DEFAULT_MAX_UWB_JUMP_METERS,
    );
  }

  get lastUwbAt(): number | undefined {
    return this.lastUwb?.receivedAt;
  }

  get lastUwbPosition(): FieldPoint | undefined {
    return this.lastUwb?.position;
  }

  get motionActivity(): MotionActivity {
    return this.activity;
  }

  setMotionSensorActive(active: boolean): void {
    this.motionSensorActive = active;
    if (!active) this.activity = "unknown";
  }

  reset(): void {
    this.lastUwb = undefined;
    this.filteredPosition = undefined;
    this.velocity = { xMetersPerSecond: 0, yMetersPerSecond: 0 };
    this.activity = "unknown";
    this.motionSensorActive = false;
    this.pendingJump = undefined;
  }

  acceptUwb(sample: UwbFusionSample): FusedPositionOutput | undefined {
    if (
      !isFinitePoint(sample.position) ||
      !Number.isFinite(sample.receivedAt)
    ) {
      return undefined;
    }

    const previous = this.lastUwb;
    const previousFiltered = this.filteredPosition;
    if (previous && sample.receivedAt <= previous.receivedAt) return undefined;

    if (previous && previousFiltered) {
      const elapsedMs = sample.receivedAt - previous.receivedAt;
      const jumpMeters = distance(previousFiltered, sample.position);
      const allowedJumpMeters = Math.min(
        this.maxJumpMeters,
        Math.max(
          MIN_ACCEPTED_UWB_STEP_METERS,
          (elapsedMs / 1_000) * this.maxAcceptedSpeedMps + 0.35,
        ),
      );
      if (jumpMeters > allowedJumpMeters) {
        const pending = this.pendingJump;
        const sustainedMovement =
          pending !== undefined &&
          sample.receivedAt > pending.receivedAt &&
          distance(pending.position, sample.position) <=
            Math.max(
              MIN_ACCEPTED_UWB_STEP_METERS,
              ((sample.receivedAt - pending.receivedAt) / 1_000) *
                this.maxAcceptedSpeedMps +
                0.35,
            );
        if (sustainedMovement) {
          this.filteredPosition = sample.position;
          this.velocity = clampVelocity(
            {
              xMetersPerSecond:
                (sample.position.xMeters - previousFiltered.xMeters) /
                (elapsedMs / 1_000),
              yMetersPerSecond:
                (sample.position.yMeters - previousFiltered.yMeters) /
                (elapsedMs / 1_000),
            },
            this.maxAcceptedSpeedMps,
          );
          this.pendingJump = undefined;
          this.lastUwb = {
            position: sample.position,
            receivedAt: sample.receivedAt,
          };
          return this.outputAt(sample.receivedAt, "uwb", false);
        }
        // Keep the last accepted UWB fix authoritative instead of allowing an
        // isolated implausible frame to seed either smoothing or prediction.
        // A second consistent fix is accepted so sustained real movement is
        // never hidden indefinitely by the conservative jump gate.
        this.pendingJump = sample;
        return this.outputAt(sample.receivedAt, "stationary-hold", false);
      }

      this.pendingJump = undefined;

      const filtered =
        elapsedMs > MAX_VELOCITY_INTERVAL_MS
          ? sample.position
          : blend(previousFiltered, sample.position, this.smoothingAlpha);
      this.filteredPosition = filtered;
      this.velocity =
        elapsedMs <= MAX_VELOCITY_INTERVAL_MS
          ? clampVelocity(
              {
                xMetersPerSecond:
                  (filtered.xMeters - previousFiltered.xMeters) /
                  (elapsedMs / 1_000),
                yMetersPerSecond:
                  (filtered.yMeters - previousFiltered.yMeters) /
                  (elapsedMs / 1_000),
              },
              this.maxAcceptedSpeedMps,
            )
          : { xMetersPerSecond: 0, yMetersPerSecond: 0 };
    } else {
      this.filteredPosition = sample.position;
      this.velocity = { xMetersPerSecond: 0, yMetersPerSecond: 0 };
    }

    this.lastUwb = {
      position: sample.position,
      receivedAt: sample.receivedAt,
    };
    return this.outputAt(sample.receivedAt, "uwb", false);
  }

  acceptMotion(sample: DeviceMotionSample): FusedPositionOutput | undefined {
    if (!Number.isFinite(sample.receivedAt)) return undefined;
    this.activity = classifyMotionActivity(sample, this.activity);
    if (!this.lastUwb || !this.filteredPosition) return undefined;

    if (sample.receivedAt < this.lastUwb.receivedAt) {
      return this.outputAt(sample.receivedAt, "uwb", false);
    }
    const ageMs = sample.receivedAt - this.lastUwb.receivedAt;
    if (ageMs > this.predictionHorizonMs) {
      return this.outputAt(sample.receivedAt, "prediction-expired", false);
    }
    if (this.activity === "stationary") {
      // A stationary phone is evidence against extrapolation. Holding the last
      // accepted UWB fix also damps velocity rather than inventing drift.
      this.velocity = {
        xMetersPerSecond: this.velocity.xMetersPerSecond * 0.2,
        yMetersPerSecond: this.velocity.yMetersPerSecond * 0.2,
      };
      return this.outputAt(
        sample.receivedAt,
        ageMs === 0 ? "uwb" : "stationary-hold",
        false,
      );
    }

    if (
      !this.motionSensorActive ||
      this.activity !== "moving" ||
      Math.hypot(
        this.velocity.xMetersPerSecond,
        this.velocity.yMetersPerSecond,
      ) < 0.05
    ) {
      return this.outputAt(sample.receivedAt, "uwb", false);
    }

    const elapsedSeconds = Math.min(ageMs, this.predictionHorizonMs) / 1_000;
    return this.outputAt(sample.receivedAt, "motion-predicted", true, {
      xMeters:
        this.filteredPosition.xMeters +
        this.velocity.xMetersPerSecond * elapsedSeconds,
      yMeters:
        this.filteredPosition.yMeters +
        this.velocity.yMetersPerSecond * elapsedSeconds,
    });
  }

  private outputAt(
    fusedAt: number,
    source: FieldLivePositionSource,
    interpolationActive: boolean,
    position = this.filteredPosition,
  ): FusedPositionOutput | undefined {
    if (!this.lastUwb || !position) return undefined;
    return {
      position,
      source,
      fusedAt,
      freshnessMs: Math.max(0, fusedAt - this.lastUwb.receivedAt),
      lastUwbAt: this.lastUwb.receivedAt,
      lastUwbPosition: this.lastUwb.position,
      interpolationActive,
    };
  }
}

export function classifyMotionActivity(
  sample: DeviceMotionSample,
  previous: MotionActivity = "unknown",
): MotionActivity {
  const acceleration = vectorMagnitude(sample.acceleration);
  const rotationRate = vectorMagnitude(sample.rotationRate);
  const hasSignal = acceleration !== undefined || rotationRate !== undefined;
  if (!hasSignal) return "unknown";

  // Rotation alone cannot establish field translation. It is deliberately
  // treated as an uncertain signal rather than permission to extrapolate.
  const moving = acceleration !== undefined && acceleration >= 1.25;
  if (moving) return "moving";

  if (rotationRate !== undefined && rotationRate >= 45) return "unknown";

  const stationary =
    (acceleration === undefined || acceleration <= 0.35) &&
    (rotationRate === undefined || rotationRate <= 10);
  if (stationary) return "stationary";

  return previous;
}

function vectorMagnitude(
  vector: { readonly x: number; readonly y: number; readonly z: number } | null,
): number | undefined {
  if (!vector) return undefined;
  if (
    !Number.isFinite(vector.x) ||
    !Number.isFinite(vector.y) ||
    !Number.isFinite(vector.z)
  ) {
    return undefined;
  }
  return Math.hypot(vector.x, vector.y, vector.z);
}

function isFinitePoint(point: FieldPoint): boolean {
  return Number.isFinite(point.xMeters) && Number.isFinite(point.yMeters);
}

function distance(first: FieldPoint, second: FieldPoint): number {
  return Math.hypot(
    second.xMeters - first.xMeters,
    second.yMeters - first.yMeters,
  );
}

function blend(
  first: FieldPoint,
  second: FieldPoint,
  alpha: number,
): FieldPoint {
  return {
    xMeters: first.xMeters + (second.xMeters - first.xMeters) * alpha,
    yMeters: first.yMeters + (second.yMeters - first.yMeters) * alpha,
  };
}

function clampVelocity(
  velocity: { xMetersPerSecond: number; yMetersPerSecond: number },
  maximumSpeedMps: number,
): { xMetersPerSecond: number; yMetersPerSecond: number } {
  const speed = Math.hypot(
    velocity.xMetersPerSecond,
    velocity.yMetersPerSecond,
  );
  if (speed <= maximumSpeedMps || speed === 0) return velocity;
  const scale = maximumSpeedMps / speed;
  return {
    xMetersPerSecond: velocity.xMetersPerSecond * scale,
    yMetersPerSecond: velocity.yMetersPerSecond * scale,
  };
}

function bounded(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function boundedPositive(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.min(maximum, value)
    : fallback;
}
