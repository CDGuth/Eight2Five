import {
  requireNativeModule,
  EventEmitter,
  EventSubscription,
} from "expo-modules-core";
import {
  KBeacon,
  ExpoKBeaconProModuleEvents,
  ConnectionStateChangeEvent,
  NotifyDataEvent,
  KBCfgBase,
  KBConnPara,
  KBSensorType,
  KBSensorDataInfo,
  KBSensorDataRecord,
} from "./ExpoKBeaconPro.types";

type EventMap = {
  [ExpoKBeaconProModuleEvents.onBeaconDiscovered]: (event: {
    beacons: KBeacon[];
  }) => void;
  [ExpoKBeaconProModuleEvents.onConnectionStateChanged]: (
    event: ConnectionStateChangeEvent,
  ) => void;
  [ExpoKBeaconProModuleEvents.onNotifyDataReceived]: (
    event: NotifyDataEvent,
  ) => void;
};

const nativeModule = requireNativeModule("ExpoKBeaconPro");

const emitter = new EventEmitter<EventMap>(nativeModule);

export function addBeaconDiscoveredListener(
  listener: (event: { beacons: KBeacon[] }) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoKBeaconProModuleEvents.onBeaconDiscovered,
    listener,
  );
}

export function addConnectionStateChangedListener(
  listener: (event: ConnectionStateChangeEvent) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoKBeaconProModuleEvents.onConnectionStateChanged,
    listener,
  );
}

export function addNotifyDataReceivedListener(
  listener: (event: NotifyDataEvent) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoKBeaconProModuleEvents.onNotifyDataReceived,
    listener,
  );
}

export function startScanning(): void {
  return nativeModule.startScanning();
}

export function stopScanning(): void {
  return nativeModule.stopScanning();
}

export function clearBeacons(): void {
  return nativeModule.clearBeacons();
}

export async function connect(
  macAddress: string,
  password?: string,
  timeout?: number,
): Promise<boolean> {
  return await nativeModule.connect(macAddress, password, timeout);
}

export async function connectEnhanced(
  macAddress: string,
  password?: string,
  timeout?: number,
  connPara?: KBConnPara,
): Promise<boolean> {
  return await nativeModule.connectEnhanced(
    macAddress,
    password,
    timeout,
    connPara,
  );
}

export async function disconnect(macAddress: string): Promise<boolean> {
  return await nativeModule.disconnect(macAddress);
}

export async function modifyConfig(
  macAddress: string,
  configs: KBCfgBase[],
): Promise<boolean> {
  return await nativeModule.modifyConfig(macAddress, configs);
}

export async function readSensorDataInfo(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<KBSensorDataInfo> {
  return await nativeModule.readSensorDataInfo(macAddress, sensorType);
}

export async function readSensorHistory(
  macAddress: string,
  sensorType: KBSensorType,
  maxNum: number,
  readIndex?: number,
): Promise<KBSensorDataRecord[]> {
  return await nativeModule.readSensorHistory(
    macAddress,
    sensorType,
    maxNum,
    readIndex,
  );
}

export async function clearSensorHistory(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<boolean> {
  return await nativeModule.clearSensorHistory(macAddress, sensorType);
}

export async function subscribeSensorDataNotify(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<boolean> {
  return await nativeModule.subscribeSensorDataNotify(macAddress, sensorType);
}

export async function unsubscribeSensorDataNotify(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<boolean> {
  return await nativeModule.unsubscribeSensorDataNotify(macAddress, sensorType);
}
