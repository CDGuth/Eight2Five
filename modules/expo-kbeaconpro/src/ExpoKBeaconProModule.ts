import { requireNativeModule, EventSubscription } from "expo-modules-core";
import {
  BeaconDiscoveredEvent,
  ConnectionStateChangeEvent,
  ExpoKBeaconProModuleEvents,
  KBAdvType,
  KBConnPara,
  KBeaconBluetoothStateEvent,
  KBeaconConfig,
  KBeaconDeviceSnapshot,
  KBeaconErrorEvent,
  KBeaconModuleCapabilities,
  KBeaconPermissionStatus,
  KBSensorDataInfo,
  KBSensorRecordRequest,
  KBSensorRecordResponse,
  KBSensorType,
  ModifyConfigOptions,
  NotifyDataEvent,
} from "./ExpoKBeaconPro.types";

const DEFAULT_TIMEOUT_MS = 15_000;

type EventMap = {
  [ExpoKBeaconProModuleEvents.onBeaconDiscovered]: (
    event: BeaconDiscoveredEvent,
  ) => void;
  [ExpoKBeaconProModuleEvents.onConnectionStateChanged]: (
    event: ConnectionStateChangeEvent,
  ) => void;
  [ExpoKBeaconProModuleEvents.onNotifyDataReceived]: (
    event: NotifyDataEvent,
  ) => void;
  [ExpoKBeaconProModuleEvents.onBluetoothStateChanged]: (
    event: KBeaconBluetoothStateEvent,
  ) => void;
  [ExpoKBeaconProModuleEvents.onError]: (event: KBeaconErrorEvent) => void;
};

interface ExpoKBeaconProEventEmitter {
  addListener<EventName extends keyof EventMap>(
    eventName: EventName,
    listener: EventMap[EventName],
  ): EventSubscription;
}

interface ExpoKBeaconProNativeModule extends ExpoKBeaconProEventEmitter {
  startScanning(): Promise<void>;
  stopScanning(): void;
  clearBeacons(): void;

  getCapabilities(): KBeaconModuleCapabilities;
  getPermissionStatus(): KBeaconPermissionStatus;
  requestPermissions(): Promise<KBeaconPermissionStatus>;

  connect(
    macAddress: string,
    password?: string,
    timeoutMs?: number,
  ): Promise<boolean>;

  connectEnhanced(
    macAddress: string,
    password?: string,
    timeoutMs?: number,
    connPara?: KBConnPara,
  ): Promise<boolean>;

  disconnect(macAddress: string): Promise<boolean>;

  modifyConfig(macAddress: string, configs: KBeaconConfig[]): Promise<boolean>;

  readDeviceSnapshot(macAddress: string): Promise<KBeaconDeviceSnapshot>;

  readSensorDataInfo(
    macAddress: string,
    sensorType: KBSensorType,
  ): Promise<KBSensorDataInfo>;

  readSensorRecords(
    macAddress: string,
    request: KBSensorRecordRequest,
  ): Promise<KBSensorRecordResponse>;

  clearSensorHistory(
    macAddress: string,
    sensorType: KBSensorType,
  ): Promise<boolean>;

  subscribeNotify(macAddress: string, eventType?: number): Promise<boolean>;

  unsubscribeNotify(macAddress: string, eventType?: number): Promise<boolean>;
}

const nativeModule =
  requireNativeModule<ExpoKBeaconProNativeModule>("ExpoKBeaconPro");

const emitter: ExpoKBeaconProEventEmitter = nativeModule;

const ADV_TYPE_VALUES = new Set<number>(
  Object.values(KBAdvType).filter(
    (value): value is number => typeof value === "number",
  ),
);

const SENSOR_TYPE_VALUES = new Set<number>(
  Object.values(KBSensorType).filter(
    (value): value is number => typeof value === "number",
  ),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNonEmptyMac(macAddress: string): string {
  if (typeof macAddress !== "string" || macAddress.trim().length === 0) {
    throw new Error("INVALID_ARGUMENT: macAddress must be a non-empty string");
  }

  return macAddress;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`INVALID_ARGUMENT: ${name} must be a positive integer`);
  }
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`INVALID_ARGUMENT: ${name} must be a non-negative integer`);
  }
}

function resolveTimeoutMs(timeoutMs?: number): number {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS;
  assertPositiveInteger("timeoutMs", timeoutMs);
  return timeoutMs;
}

function assertValidConfigArray(configs: KBeaconConfig[]): void {
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new Error("INVALID_CONFIG: configs must be a non-empty array");
  }

  configs.forEach((config, index) => {
    if (!isRecord(config)) {
      throw new Error(
        `INVALID_CONFIG: configuration at index ${index} is unsupported or malformed`,
      );
    }

    if (config.configType === "common") return;

    if (config.configType === "advertisement") {
      if (!Number.isInteger(config.slotIndex) || config.slotIndex < 0) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid slotIndex`,
        );
      }

      if (
        typeof config.advType !== "number" ||
        !ADV_TYPE_VALUES.has(config.advType)
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid advType`,
        );
      }

      return;
    }

    if (config.configType === "trigger") {
      if (!Number.isInteger(config.triggerIndex) || config.triggerIndex < 0) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid triggerIndex`,
        );
      }

      if (typeof config.triggerType !== "number") {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid triggerType`,
        );
      }

      return;
    }

    if (config.configType === "sensor") {
      if (
        typeof config.sensorType !== "number" ||
        !SENSOR_TYPE_VALUES.has(config.sensorType)
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid sensorType`,
        );
      }

      return;
    }

    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} is unsupported or malformed`,
    );
  });
}

function assertSafeConnectability(
  configs: KBeaconConfig[],
  options?: ModifyConfigOptions,
): void {
  if (options?.allowDisableAllConnectableSlots) return;

  const advertisementConfigs = configs.filter(
    (config) => config.configType === "advertisement",
  );

  if (
    advertisementConfigs.length > 0 &&
    advertisementConfigs.every((config) => config.advConnectable === false)
  ) {
    throw new Error(
      "INVALID_CONFIG: refusing to disable connectability for every updated advertisement slot",
    );
  }
}

function assertValidSensorRecordRequest(
  request: KBSensorRecordRequest,
): KBSensorRecordRequest {
  if (!isRecord(request)) {
    throw new Error("INVALID_ARGUMENT: sensor record request is required");
  }

  if (
    typeof request.sensorType !== "number" ||
    !SENSOR_TYPE_VALUES.has(request.sensorType)
  ) {
    throw new Error("INVALID_ARGUMENT: request.sensorType is invalid");
  }

  if (typeof request.readOption !== "number" || request.readOption < 0) {
    throw new Error("INVALID_ARGUMENT: request.readOption is invalid");
  }

  assertPositiveInteger("request.maxRecords", request.maxRecords);

  if (request.readPosition !== undefined) {
    assertNonNegativeInteger("request.readPosition", request.readPosition);
  }

  return request;
}

export function addBeaconDiscoveredListener(
  listener: (event: BeaconDiscoveredEvent) => void,
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

export function addBluetoothStateChangedListener(
  listener: (event: KBeaconBluetoothStateEvent) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoKBeaconProModuleEvents.onBluetoothStateChanged,
    listener,
  );
}

export function addErrorListener(
  listener: (event: KBeaconErrorEvent) => void,
): EventSubscription {
  return emitter.addListener(ExpoKBeaconProModuleEvents.onError, listener);
}

export async function startScanning(): Promise<void> {
  await nativeModule.startScanning();
}

export function stopScanning(): void {
  nativeModule.stopScanning();
}

export function clearBeacons(): void {
  nativeModule.clearBeacons();
}

export function getCapabilities(): KBeaconModuleCapabilities {
  return nativeModule.getCapabilities();
}

export function getPermissionStatus(): KBeaconPermissionStatus {
  return nativeModule.getPermissionStatus();
}

export async function requestPermissions(): Promise<KBeaconPermissionStatus> {
  return await nativeModule.requestPermissions();
}

export async function connect(
  macAddress: string,
  password?: string,
  timeoutMs?: number,
): Promise<boolean> {
  return await nativeModule.connect(
    assertNonEmptyMac(macAddress),
    password,
    resolveTimeoutMs(timeoutMs),
  );
}

export async function connectEnhanced(
  macAddress: string,
  password?: string,
  timeoutMs?: number,
  connPara?: KBConnPara,
): Promise<boolean> {
  return await nativeModule.connectEnhanced(
    assertNonEmptyMac(macAddress),
    password,
    resolveTimeoutMs(timeoutMs),
    connPara,
  );
}

export async function disconnect(macAddress: string): Promise<boolean> {
  return await nativeModule.disconnect(assertNonEmptyMac(macAddress));
}

export async function modifyConfig(
  macAddress: string,
  configs: KBeaconConfig[],
  options?: ModifyConfigOptions,
): Promise<boolean> {
  assertNonEmptyMac(macAddress);
  assertValidConfigArray(configs);
  assertSafeConnectability(configs, options);

  return await nativeModule.modifyConfig(macAddress, configs);
}

export async function readDeviceSnapshot(
  macAddress: string,
): Promise<KBeaconDeviceSnapshot> {
  return await nativeModule.readDeviceSnapshot(assertNonEmptyMac(macAddress));
}

export async function readSensorDataInfo(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<KBSensorDataInfo> {
  if (!SENSOR_TYPE_VALUES.has(sensorType)) {
    throw new Error("INVALID_ARGUMENT: sensorType is invalid");
  }

  return await nativeModule.readSensorDataInfo(
    assertNonEmptyMac(macAddress),
    sensorType,
  );
}

export async function readSensorRecords(
  macAddress: string,
  request: KBSensorRecordRequest,
): Promise<KBSensorRecordResponse> {
  return await nativeModule.readSensorRecords(
    assertNonEmptyMac(macAddress),
    assertValidSensorRecordRequest(request),
  );
}

export async function clearSensorHistory(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<boolean> {
  if (!SENSOR_TYPE_VALUES.has(sensorType)) {
    throw new Error("INVALID_ARGUMENT: sensorType is invalid");
  }

  return await nativeModule.clearSensorHistory(
    assertNonEmptyMac(macAddress),
    sensorType,
  );
}

export async function subscribeNotify(
  macAddress: string,
  eventType?: number,
): Promise<boolean> {
  if (eventType !== undefined) assertNonNegativeInteger("eventType", eventType);

  return await nativeModule.subscribeNotify(
    assertNonEmptyMac(macAddress),
    eventType,
  );
}

export async function unsubscribeNotify(
  macAddress: string,
  eventType?: number,
): Promise<boolean> {
  if (eventType !== undefined) assertNonNegativeInteger("eventType", eventType);

  return await nativeModule.unsubscribeNotify(
    assertNonEmptyMac(macAddress),
    eventType,
  );
}

/** @deprecated Use subscribeNotify(macAddress, eventType). */
export async function subscribeSensorDataNotify(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<boolean> {
  return await subscribeNotify(macAddress, sensorType);
}

/** @deprecated Use unsubscribeNotify(macAddress, eventType). */
export async function unsubscribeSensorDataNotify(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<boolean> {
  return await unsubscribeNotify(macAddress, sensorType);
}
