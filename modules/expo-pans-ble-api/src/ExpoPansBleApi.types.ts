export enum ExpoPansBleApiModuleEvents {
  onDeviceDiscovered = "onDeviceDiscovered",
  onConnectionStateChanged = "onConnectionStateChanged",
  onCharacteristicNotification = "onCharacteristicNotification",
  onError = "onError",
}

export const PANS_BLE_UUIDS = {
  services: {
    pansNetworkNode: "680c21d9-c946-4c1f-9c11-baa1c21329e7",
    gap: "00001800-0000-1000-8000-00805f9b34fb",
  },
  characteristics: {
    label: "00002a00-0000-1000-8000-00805f9b34fb",
    operationMode: "3f0afd88-7770-46b0-b5e7-9fc099598964",
    networkId: "80f9d8bc-3bff-45bb-a181-2d6a37991208",
    locationDataMode: "a02b947e-df97-4516-996a-1882521e0ead",
    locationData: "003bbdf2-c634-4b3d-ab56-7ec889b89a37",
    proxyPositions: "f4a67d7d-379d-4183-9c03-4b6ea5103291",
    deviceInfo: "1e63b1eb-d4ed-444e-af54-c1e965192501",
    statistics: "0eb2bc59-baf1-4c1c-8535-8a0204c69de5",
    firmwareUpdatePush: "5955aa10-e085-4030-8aa6-bdfac89ac32b",
    firmwareUpdatePoll: "9eed0e27-09c0-4d1c-bd92-7c441daba850",
    explicitDisconnect: "ed83b848-da03-4a0a-a2dc-8b401080e473",
    persistedPosition: "f0f26c9b-2c8c-49ac-ab60-fe03def1b40c",
    macStats: "28d01d60-89de-4bfa-b6e9-651ba596232c",
    clusterInfo: "17b1613e-98f2-4436-bcde-23af17a10c72",
    anchorList: "5b10c428-af2f-486f-aee1-9dbd79b6bccb",
    updateRate: "7bd47f30-5602-4389-b069-8305731308b6",
  },
  descriptors: {
    cccd: "00002902-0000-1000-8000-00805f9b34fb",
  },
} as const;

export type PansUwbMode = "off" | "passive" | "active";
export type PansNodeRole = "tag" | "anchor";
export type PansLocationDataMode = 0 | 1 | 2;
export type PansWriteType = "withResponse" | "withoutResponse";

export interface PansPresenceData {
  /** Raw PANS BLE service-data bytes emitted by native discovery events. */
  raw?: number[];
  rawOperationModeByte: number;
  rawUwbModeBits: number;
  role: PansNodeRole;
  errorIndicated: boolean;
  initiator: boolean;
  bridge: boolean;
  uwbMode?: PansUwbMode;
  changeCounter: number;
}

export interface PansBleDevice {
  deviceId: string;
  /** Android MAC address when available. Not available on iOS. */
  macAddress?: string;
  /** Deprecated compatibility alias during migration. */
  mac?: string;
  name?: string;
  rssi: number;
  lastSeenMs: number;
  presence?: PansPresenceData;
}

export interface PansBleCapabilities {
  transport: "ble";
  supportsScanning: boolean;
  supportsConnection: boolean;
  supportsNotifications: boolean;
  supportsMtuRequest: boolean;
  supportsMaximumWriteValueLength: boolean;
}

export type PansBlePermissionState =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable";

export interface PansBlePermissionStatus {
  bluetooth: PansBlePermissionState;
  location?: PansBlePermissionState;
  bluetoothState?: "enabled" | "disabled" | "unavailable";
  locationServices?: "enabled" | "disabled" | "unavailable";
  canAskAgain?: boolean;
}

export type PansBleScanState =
  | "idle"
  | "starting"
  | "scanning"
  | "stopped"
  | "failed"
  | "unsupported";

export interface PansBleScanDiagnostics {
  state: PansBleScanState;
  buildId: string;
  scanSessionId: number;
  rawResultCount: number;
  pansResultCount: number;
  parsedServiceDataHitCount: number;
  rawAdvertisementHitCount: number;
  rejectedResultCount: number;
  startedAtMs?: number;
  lastResultAtMs?: number;
  lastPansResultAtMs?: number;
  lastError?: PansApiError;
  warning?: string;
}

export interface ConnectionStateChangeEvent {
  deviceId: string;
  /** Deprecated Android-only compatibility alias. */
  macAddress?: string;
  state: "disconnected" | "connecting" | "connected";
  reason?: string;
}

export interface PansCharacteristicNotificationEvent {
  deviceId: string;
  characteristicUuid: string;
  payload: number[];
}

export type PansApiErrorCode =
  | "UNSUPPORTED"
  | "PERMISSION_DENIED"
  | "LOCATION_SERVICES_DISABLED"
  | "BLUETOOTH_UNAVAILABLE"
  | "DEVICE_NOT_FOUND"
  | "NOT_CONNECTED"
  | "SERVICE_NOT_FOUND"
  | "CHARACTERISTIC_NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "MALFORMED_PAYLOAD"
  | "GATT_ERROR"
  | "TIMEOUT"
  | "OPERATION_FAILED";

export interface PansApiError {
  code: PansApiErrorCode;
  message: string;
  nativeCode?: number;
  operation?: string;
}

export interface PansResult<T = void> {
  ok: boolean;
  value?: T;
  error?: PansApiError;
}

/** Compatibility result type for provisioning helpers. Normal BLE operations are GATT helpers, not TLV commands. */
export type PansCommandResult<T = unknown> = PansResult<T>;

export interface PansOperationMode {
  role: PansNodeRole;
  uwbMode: PansUwbMode;
  selectedFirmware: 1 | 2;
  accelerometerEnabled: boolean;
  ledEnabled: boolean;
  firmwareUpdateEnabled: boolean;
  initiatorEnabled: boolean;
  lowPowerModeEnabled: boolean;
  locationEngineEnabled: boolean;
  raw: [number, number];
}

export type PansOperationModePatch = Partial<
  Omit<PansOperationMode, "raw" | "selectedFirmware">
> & {
  selectedFirmware?: 1 | 2;
};

export interface PansPosition {
  xMeters: number;
  yMeters: number;
  zMeters: number;
  quality: number;
}

export interface PansDistance {
  nodeId: number;
  anchorKey: string;
  distanceMeters: number;
  quality: number;
}

export interface PansLocationData {
  frameType?: 0 | 1 | 2;
  position?: PansPosition;
  distances: PansDistance[];
  raw: number[];
  diagnostics: string[];
}

export interface PansProxyPosition {
  nodeId: number;
  position: PansPosition;
}

export interface PansDeviceInfo {
  nodeIdHex: string;
  lowNodeId: number;
  hardwareVersion: number;
  firmware1Version: number;
  firmware2Version: number;
  firmware1Checksum: number;
  firmware2Checksum: number;
  operationFlags: number;
  raw: number[];
}

export interface PansClusterInfo {
  seatNumber: number;
  clusterMap: number;
  clusterNeighborMap: number;
  raw: number[];
}

export interface PansAnchorListEntry {
  nodeIdHex: string;
  lowNodeId: number;
}

export interface PansAnchorList {
  anchors: PansAnchorListEntry[];
  raw: number[];
  diagnostics: string[];
}

export interface PansTagUpdateRate {
  movingUpdateRateMs: number;
  stationaryUpdateRateMs: number;
  raw: number[];
}

export interface PansFirmwareUpdateOffer {
  hardwareVersion: number;
  firmwareVersion: number;
  firmwareChecksum: number;
  totalBinarySize: number;
}

export interface PansFirmwareTransportLimits {
  maxPacketBytes: number;
  maxChunkDataBytes: number;
}

export type PansFirmwareUpdatePoll =
  | {
      type: 1;
      kind: "request";
      requestedOffset: number;
      requestedSize: number;
      raw: number[];
    }
  | {
      type: 0 | 2 | 3 | 14;
      kind: "refused" | "complete" | "saveFailed" | "invalidChecksum";
      raw: number[];
    }
  | { type: number; kind: "unknown"; raw: number[] };
