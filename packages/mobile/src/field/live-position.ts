import type { SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "./types";

export type FieldConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

/** Describes which source produced the current field position. */
export type FieldLivePositionSource =
  | "uwb"
  | "motion-predicted"
  | "stationary-hold"
  | "prediction-expired";

/**
 * The high-rate output of the live-position fusion boundary.
 *
 * UWB is always the authority for `lastUwbPosition`. Motion may only produce
 * a short prediction along the velocity learned from accepted UWB samples.
 */
export interface FusedPositionOutput {
  readonly position: FieldPoint;
  readonly source: FieldLivePositionSource;
  readonly fusedAt: number;
  readonly freshnessMs: number;
  readonly lastUwbAt: number;
  readonly lastUwbPosition: FieldPoint;
  readonly interpolationActive: boolean;
}

export interface FieldLivePositionState {
  readonly connectionState: FieldConnectionState;
  readonly position?: FieldPoint;
  readonly receivedAt?: number;
  readonly isStale: boolean;
  readonly source?: FieldLivePositionSource;
  readonly freshnessMs?: number;
  readonly lastUwbAt?: number;
  readonly lastUwbPosition?: FieldPoint;
  readonly interpolationActive?: boolean;
  readonly errorMessage?: string;
}

/**
 * Thread 4 can update the shared values on the streaming cadence while
 * replacing low-rate state only for connection, stale, and HUD changes.
 */
export interface FieldLivePositionInput {
  readonly state: FieldLivePositionState;
  readonly positionValue?: SharedValue<FieldPoint | null>;
  readonly fusionValue?: SharedValue<FusedPositionOutput | null>;
}

export const EMPTY_FIELD_LIVE_POSITION_STATE: FieldLivePositionState =
  Object.freeze({
    connectionState: "idle",
    isStale: false,
    interpolationActive: false,
  });
