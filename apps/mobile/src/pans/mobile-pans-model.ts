import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  ManagerError,
  PansDiagnosticsResult,
  PansPosition,
  PansPositionStreamCounters,
  ManagedNetwork,
} from "@eight2five/mobile/pans-manager";
import {
  DEFAULT_DISCOVERY_RSSI_CUTOFF,
  normalizeTransportDeviceId,
} from "@eight2five/mobile/pans-manager";
import type {
  FieldLivePositionState,
  FieldPoint,
} from "@eight2five/mobile/field";
import type { DeviceMotionAdapter } from "@eight2five/mobile/motion";

import type { CreateMobilePansRuntime } from "./mobile-pans-runtime";

export type TagConnectionState =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface MobilePansSnapshot {
  readonly initialization: "loading" | "ready" | "error";
  readonly connectionState: TagConnectionState;
  readonly rememberedTag?: ManagedDevice;
  readonly discoveries: readonly DiscoveredDeviceSnapshot[];
  readonly livePosition: FieldLivePositionState;
  readonly rawPosition?: Readonly<
    Pick<PansPosition, "xMeters" | "yMeters" | "zMeters">
  >;
  readonly lastUpdateAt?: number;
  readonly effectiveUpdateRateHz: number;
  readonly counters?: Readonly<PansPositionStreamCounters>;
  readonly hardwareDiagnostics?: PansDiagnosticsResult;
  readonly knownAnchors: readonly ManagedDevice[];
  readonly networks: readonly ManagedNetwork[];
  readonly activeNetworkId?: string;
  readonly discoveryRssiCutoff: number;
  readonly commissioningWarning?: string;
  readonly diagnosticMessages: readonly string[];
  readonly error?: ManagerError | Error;
}

export interface MobilePansStoreOptions {
  readonly createRuntime?: CreateMobilePansRuntime;
  readonly motionAdapter?: DeviceMotionAdapter;
  readonly motionInterpolationEnabled?: boolean;
  readonly now?: () => number;
  readonly schedule?: typeof setTimeout;
  readonly cancel?: typeof clearTimeout;
  readonly reconnectDelaysMs?: readonly number[];
  readonly staleAfterMs?: number;
  readonly discoveryTimeoutMs?: number;
  readonly developerModeEnabled?: boolean;
}

export const EMPTY_DISCOVERIES: readonly DiscoveredDeviceSnapshot[] =
  Object.freeze([]);
export const DEFAULT_RECONNECT_DELAYS = Object.freeze([500, 1_500, 3_000]);

export const INITIAL_MOBILE_PANS_SNAPSHOT: MobilePansSnapshot = Object.freeze({
  initialization: "loading",
  connectionState: "idle",
  discoveries: EMPTY_DISCOVERIES,
  livePosition: Object.freeze({
    connectionState: "idle",
    isStale: false,
    interpolationActive: false,
  }),
  effectiveUpdateRateHz: 0,
  diagnosticMessages: Object.freeze([]),
  knownAnchors: Object.freeze([]),
  networks: Object.freeze([]),
  discoveryRssiCutoff: DEFAULT_DISCOVERY_RSSI_CUTOFF,
});

/**
 * MVP deployments use an identity-aligned frame: PANS +X is Side 1→Side 2 and
 * PANS +Y is front→back. A calibrated arbitrary-frame transform is deferred.
 */
export function pansPositionToFieldPoint(position: PansPosition): FieldPoint {
  return { xMeters: position.xMeters, yMeters: position.yMeters };
}

export function findDiscovery(
  discoveries: readonly DiscoveredDeviceSnapshot[],
  transportDeviceId: string,
): DiscoveredDeviceSnapshot | undefined {
  const normalized = normalizeTransportDeviceId(transportDeviceId);
  return discoveries.find(
    (item) => normalizeTransportDeviceId(item.transportDeviceId) === normalized,
  );
}

export function isSelectableTagDiscovery(
  discovery: DiscoveredDeviceSnapshot,
): boolean {
  return (
    !discovery.stale &&
    discovery.compatibility === "compatible" &&
    discovery.presence?.role === "tag"
  );
}

export function fieldConnectionState(
  state: TagConnectionState,
): FieldLivePositionState["connectionState"] {
  return state === "scanning" ? "connecting" : state;
}

export function staleLivePosition(
  live: FieldLivePositionState,
  connectionState: FieldLivePositionState["connectionState"],
  errorMessage?: string,
): FieldLivePositionState {
  return {
    ...live,
    connectionState,
    isStale: Boolean(live.position),
    interpolationActive: false,
    ...(errorMessage ? { errorMessage } : {}),
  };
}

export function createLocalId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
