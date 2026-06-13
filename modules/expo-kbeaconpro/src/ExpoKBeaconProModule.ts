import { requireNativeModule, EventSubscription } from "expo-modules-core";
import {
  BeaconDiscoveredEvent,
  ConnectionStateChangeEvent,
  KBAdvMode,
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
  KBSensorReadOption,
  KBSensorRecordRequest,
  KBSensorRecordResponse,
  KBSensorType,
  ModifyConfigOptions,
  NotifyDataEvent,
} from "./ExpoKBeaconPro.types";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_SENSOR_RECORD_POSITION = 0xffffffff;

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

  subscribeNotify(macAddress: string, eventType: number): Promise<boolean>;

  unsubscribeNotify(macAddress: string, eventType: number): Promise<boolean>;
}

const nativeModule =
  requireNativeModule<ExpoKBeaconProNativeModule>("ExpoKBeaconPro");

const emitter: ExpoKBeaconProEventEmitter = nativeModule;

const CONFIG_ADV_TYPE_VALUES = new Set<number>([
  KBAdvType.IBeacon,
  KBAdvType.EddyTLM,
  KBAdvType.EddyUID,
  KBAdvType.EddyURL,
  KBAdvType.Sensor,
  KBAdvType.EBeacon,
  KBAdvType.Unknown,
]);

const ADV_MODE_VALUES = new Set<number>(
  Object.values(KBAdvMode).filter(
    (value): value is number => typeof value === "number",
  ),
);

const SENSOR_TYPE_VALUES = new Set<number>(
  Object.values(KBSensorType).filter(
    (value): value is number => typeof value === "number",
  ),
);

const CONFIG_SENSOR_TYPE_VALUES = new Set<number>([
  KBSensorType.HTHumidity,
  KBSensorType.PIR,
  KBSensorType.Light,
  KBSensorType.GEO,
  KBSensorType.Scan,
]);

const MAC_ADDRESS_PATTERN = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_PATTERN = /^(?:0x)?[0-9a-f]+$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMacAddress(macAddress: string): string {
  if (typeof macAddress !== "string") {
    throw new Error(
      "INVALID_ARGUMENT: macAddress must be a canonical colon-delimited MAC address",
    );
  }

  const normalized = macAddress.trim().toUpperCase();
  if (!MAC_ADDRESS_PATTERN.test(normalized)) {
    throw new Error(
      "INVALID_ARGUMENT: macAddress must be a canonical colon-delimited MAC address",
    );
  }

  return normalized;
}

function normalizePassword(password?: string): string | undefined {
  if (password === undefined || password === "") return password;
  if (typeof password !== "string" || password.length !== 16) {
    throw new Error(
      "INVALID_ARGUMENT: password must be exactly 16 characters when provided",
    );
  }

  return password;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`INVALID_ARGUMENT: ${name} must be a positive integer`);
  }
}

function assertInteger(
  name: string,
  value: number | undefined,
): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`INVALID_ARGUMENT: ${name} must be an integer`);
  }
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`INVALID_ARGUMENT: ${name} must be a non-negative integer`);
  }
}

function resolveTimeoutMs(timeoutMs?: number): number {
  if (timeoutMs === undefined) return DEFAULT_TIMEOUT_MS;
  assertPositiveInteger("timeoutMs", timeoutMs);
  return timeoutMs;
}

function configRecord(
  config: KBeaconConfig,
  index: number,
): Record<string, unknown> {
  if (!isRecord(config)) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} is unsupported or malformed`,
    );
  }

  return config as Record<string, unknown>;
}

function assertOptionalIntegerField(
  record: Record<string, unknown>,
  index: number,
  key: string,
  options: { min?: number; max?: number } = {},
): void {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected a safe integer`,
    );
  }
  if (options.min !== undefined && value < options.min) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected >= ${options.min}`,
    );
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected <= ${options.max}`,
    );
  }
}

function assertOptionalFiniteField(
  record: Record<string, unknown>,
  index: number,
  key: string,
  options: { min?: number; max?: number } = {},
): void {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected a finite number`,
    );
  }
  if (options.min !== undefined && value < options.min) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected >= ${options.min}`,
    );
  }
  if (options.max !== undefined && value > options.max) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected <= ${options.max}`,
    );
  }
}

function assertOptionalBooleanField(
  record: Record<string, unknown>,
  index: number,
  key: string,
): void {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== "boolean") {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected a boolean`,
    );
  }
}

function assertOptionalStringField(
  record: Record<string, unknown>,
  index: number,
  key: string,
): void {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== "string") {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected a string`,
    );
  }
}

function assertOptionalUuidField(
  record: Record<string, unknown>,
  index: number,
  key: string,
): void {
  const value = record[key];
  if (value === undefined) return;
  if (typeof value !== "string" || !CANONICAL_UUID_PATTERN.test(value)) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected canonical UUID`,
    );
  }
}

function assertOptionalHexBytesField(
  record: Record<string, unknown>,
  index: number,
  key: string,
  bytes: number,
): void {
  const value = record[key];
  if (value === undefined) return;
  const expectedLength = bytes * 2;
  const hex = typeof value === "string" ? value.replace(/^0x/i, "") : "";
  if (
    typeof value !== "string" ||
    !HEX_PATTERN.test(value) ||
    hex.length !== expectedLength
  ) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} has invalid ${key}; expected ${expectedLength} hexadecimal characters`,
    );
  }
}

function assertValidConfigArray(configs: KBeaconConfig[]): void {
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new Error("INVALID_CONFIG: configs must be a non-empty array");
  }

  configs.forEach((config, index) => {
    const record = configRecord(config, index);

    if (config.configType === "common") {
      assertOptionalStringField(record, index, "name");
      assertOptionalBooleanField(record, index, "alwaysPowerOn");
      normalizePassword(config.password);
      assertOptionalIntegerField(record, index, "refPower1Meters");
      return;
    }

    if (config.configType === "advertisement") {
      if (!Number.isSafeInteger(config.slotIndex) || config.slotIndex < 0) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid slotIndex`,
        );
      }

      if (
        typeof config.advType !== "number" ||
        !CONFIG_ADV_TYPE_VALUES.has(config.advType)
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid advType`,
        );
      }

      assertOptionalIntegerField(record, index, "txPower");
      assertOptionalFiniteField(record, index, "advPeriod", { min: 0 });
      assertOptionalIntegerField(record, index, "advMode", { min: 0 });
      assertOptionalBooleanField(record, index, "advTriggerOnly");
      assertOptionalBooleanField(record, index, "advConnectable");
      if (
        record.advMode !== undefined &&
        !ADV_MODE_VALUES.has(record.advMode as number)
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid advMode`,
        );
      }

      if (config.advType === KBAdvType.IBeacon) {
        assertOptionalUuidField(record, index, "uuid");
        assertOptionalIntegerField(record, index, "majorID", {
          min: 0,
          max: 65_535,
        });
        assertOptionalIntegerField(record, index, "minorID", {
          min: 0,
          max: 65_535,
        });
      }

      if (config.advType === KBAdvType.EddyUID) {
        assertOptionalHexBytesField(record, index, "nid", 10);
        assertOptionalHexBytesField(record, index, "sid", 6);
      }

      if (config.advType === KBAdvType.EddyURL) {
        assertOptionalStringField(record, index, "url");
      }

      if (config.advType === KBAdvType.Sensor) {
        assertOptionalIntegerField(record, index, "aesType", { min: 0 });
      }

      if (config.advType === KBAdvType.EBeacon) {
        assertOptionalUuidField(record, index, "uuid");
        assertOptionalIntegerField(record, index, "encryptInterval", {
          min: 0,
        });
        assertOptionalIntegerField(record, index, "aesType", { min: 0 });
      }

      return;
    }

    if (config.configType === "trigger") {
      if (
        !Number.isSafeInteger(config.triggerIndex) ||
        config.triggerIndex < 0
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid triggerIndex`,
        );
      }

      if (!Number.isSafeInteger(config.triggerType)) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid triggerType`,
        );
      }

      [
        "triggerAction",
        "triggerAdvSlot",
        "triggerAdvTime",
        "triggerPara",
        "triggerAdvPeriod",
        "triggerAdvChangeMode",
        "accODR",
        "wakeupDuration",
        "aboveAngle",
        "reportInterval",
      ].forEach((key) =>
        assertOptionalIntegerField(record, index, key, { min: 0 }),
      );
      assertOptionalIntegerField(record, index, "triggerTxPower");

      return;
    }

    if (config.configType === "sensor") {
      if (
        typeof config.sensorType !== "number" ||
        !CONFIG_SENSOR_TYPE_VALUES.has(config.sensorType)
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} has an invalid sensorType`,
        );
      }

      assertOptionalBooleanField(record, index, "logEnable");
      assertOptionalBooleanField(record, index, "parkingTag");
      [
        "sensorHtMeasureInterval",
        "humidityChangeThreshold",
        "temperatureChangeThreshold",
        "measureInterval",
        "logChangeThreshold",
        "parkingThreshold",
        "parkingDelay",
        "scanInterval",
        "motionScanInterval",
        "scanDuration",
        "scanModel",
        "scanChanelMask",
        "scanMax",
        "scanResultAdvSlot",
        "logBackoffTime",
      ].forEach((key) =>
        assertOptionalIntegerField(record, index, key, { min: 0 }),
      );
      assertOptionalIntegerField(record, index, "scanRssi");

      return;
    }

    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} is unsupported or malformed`,
    );
  });
}

export function validateConfigAgainstSnapshot(
  configs: KBeaconConfig[],
  snapshot: KBeaconDeviceSnapshot,
): void {
  configs.forEach((config, index) => {
    if (config.configType === "advertisement") {
      if (
        snapshot.common?.maxSlots !== undefined &&
        config.slotIndex >= snapshot.common.maxSlots
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} slotIndex exceeds device maxSlots`,
        );
      }
      validateTxPowerAgainstSnapshot(config.txPower, snapshot, index);
      validateAdvertisementSupport(config.advType, snapshot, index);
    }

    if (config.configType === "trigger") {
      if (
        snapshot.common?.maxTriggers !== undefined &&
        config.triggerIndex >= snapshot.common.maxTriggers
      ) {
        throw new Error(
          `INVALID_CONFIG: configuration at index ${index} triggerIndex exceeds device maxTriggers`,
        );
      }
      validateTxPowerAgainstSnapshot(config.triggerTxPower, snapshot, index);
    }

    if (config.configType === "sensor") {
      validateSensorSupport(config.sensorType, snapshot, index);
    }
  });
}

function validateTxPowerAgainstSnapshot(
  txPower: number | undefined,
  snapshot: KBeaconDeviceSnapshot,
  index: number,
): void {
  if (txPower === undefined) return;
  if (
    snapshot.common?.minTxPower !== undefined &&
    txPower < snapshot.common.minTxPower
  ) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} txPower is below device minimum`,
    );
  }
  if (
    snapshot.common?.maxTxPower !== undefined &&
    txPower > snapshot.common.maxTxPower
  ) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} txPower is above device maximum`,
    );
  }
}

function validateAdvertisementSupport(
  advType: KBAdvType,
  snapshot: KBeaconDeviceSnapshot,
  index: number,
): void {
  const supportFlag = advertisementSupportFlag(advType);
  if (supportFlag && snapshot.common?.[supportFlag] === false) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} requests an unsupported advertisement type`,
    );
  }
}

function advertisementSupportFlag(
  advType: KBAdvType,
): keyof NonNullable<KBeaconDeviceSnapshot["common"]> | undefined {
  switch (advType) {
    case KBAdvType.IBeacon:
      return "supportsIBeacon";
    case KBAdvType.EddyUID:
      return "supportsEddyUid";
    case KBAdvType.EddyURL:
      return "supportsEddyUrl";
    case KBAdvType.EddyTLM:
      return "supportsEddyTlm";
    case KBAdvType.Sensor:
      return "supportsSensorAdvertisement";
    default:
      return undefined;
  }
}

function validateSensorSupport(
  sensorType: KBSensorType,
  snapshot: KBeaconDeviceSnapshot,
  index: number,
): void {
  const supportFlag = sensorSupportFlag(sensorType);
  if (supportFlag && snapshot.common?.[supportFlag] === false) {
    throw new Error(
      `INVALID_CONFIG: configuration at index ${index} requests an unsupported sensor type`,
    );
  }
}

function sensorSupportFlag(
  sensorType: KBSensorType,
): keyof NonNullable<KBeaconDeviceSnapshot["common"]> | undefined {
  switch (sensorType) {
    case KBSensorType.HTHumidity:
      return "supportsHumidity";
    case KBSensorType.PIR:
      return "supportsPir";
    case KBSensorType.Light:
      return "supportsLight";
    case KBSensorType.GEO:
    case KBSensorType.Scan:
      return "supportsAccelerometer";
    default:
      return undefined;
  }
}

function assertSafeConnectability(
  configs: KBeaconConfig[],
  options?: ModifyConfigOptions,
): void {
  if (options?.allowDisableAllConnectableSlots) return;

  if (options?.snapshot?.slots) {
    const postUpdateConnectability = new Map<number, boolean | undefined>();
    options.snapshot.slots.forEach((slot) => {
      postUpdateConnectability.set(slot.slotIndex, slot.advConnectable);
    });
    configs
      .filter((config) => config.configType === "advertisement")
      .forEach((config) => {
        const previous = postUpdateConnectability.get(config.slotIndex);
        postUpdateConnectability.set(
          config.slotIndex,
          config.advConnectable ?? previous,
        );
      });

    if (
      postUpdateConnectability.size > 0 &&
      Array.from(postUpdateConnectability.values()).every(
        (connectable) => connectable === false,
      )
    ) {
      throw new Error(
        "INVALID_CONFIG: refusing to disable connectability for every advertisement slot",
      );
    }

    return;
  }

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

function assertSensorRecordRequest(
  request: KBSensorRecordRequest,
): KBSensorRecordRequest {
  if (!isRecord(request)) {
    throw new Error("INVALID_ARGUMENT: sensor record request is required");
  }

  if (
    !Number.isSafeInteger(request.sensorType) ||
    !SENSOR_TYPE_VALUES.has(request.sensorType)
  ) {
    throw new Error("INVALID_ARGUMENT: sensorType is invalid");
  }

  if (
    request.readOption !== KBSensorReadOption.NormalOrder &&
    request.readOption !== KBSensorReadOption.ReverseOrder &&
    request.readOption !== KBSensorReadOption.NewRecord
  ) {
    throw new Error("INVALID_ARGUMENT: readOption must be 0, 1, or 2");
  }

  assertPositiveInteger("maxRecords", request.maxRecords);

  if (
    request.readPosition !== undefined &&
    (!Number.isSafeInteger(request.readPosition) ||
      request.readPosition < 0 ||
      request.readPosition > MAX_SENSOR_RECORD_POSITION)
  ) {
    throw new Error(
      "INVALID_ARGUMENT: readPosition must be an integer between 0 and 4294967295",
    );
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
  const normalizedMac = normalizeMacAddress(macAddress);
  return await nativeModule.connect(
    normalizedMac,
    normalizePassword(password),
    resolveTimeoutMs(timeoutMs),
  );
}

export async function connectEnhanced(
  macAddress: string,
  password?: string,
  timeoutMs?: number,
  connPara?: KBConnPara,
): Promise<boolean> {
  const normalizedMac = normalizeMacAddress(macAddress);
  return await nativeModule.connectEnhanced(
    normalizedMac,
    normalizePassword(password),
    resolveTimeoutMs(timeoutMs),
    connPara,
  );
}

export async function disconnect(macAddress: string): Promise<boolean> {
  return await nativeModule.disconnect(normalizeMacAddress(macAddress));
}

export async function modifyConfig(
  macAddress: string,
  configs: KBeaconConfig[],
  options?: ModifyConfigOptions,
): Promise<boolean> {
  const normalizedMac = normalizeMacAddress(macAddress);
  assertValidConfigArray(configs);
  if (options?.snapshot) {
    validateConfigAgainstSnapshot(configs, options.snapshot);
  }
  assertSafeConnectability(configs, options);

  return await nativeModule.modifyConfig(normalizedMac, configs);
}

export async function readDeviceSnapshot(
  macAddress: string,
): Promise<KBeaconDeviceSnapshot> {
  return await nativeModule.readDeviceSnapshot(normalizeMacAddress(macAddress));
}

export async function readSensorDataInfo(
  macAddress: string,
  sensorType: KBSensorType,
): Promise<KBSensorDataInfo> {
  if (!SENSOR_TYPE_VALUES.has(sensorType)) {
    throw new Error("INVALID_ARGUMENT: sensorType is invalid");
  }

  return await nativeModule.readSensorDataInfo(
    normalizeMacAddress(macAddress),
    sensorType,
  );
}

export async function readSensorRecords(
  macAddress: string,
  request: KBSensorRecordRequest,
): Promise<KBSensorRecordResponse> {
  return await nativeModule.readSensorRecords(
    normalizeMacAddress(macAddress),
    assertSensorRecordRequest(request),
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
    normalizeMacAddress(macAddress),
    sensorType,
  );
}

export async function subscribeNotify(
  macAddress: string,
  eventType: number,
): Promise<boolean> {
  assertInteger("eventType", eventType);
  assertNonNegativeInteger("eventType", eventType);

  return await nativeModule.subscribeNotify(
    normalizeMacAddress(macAddress),
    eventType,
  );
}

export async function unsubscribeNotify(
  macAddress: string,
  eventType: number,
): Promise<boolean> {
  assertInteger("eventType", eventType);
  assertNonNegativeInteger("eventType", eventType);

  return await nativeModule.unsubscribeNotify(
    normalizeMacAddress(macAddress),
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
