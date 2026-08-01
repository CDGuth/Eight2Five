import type {
  PansBleDevice,
  PansDecoderDiagnostic,
  PansDeviceInfo,
  PansDistance,
  PansAnchorList,
  PansClusterInfo,
  PansLocationDataMode,
  PansNodeRole,
  PansOperationMode,
  PansPosition as ExpoPansPosition,
  PansPresenceData,
  PansTagUpdateRate,
  PansUwbMode,
} from "expo-pans-ble-api";
import type { ManagerErrorCode } from "./errors";
import type { MapAreaMode, MapUnits } from "./map-units";

export type PansPosition = ExpoPansPosition;

export interface CoordinateBounds {
  minXMeters: number;
  maxXMeters: number;
  minYMeters: number;
  maxYMeters: number;
  minZMeters: number;
  maxZMeters: number;
}

export interface DefaultTagModeSettings {
  locationEngineEnabled: boolean;
  lowPowerModeEnabled: boolean;
  stationaryDetectionEnabled: boolean;
  locationDataMode: PansLocationDataMode;
  movingUpdateRateMs: number;
  stationaryUpdateRateMs: number;
}

export interface ManagedNetworkSettings {
  mapUnits: MapUnits;
  mapAreaMode: MapAreaMode;
  coordinateBounds: CoordinateBounds;
  defaultAnchorHeightMeters: number;
  staleDeviceTimeoutMs: number;
  defaultTagMode: DefaultTagModeSettings;
  autoConnect: boolean;
  positionLogRetentionDays: number;
  positionLogMaxSamples: number;
}

export const DEFAULT_MANAGED_NETWORK_SETTINGS: ManagedNetworkSettings = {
  mapUnits: "metric",
  mapAreaMode: "infinite",
  coordinateBounds: {
    minXMeters: -1_000,
    maxXMeters: 1_000,
    minYMeters: -1_000,
    maxYMeters: 1_000,
    minZMeters: -100,
    maxZMeters: 100,
  },
  defaultAnchorHeightMeters: 2,
  staleDeviceTimeoutMs: 10_000,
  defaultTagMode: {
    locationEngineEnabled: true,
    lowPowerModeEnabled: false,
    stationaryDetectionEnabled: true,
    locationDataMode: 0,
    movingUpdateRateMs: 100,
    stationaryUpdateRateMs: 1_000,
  },
  autoConnect: false,
  positionLogRetentionDays: 30,
  positionLogMaxSamples: 100_000,
};

/**
 * A saved app-side network profile. Its PAN ID describes the hardware state
 * that profile members are expected to use; the record is not a live view of
 * the physical PANS network.
 */
export interface ManagedNetwork {
  id: string;
  name: string;
  panId: number;
  settings: ManagedNetworkSettings;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

/** More explicit alias for new call sites without changing the stored schema. */
export type ManagedNetworkProfile = ManagedNetwork;

export interface ManagedDeviceConfigBase {
  label?: string;
  panId?: number;
  role: PansNodeRole;
  uwbMode: PansUwbMode;
  /** Absent on caches created before this field was read from hardware. */
  selectedFirmware?: 1 | 2;
  ledEnabled: boolean;
  firmwareUpdateEnabled: boolean;
}

export interface ManagedTagConfig extends ManagedDeviceConfigBase {
  role: "tag";
  locationEngineEnabled: boolean;
  lowPowerModeEnabled: boolean;
  stationaryDetectionEnabled: boolean;
  /** Optional because some firmware does not expose this readable characteristic. */
  locationDataMode?: PansLocationDataMode;
  movingUpdateRateMs?: number;
  stationaryUpdateRateMs?: number;
}

export interface ManagedAnchorConfig extends ManagedDeviceConfigBase {
  role: "anchor";
  initiatorEnabled: boolean;
  position?: PansPosition;
}

export type ManagedDeviceConfig = ManagedTagConfig | ManagedAnchorConfig;

/** App-only fields which may be independently saved without a BLE session. */
export interface LocalDeviceChanges {
  /** @deprecated PANS device nicknames are retained for database compatibility only. */
  nickname?: string | undefined;
  /** @deprecated PANS device notes are retained for database compatibility only. */
  notes?: string | undefined;
}

/**
 * Sparse, explicitly dirty hardware fields. PAN and tag update rates are
 * intentionally excluded: profile assignment/migration own PAN writes and the
 * current native API exposes update rates as read-only.
 */
export interface HardwareDeviceChanges {
  label?: string;
  role?: PansNodeRole;
  uwbMode?: PansUwbMode;
  selectedFirmware?: 1 | 2;
  ledEnabled?: boolean;
  firmwareUpdateEnabled?: boolean;
  initiatorEnabled?: boolean;
  position?: PansPosition;
  locationEngineEnabled?: boolean;
  lowPowerModeEnabled?: boolean;
  stationaryDetectionEnabled?: boolean;
  locationDataMode?: PansLocationDataMode;
}

export interface DeviceConfigurationDiff {
  localChanges: LocalDeviceChanges;
  hardwareChanges: HardwareDeviceChanges;
}

export interface ManagedDevice {
  id: string;
  /** Cached profile match derived from the last hardware-verified PAN ID. */
  networkId?: string;
  transportDeviceId: string;
  macAddress?: string;
  nodeIdHex?: string;
  /** @deprecated Retained only for database/import compatibility. */
  nickname?: string;
  /** Legacy hardware label cache. Prefer lastKnownConfig.label. */
  label?: string;
  role?: PansNodeRole;
  /** Cached configuration from the last hardware read or write attempt. */
  lastKnownConfig?: ManagedDeviceConfig;
  lastSeenAt?: number;
  /** @deprecated Retained only for database/import compatibility. */
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type DeviceCompatibility =
  | "compatible"
  | "unknown"
  | "incompatible"
  | "malformed";

export interface DiscoveredDeviceSnapshot {
  transportDeviceId: string;
  macAddress?: string;
  name?: string;
  rssi: number;
  lastSeenAt: number;
  presence?: PansPresenceData;
  compatibility: DeviceCompatibility;
  firstSeenAt?: number;
  stale?: boolean;
  reason?: string;
  rawDevice?: PansBleDevice;
}

export type VerifiedWriteStatus =
  | "verified"
  | "written-unverified"
  | "mismatch"
  | "failed"
  | "skipped";

export interface VerifiedWrite {
  field: string;
  status: VerifiedWriteStatus;
  requested?: unknown;
  actual?: unknown;
  warning?: string;
  errorCode?: ManagerErrorCode;
}

export interface PansInspectionResult {
  deviceId: string;
  transportDeviceId: string;
  inspectedAt: number;
  label?: string;
  panId?: number;
  operationMode: PansOperationMode;
  locationDataMode?: PansLocationDataMode;
  updateRate?: PansTagUpdateRate;
  deviceInfo?: PansDeviceInfo;
  warnings: string[];
}

export type PansDiagnosticsSection =
  | "label"
  | "pan"
  | "deviceInfo"
  | "locationDataMode"
  | "updateRate"
  | "clusterInfo"
  | "anchorList"
  | "statistics"
  | "anchorMacStats";

export interface PansDiagnosticsWarning {
  section: PansDiagnosticsSection;
  code: ManagerErrorCode;
  message: string;
}

/** A single explicit connected read. Operation mode is the only required section. */
export interface PansDiagnosticsResult {
  deviceId: string;
  transportDeviceId: string;
  capturedAt: number;
  operationMode: PansOperationMode;
  label?: string;
  panId?: number;
  deviceInfo?: PansDeviceInfo;
  locationDataMode?: PansLocationDataMode;
  updateRate?: PansTagUpdateRate;
  clusterInfo?: PansClusterInfo;
  anchorList?: PansAnchorList;
  statistics?: number[];
  anchorMacStats?: number[];
  warnings: PansDiagnosticsWarning[];
}

export type ConfigurationOutcome = "verified" | "partial" | "failure";

export interface PansConfigurationResult {
  deviceId: string;
  transportDeviceId: string;
  outcome: ConfigurationOutcome;
  inspected?: PansInspectionResult;
  writes: VerifiedWrite[];
  warnings: string[];
  error?: { code: ManagerErrorCode; message: string };
}

export type BatchOperationStatus = "running" | "completed" | "cancelled";

export type BatchItemStatus =
  | "pending"
  | "connecting"
  | "writing"
  | "verifying"
  | "succeeded"
  | "failed"
  | "skipped";

export interface PansBatchOperationRecord {
  id: string;
  type: string;
  status: BatchOperationStatus;
  totalItems: number;
  completedItems: number;
  startedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface PansBatchOperationItem {
  batchId: string;
  deviceId: string;
  index: number;
  status: BatchItemStatus;
  attempts: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: { code: ManagerErrorCode; message: string };
}

export interface PositionLogSession {
  id: string;
  networkId: string;
  panId: number;
  deviceId: string;
  startedAt: number;
  endedAt?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface PositionLogSample {
  sessionId: string;
  sequence: number;
  timestampMs: number;
  networkId: string;
  panId: number;
  deviceId: string;
  nodeId?: string;
  label?: string;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  quality: number;
  solver: string;
  anchorCount: number;
  distances?: PansDistance[];
  notes?: string;
  eventMarker?: string;
}

export interface PansTopologyObservation {
  deviceId: string;
  transportDeviceId: string;
  observedAt: number;
  localNodeIdHex?: string;
  anchorList?: PansAnchorList;
  clusterInfo?: PansClusterInfo;
  errors: string[];
}

export interface ObservedTopologyNode {
  key: string;
  nodeIdHex?: string;
  localDeviceId?: string;
  observedByDeviceIds: string[];
}

export interface ObservedTopologyEdge {
  sourceKey: string;
  targetKey: string;
  observedByDeviceId: string;
}

/** A point-in-time observation, never a claim that missing edges cannot communicate. */
export interface ObservedPansTopology {
  observedAt: number;
  nodes: ObservedTopologyNode[];
  edges: ObservedTopologyEdge[];
  observations: PansTopologyObservation[];
  uncertainty: string;
}

export interface PansPositionStreamSample {
  deviceId: string;
  transportDeviceId: string;
  receivedAt: number;
  source: "initial-read" | "notification";
  position?: PansPosition;
  distances: PansDistance[];
  diagnostics: string[];
  decoderDiagnostics: PansDecoderDiagnostic[];
  nativeSequence?: number;
  nativeMonotonicTimestampMs?: number;
  payloadLength?: number;
}

export interface DeviceConfigurationSnapshot {
  deviceId: string;
  capturedAt: number;
  config: ManagedDeviceConfig;
  inspection?: PansInspectionResult;
}

export interface PansManagerSettings {
  discoveryStaleAfterMs: number;
  connectionTimeoutMs: number;
  positionLogMemoryCap: number;
  positionLogFlushSize: number;
  /** Stable local device identity selected by the performer app. */
  rememberedTagDeviceId?: string;
}

export const DEFAULT_PANS_MANAGER_SETTINGS: PansManagerSettings = {
  discoveryStaleAfterMs: 10_000,
  connectionTimeoutMs: 10_000,
  positionLogMemoryCap: 1_000,
  positionLogFlushSize: 100,
};

export function normalizePansManagerSettings(
  settings?: Partial<PansManagerSettings>,
): PansManagerSettings {
  const compatible = { ...(settings ?? {}) } as Partial<PansManagerSettings> &
    Record<string, unknown>;
  delete compatible.discoveryScanDurationMs;
  if (
    compatible.rememberedTagDeviceId !== undefined &&
    (typeof compatible.rememberedTagDeviceId !== "string" ||
      !compatible.rememberedTagDeviceId.trim())
  ) {
    delete compatible.rememberedTagDeviceId;
  }
  return { ...DEFAULT_PANS_MANAGER_SETTINGS, ...compatible };
}

export function normalizeManagedNetworkSettings(
  settings?: Partial<ManagedNetworkSettings>,
): ManagedNetworkSettings {
  const compatible = {
    ...(settings ?? {}),
  } as Partial<ManagedNetworkSettings> & Record<string, unknown>;
  delete compatible.scanDurationMs;
  if (compatible.mapUnits !== "metric" && compatible.mapUnits !== "imperial")
    delete compatible.mapUnits;
  if (
    compatible.mapAreaMode !== "infinite" &&
    compatible.mapAreaMode !== "bounded"
  )
    delete compatible.mapAreaMode;
  return {
    ...DEFAULT_MANAGED_NETWORK_SETTINGS,
    ...compatible,
    coordinateBounds: {
      ...DEFAULT_MANAGED_NETWORK_SETTINGS.coordinateBounds,
      ...settings?.coordinateBounds,
    },
    defaultTagMode: {
      ...DEFAULT_MANAGED_NETWORK_SETTINGS.defaultTagMode,
      ...settings?.defaultTagMode,
    },
  };
}

export const PANS_NETWORK_EXPORT_VERSION = 2 as const;

export interface PansNetworkExport {
  schema: "eight2five.pans-network";
  version: typeof PANS_NETWORK_EXPORT_VERSION;
  exportedAt: number;
  network: ManagedNetwork;
  devices: ManagedDevice[];
  configurations: DeviceConfigurationSnapshot[];
}

export interface NetworkDeviceAssociation {
  networkId: string;
  deviceId: string;
  associatedAt: number;
}

export type NetworkSettings = ManagedNetworkSettings;
export type DiscoverySnapshot = DiscoveredDeviceSnapshot;
export type InspectionResult = PansInspectionResult;
export type ConfigurationResult = PansConfigurationResult;
export type BatchOperationRecord = PansBatchOperationRecord;
export type BatchOperationItem = PansBatchOperationItem;
export type ManagerSettings = PansManagerSettings;
export type NetworkExportSchema = PansNetworkExport;
