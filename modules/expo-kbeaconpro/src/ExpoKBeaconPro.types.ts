export interface KBeacon {
  name: string;
  mac: string;
  rssi: number;
  advPackets?: KBAdvPacketBase[];
}

export enum ExpoKBeaconProModuleEvents {
  onBeaconDiscovered = "onBeaconDiscovered",
  onBeaconConnected = "onBeaconConnected",
  onBeaconDisconnected = "onBeaconDisconnected",
  onConnectionStateChanged = "onConnectionStateChanged",
  onNotifyDataReceived = "onNotifyDataReceived",
}

export interface ConnectionStateChangeEvent {
  macAddress: string;
  state: KBConnState;
  reason: KBConnEvtReason;
}

export interface NotifyDataEvent {
  macAddress: string;
  eventType: number;
  data: number[]; // Representing byte array
}

// Advertisement Packet Types
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
  batteryLevel: number;
  temperature: number;
  advCount: number;
  secCount: number;
}

export interface KBAccSensorValue {
  xAis: number;
  yAis: number;
  zAis: number;
}

export interface KBAdvPacketSensor extends KBAdvPacketBase {
  advType: KBAdvType.Sensor;
  batteryLevel: number;
  temperature: number;
  humidity?: number;
  accSensor?: KBAccSensorValue;
  alarmStatus?: number;
  pirIndication?: number;
  luxValue?: number;
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

export interface KBAdvPacketSystem extends KBAdvPacketBase {
  advType: KBAdvType.System;
  macAddress: string;
  model: string;
  batteryPercent: number;
  version: string;
}

export interface KBAdvPacketEBeacon extends KBAdvPacketBase {
  advType: KBAdvType.EBeacon;
  mac: string;
  uuid: string;
  utcSecCount: number;
  refTxPower: number;
}

// Connection states and reasons
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

// Configuration types
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface KBCfgBase {
  // Base interface for all config objects
}

export interface KBCfgCommon extends KBCfgBase {
  name?: string;
  alwaysPowerOn?: boolean;
  password?: string;
  refPower1Meters?: number;
}

export enum KBAdvMode {
  Legacy = 0,
  LongRange = 1,
  HighSpeed = 2,
}

export interface KBCfgAdvBase extends KBCfgBase {
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

export interface KBCfgAdvEddyURL extends KBCfgAdvBase {
  advType: KBAdvType.EddyURL;
  url?: string;
}

export interface KBCfgAdvEddyUID extends KBCfgAdvBase {
  advType: KBAdvType.EddyUID;
  nid?: string;
  sid?: string;
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

// Trigger types
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

export interface KBCfgTrigger extends KBCfgBase {
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

// Sensor configuration
export enum KBSensorType {
  HTHumidity = 1,
  PIR = 2,
  Light = 3,
  VOC = 4,
  GEO = 5,
  Scan = 6,
  Alarm = 7,
}

export interface KBCfgSensorHT extends KBCfgBase {
  logEnable?: boolean;
  sensorHtMeasureInterval?: number;
  humidityChangeThreshold?: number;
  temperatureChangeThreshold?: number;
}

export interface KBCfgSensorLight extends KBCfgBase {
  logEnable?: boolean;
  measureInterval?: number;
  logChangeThreshold?: number;
}

export interface KBCfgSensorGEO extends KBCfgBase {
  parkingTag?: boolean;
  parkingThreshold?: number;
  parkingDelay?: number;
}

export interface KBCfgSensorScan extends KBCfgBase {
  scanInterval?: number;
  motionScanInterval?: number;
  scanDuration?: number;
  scanModel?: KBAdvMode;
  scanRssi?: number;
  scanChanelMask?: number;
  scanMax?: number;
  scanResultAdvSlot?: number;
}

export interface KBCfgSensorPIR extends KBCfgBase {
  logEnable?: boolean;
  measureInterval?: number;
  logBackoffTime?: number;
}

export interface KBCfgSensorBase extends KBCfgBase {
  sensorType: KBSensorType;
  disablePeriod0?: KBTimeRange;
}

export interface KBTimeRange {
  localStartHour: number;
  localStartMinute: number;
  localEndHour: number;
  localEndMinute: number;
}

export interface KBSensorDataInfo {
  totalRecordNum: number;
  unreadRecordNum: number;
  readIndex: number;
}

export interface KBSensorDataRecord {
  utcTime: number;
  // Specific data fields depend on the sensor type
  [key: string]: any;
}

export interface KBConnPara {
  syncUtcTime?: boolean;
  readCommPara?: boolean;
  readSlotPara?: boolean;
  readTriggerPara?: boolean;
  readSensorPara?: boolean;
}
