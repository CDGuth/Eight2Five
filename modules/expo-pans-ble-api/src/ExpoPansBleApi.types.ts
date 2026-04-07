export enum ExpoPansBleApiModuleEvents {
  onDeviceDiscovered = "onDeviceDiscovered",
  onConnectionStateChanged = "onConnectionStateChanged",
  onNotificationReceived = "onNotificationReceived",
  onError = "onError",
}

export interface PansBleDevice {
  mac: string;
  name?: string;
  rssi: number;
  lastSeenMs: number;
}

export interface PansTlvRequest {
  type: number;
  value: number[];
}

export enum PansCommandType {
  readLocationData = 0x90,
  readProxyPositions = 0x91,
  readOperationMode = 0x92,
  writeLocationDataMode = 0x93,
  writeOperationMode = 0x94,
  writePersistedPosition = 0x95,
  readAnchorList = 0x96,
  fwUpdatePush = 0xa0,
}

export interface PansApiCapabilities {
  transport: "ble";
  commandMode: "tlv";
  supportsScanning: boolean;
  supportsConnection: boolean;
  supportsNotifications: boolean;
  supportedCommands: number[];
}

export interface PansTlvResponse {
  type: number;
  value: number[];
  transport: "ble";
}

export interface PansCommandResult {
  ok: boolean;
  response?: PansTlvResponse;
  error?: PansApiError;
}

export interface ConnectionStateChangeEvent {
  macAddress: string;
  state: "disconnected" | "connecting" | "connected";
  reason?: string;
}

export interface NotifyDataEvent {
  macAddress: string;
  payload: number[];
}

export type PansApiErrorCode =
  | "UNSUPPORTED"
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "BLUETOOTH_UNAVAILABLE"
  | "OPERATION_FAILED"
  | "TIMEOUT";

export interface PansApiError {
  code: PansApiErrorCode;
  message: string;
}
