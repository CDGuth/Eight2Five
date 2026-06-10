export enum ExpoKBeaconProModuleEvents {
  onBeaconDiscovered = "onBeaconDiscovered",
  onConnectionStateChanged = "onConnectionStateChanged",
  onNotifyDataReceived = "onNotifyDataReceived",
  onBluetoothStateChanged = "onBluetoothStateChanged",
  onError = "onError",
}

export type KBeaconErrorCode =
  | "UNSUPPORTED"
  | "PERMISSION_DENIED"
  | "BLUETOOTH_UNAVAILABLE"
  | "SCAN_FAILED"
  | "BEACON_NOT_FOUND"
  | "BEACON_NOT_CONNECTED"
  | "CONNECTION_BUSY"
  | "CONNECTION_TIMEOUT"
  | "AUTH_FAILED"
  | "INVALID_ARGUMENT"
  | "INVALID_CONFIG"
  | "CONFIG_FAILED"
  | "READ_FAILED"
  | "SUBSCRIBE_FAILED"
  | "UNSUBSCRIBE_FAILED"
  | "OPERATION_FAILED";

export interface KBeaconErrorEvent {
  code: KBeaconErrorCode;
  message: string;
  macAddress?: string;
}

export interface KBeaconBluetoothStateEvent {
  state:
    | "unknown"
    | "resetting"
    | "unsupported"
    | "unauthorized"
    | "poweredOff"
    | "poweredOn";
}

export interface KBeaconModuleCapabilities {
  transport: "ble";
  supportsScanning: boolean;
  supportsConnection: boolean;
  supportsConfiguration: boolean;
  supportsEnhancedConnection: boolean;
  supportsSensorHistory: boolean;
  supportsNotifications: boolean;
  supportsDfu: boolean;
}

export interface KBeaconPermissionStatus {
  bluetooth: "granted" | "denied" | "undetermined" | "unavailable";
  location?: "granted" | "denied" | "undetermined" | "unavailable";
  canAskAgain: boolean;
}

export interface KBeacon {
  deviceId: string;
  mac: string;
  name?: string;
  rssi: number;
  isConnectable?: boolean;
  connectionState?: KBConnState;
  advPackets: KBAdvPacket[];
}

export interface BeaconDiscoveredEvent {
  beacons: KBeacon[];
}

export interface ConnectionStateChangeEvent {
  macAddress: string;
  state: KBConnState;
  reason: KBConnEvtReason;
}

export interface NotifyDataEvent {
  macAddress: string;
  eventType: number;
  raw?: number[];
  data?: Record<string, unknown> | null;
}

export enum KBAdvType {
  IBeacon = 0,
  EddyTLM = 1,
  EddyUID = 2,
  EddyURL = 3,
  Sensor = 4,
  System = 5,
  EBeacon = 6,
  Unknown = 255,
}

export type KBAdvPacket =
  | KBAdvPacketIBeacon
  | KBAdvPacketEddyTLM
  | KBAdvPacketEddyUID
  | KBAdvPacketEddyURL
  | KBAdvPacketSensor
  | KBAdvPacketSystem
  | KBAdvPacketEBeacon
  | KBAdvPacketUnknown;

export interface KBAdvPacketBase {
  advType: KBAdvType;
}

export interface KBAdvPacketIBeacon extends KBAdvPacketBase {
  advType: KBAdvType.IBeacon;
  uuid: string;
  majorID: number;
  minorID: number;
}

export interface KBAdvPacketEddyTLM extends KBAdvPacketBase {
  advType: KBAdvType.EddyTLM;
  batteryLevel?: number;
  temperature?: number;
  advCount?: number;
  secCount?: number;
}

export interface KBAdvPacketEddyUID extends KBAdvPacketBase {
  advType: KBAdvType.EddyUID;
  nid: string;
  sid: string;
}

export interface KBAdvPacketEddyURL extends KBAdvPacketBase {
  advType: KBAdvType.EddyURL;
  url: string;
}

export interface KBAccSensorValue {
  xAis: number;
  yAis: number;
  zAis: number;
}

export interface KBAdvPacketSensor extends KBAdvPacketBase {
  advType: KBAdvType.Sensor;
  batteryLevel?: number;
  temperature?: number;
  humidity?: number;
  accSensor?: KBAccSensorValue;
  alarmStatus?: number;
  pirIndication?: number;
  luxValue?: number;
}

export interface KBAdvPacketSystem extends KBAdvPacketBase {
  advType: KBAdvType.System;
  macAddress?: string;
  model?: string;
  batteryPercent?: number;
  version?: string;
}

export interface KBAdvPacketEBeacon extends KBAdvPacketBase {
  advType: KBAdvType.EBeacon;
  mac?: string;
  uuid?: string;
  utcSecCount?: number;
  refTxPower?: number;
}

export interface KBAdvPacketUnknown extends KBAdvPacketBase {
  advType: KBAdvType.Unknown;
  raw?: Record<string, unknown>;
}

export enum KBConnState {
  Disconnected = 0,
  Connecting = 1,
  Connected = 2,
  Disconnecting = 3,
}

export enum KBConnEvtReason {
  ConnDefault = 0,
  ConnTimeout = 2,
  ConnAuthFail = 3,
  ConnBleClosed = 4,
  ConnBleBusy = 5,
  ConnNotSupport = 6,
  ConnSuccess = 256,
}

export interface KBConnPara {
  syncUtcTime?: boolean;
  readCommPara?: boolean;
  readSlotPara?: boolean;
  readTriggerPara?: boolean;
  readSensorPara?: boolean;
}

export enum KBAdvMode {
  Legacy = 0,
  LongRange = 1,
  HighSpeed = 2,
}

export interface KBCfgCommon {
  configType: "common";
  name?: string;
  alwaysPowerOn?: boolean;
  password?: string;
  refPower1Meters?: number;
}

export interface KBCfgAdvBase {
  configType: "advertisement";
  slotIndex: number;
  advType: KBAdvType;
  txPower?: number;
  advPeriod?: number;
  advMode?: KBAdvMode;
  advTriggerOnly?: boolean;
  advConnectable?: boolean;
}

export interface KBCfgAdvIBeacon extends KBCfgAdvBase {
  advType: KBAdvType.IBeacon;
  uuid?: string;
  majorID?: number;
  minorID?: number;
}

export interface KBCfgAdvEddyUID extends KBCfgAdvBase {
  advType: KBAdvType.EddyUID;
  nid?: string;
  sid?: string;
}

export interface KBCfgAdvEddyURL extends KBCfgAdvBase {
  advType: KBAdvType.EddyURL;
  url?: string;
}

export interface KBCfgAdvEddyTLM extends KBCfgAdvBase {
  advType: KBAdvType.EddyTLM;
}

export interface KBCfgAdvKSensor extends KBCfgAdvBase {
  advType: KBAdvType.Sensor;
  aesType?: number;
}

export interface KBCfgAdvEBeacon extends KBCfgAdvBase {
  advType: KBAdvType.EBeacon;
  uuid?: string;
  encryptInterval?: number;
  aesType?: number;
}

export interface KBCfgAdvNull extends KBCfgAdvBase {
  advType: KBAdvType.Unknown;
}

export enum KBTriggerType {
  TriggerNull = 0,
  BtnSingleClick = 1,
  BtnDoubleClick = 2,
  BtnTripleClick = 3,
  BtnLongPress = 4,
  AccMotion = 5,
  HTTempAbove = 6,
  HTTempBelow = 7,
  HgHumidityAbove = 8,
  HTHumidityBelow = 9,
  CutoffWatchband = 10,
  PIRBodyInfraredDetected = 11,
  LightLUXAbove = 12,
  LightLUXBelow = 13,
  AccAngle = 14,
  PeriodicallyEvent = 15,
}

export enum KBTriggerAction {
  Advertisement = 1,
  Beep = 2,
  Record = 4,
  Report2App = 8,
}

export interface KBCfgTrigger {
  configType: "trigger";
  triggerIndex: number;
  triggerType: KBTriggerType;
  triggerAction?: KBTriggerAction;
  triggerAdvSlot?: number;
  triggerAdvTime?: number;
  triggerPara?: number;
  triggerAdvPeriod?: number;
  triggerTxPower?: number;
  triggerAdvChangeMode?: number;
}

export interface KBCfgTriggerMotion extends KBCfgTrigger {
  triggerType: KBTriggerType.AccMotion;
  accODR?: number;
  wakeupDuration?: number;
}

export interface KBCfgTriggerAngle extends KBCfgTrigger {
  triggerType: KBTriggerType.AccAngle;
  aboveAngle?: number;
  reportInterval?: number;
}

export enum KBSensorType {
  HTHumidity = 1,
  PIR = 2,
  Light = 3,
  VOC = 4,
  GEO = 5,
  Scan = 6,
  Alarm = 7,
}

export interface KBTimeRange {
  localStartHour: number;
  localStartMinute: number;
  localEndHour: number;
  localEndMinute: number;
}

export interface KBCfgSensorBase {
  configType: "sensor";
  sensorType: KBSensorType;
  disablePeriod0?: KBTimeRange;
}

export interface KBCfgSensorHT extends KBCfgSensorBase {
  sensorType: KBSensorType.HTHumidity;
  logEnable?: boolean;
  sensorHtMeasureInterval?: number;
  humidityChangeThreshold?: number;
  temperatureChangeThreshold?: number;
}

export interface KBCfgSensorLight extends KBCfgSensorBase {
  sensorType: KBSensorType.Light;
  logEnable?: boolean;
  measureInterval?: number;
  logChangeThreshold?: number;
}

export interface KBCfgSensorGEO extends KBCfgSensorBase {
  sensorType: KBSensorType.GEO;
  parkingTag?: boolean;
  parkingThreshold?: number;
  parkingDelay?: number;
}

export interface KBCfgSensorScan extends KBCfgSensorBase {
  sensorType: KBSensorType.Scan;
  scanInterval?: number;
  motionScanInterval?: number;
  scanDuration?: number;
  scanModel?: KBAdvMode;
  scanRssi?: number;
  scanChanelMask?: number;
  scanMax?: number;
  scanResultAdvSlot?: number;
}

export interface KBCfgSensorPIR extends KBCfgSensorBase {
  sensorType: KBSensorType.PIR;
  logEnable?: boolean;
  measureInterval?: number;
  logBackoffTime?: number;
}

export type KBeaconConfig =
  | KBCfgCommon
  | KBCfgAdvIBeacon
  | KBCfgAdvEddyUID
  | KBCfgAdvEddyURL
  | KBCfgAdvEddyTLM
  | KBCfgAdvKSensor
  | KBCfgAdvEBeacon
  | KBCfgAdvNull
  | KBCfgTrigger
  | KBCfgTriggerMotion
  | KBCfgTriggerAngle
  | KBCfgSensorHT
  | KBCfgSensorLight
  | KBCfgSensorGEO
  | KBCfgSensorScan
  | KBCfgSensorPIR;

/** @deprecated Use KBeaconConfig. */
export type KBCfgBase = KBeaconConfig;

export interface ModifyConfigOptions {
  allowDisableAllConnectableSlots?: boolean;
}

export interface KBeaconDeviceSnapshot {
  macAddress: string;
  common?: {
    name?: string;
    model?: string;
    version?: string;
    hardwareVersion?: string;
    maxSlots?: number;
    maxTriggers?: number;
    minTxPower?: number;
    maxTxPower?: number;
    supportsIBeacon?: boolean;
    supportsEddyUid?: boolean;
    supportsEddyUrl?: boolean;
    supportsEddyTlm?: boolean;
    supportsSensorAdvertisement?: boolean;
    supportsSystemAdvertisement?: boolean;
    supportsButton?: boolean;
    supportsBeep?: boolean;
    supportsAccelerometer?: boolean;
    supportsHumidity?: boolean;
    supportsPir?: boolean;
    supportsLight?: boolean;
  };
  slots?: KBCfgAdvBase[];
  triggers?: KBCfgTrigger[];
  sensors?: (
    | KBCfgSensorHT
    | KBCfgSensorLight
    | KBCfgSensorGEO
    | KBCfgSensorScan
    | KBCfgSensorPIR
  )[];
}

export interface KBSensorDataInfo {
  totalRecordNum: number;
  unreadRecordNum: number;
  readIndex?: number;
}

export interface KBSensorRecordRequest {
  sensorType: KBSensorType;
  readPosition?: number;
  maxRecords: number;
}

export interface KBSensorDataRecord {
  utcTime: number;
  sensorType?: KBSensorType;
  raw?: number[];
  temperature?: number;
  humidity?: number;
  luxValue?: number;
  pirIndication?: number;
  alarmStatus?: number;
  [key: string]: unknown;
}

export interface KBSensorRecordResponse {
  records: KBSensorDataRecord[];
}
