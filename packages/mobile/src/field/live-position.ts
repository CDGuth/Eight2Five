import type { SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "./types";

export type FieldConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface FieldLivePositionState {
  readonly connectionState: FieldConnectionState;
  readonly position?: FieldPoint;
  readonly receivedAt?: number;
  readonly isStale: boolean;
  readonly errorMessage?: string;
}

/**
 * Thread 4 can update positionValue on its streaming cadence while replacing
 * state only for connection, stale, and human-readable HUD changes.
 */
export interface FieldLivePositionInput {
  readonly state: FieldLivePositionState;
  readonly positionValue?: SharedValue<FieldPoint | null>;
}

export const EMPTY_FIELD_LIVE_POSITION_STATE: FieldLivePositionState =
  Object.freeze({
    connectionState: "idle",
    isStale: false,
  });
