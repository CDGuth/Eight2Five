import type { DeviceMotionMeasurement } from "expo-sensors";

export interface DeviceMotionVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A timestamped, platform-neutral motion event used by the fusion boundary. */
export interface DeviceMotionSample {
  /** Receipt time in the same clock as PANS samples. */
  readonly receivedAt: number;
  /** Linear acceleration only; never integrated or rotated into field space. */
  readonly acceleration: DeviceMotionVector | null;
  /** Angular speed is used only as a conservative activity signal. */
  readonly rotationRate: DeviceMotionVector | null;
}

export type DeviceMotionStartResult =
  | "active"
  | "unavailable"
  | "permission-denied";

export interface DeviceMotionSubscription {
  remove(): void;
}

/**
 * Injectable boundary around the native motion sensor. Implementations must
 * not turn acceleration into a position estimate.
 */
export interface DeviceMotionAdapter {
  start(
    listener: (sample: DeviceMotionSample) => void,
  ): Promise<DeviceMotionStartResult>;
  stop(): void;
}

export interface DeviceMotionSensorLike {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<{ readonly granted: boolean }>;
  requestPermissionsAsync(): Promise<{ readonly granted: boolean }>;
  setUpdateInterval(intervalMs: number): void;
  addListener(
    listener: (measurement: DeviceMotionMeasurement) => void,
  ): DeviceMotionSubscription;
}

export const DEVICE_MOTION_UPDATE_INTERVAL_MS = 100;

/**
 * Expo's DeviceMotion API is intentionally kept behind this adapter so Jest
 * and non-native environments can inject a deterministic source.
 */
export class ExpoDeviceMotionAdapter implements DeviceMotionAdapter {
  private subscription?: DeviceMotionSubscription;
  private lifecycleToken = 0;

  constructor(
    sensor: DeviceMotionSensorLike | undefined = undefined,
    private readonly now: () => number = Date.now,
  ) {
    this.sensor = sensor;
  }

  private sensor?: DeviceMotionSensorLike;

  async start(
    listener: (sample: DeviceMotionSample) => void,
  ): Promise<DeviceMotionStartResult> {
    if (this.subscription) return "active";
    const token = ++this.lifecycleToken;

    try {
      const sensor = await this.getSensor();
      if (token !== this.lifecycleToken) return "unavailable";

      if (!(await sensor.isAvailableAsync())) return "unavailable";
      if (token !== this.lifecycleToken) return "unavailable";

      let permission = await sensor.getPermissionsAsync();
      if (token !== this.lifecycleToken) return "unavailable";
      if (!permission.granted) {
        permission = await sensor.requestPermissionsAsync();
      }
      if (token !== this.lifecycleToken) return "unavailable";
      if (!permission.granted) return "permission-denied";

      sensor.setUpdateInterval(DEVICE_MOTION_UPDATE_INTERVAL_MS);
      this.subscription = sensor.addListener((measurement) => {
        listener(normalizeDeviceMotionMeasurement(measurement, this.now()));
      });
      return "active";
    } catch {
      this.stop();
      return "unavailable";
    }
  }

  stop(): void {
    ++this.lifecycleToken;
    const subscription = this.subscription;
    this.subscription = undefined;
    subscription?.remove();
  }

  private async getSensor(): Promise<DeviceMotionSensorLike> {
    if (this.sensor) return this.sensor;
    const sensors = await import("expo-sensors");
    this.sensor = sensors.DeviceMotion;
    return this.sensor;
  }
}

export function createExpoDeviceMotionAdapter(
  sensor?: DeviceMotionSensorLike,
  now: () => number = Date.now,
): DeviceMotionAdapter {
  return new ExpoDeviceMotionAdapter(sensor, now);
}

function normalizeDeviceMotionMeasurement(
  measurement: DeviceMotionMeasurement,
  receivedAt: number,
): DeviceMotionSample {
  return {
    receivedAt,
    acceleration: normalizeVector(measurement.acceleration),
    rotationRate: normalizeVector(measurement.rotationRate),
  };
}

function normalizeVector(
  value:
    | { readonly x: number; readonly y: number; readonly z: number }
    | { readonly alpha: number; readonly beta: number; readonly gamma: number }
    | null
    | undefined,
): DeviceMotionVector | null {
  if (!value) return null;
  if ("x" in value) {
    return { x: value.x, y: value.y, z: value.z };
  }
  return { x: value.alpha, y: value.beta, z: value.gamma };
}
