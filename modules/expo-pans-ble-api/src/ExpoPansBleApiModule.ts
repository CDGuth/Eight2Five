import {
  EventEmitter,
  EventSubscription,
  requireNativeModule,
} from "expo-modules-core";
import {
  ConnectionStateChangeEvent,
  ExpoPansBleApiModuleEvents,
  PANS_BLE_UUIDS,
  PansAnchorList,
  PansApiError,
  PansBleCapabilities,
  PansBleDevice,
  PansBlePermissionStatus,
  PansCharacteristicNotificationEvent,
  PansClusterInfo,
  PansDeviceInfo,
  PansDistance,
  PansFirmwareUpdateOffer,
  PansFirmwareUpdatePoll,
  PansFirmwareTransportLimits,
  PansLocationData,
  PansLocationDataMode,
  PansOperationMode,
  PansOperationModePatch,
  PansPosition,
  PansPresenceData,
  PansProxyPosition,
  PansResult,
  PansTagUpdateRate,
  PansUwbMode,
  PansWriteType,
} from "./ExpoPansBleApi.types";

interface ExpoPansBleApiNativeModule {
  startScanning(): Promise<void> | void;
  stopScanning(): void;
  clearDevices(): void;

  getCapabilities(): PansBleCapabilities;
  getPermissionStatus(): PansBlePermissionStatus;
  requestPermissions(): Promise<PansBlePermissionStatus>;

  connect(deviceId: string, timeoutMs?: number): Promise<boolean>;
  disconnect(deviceId: string): Promise<boolean>;

  readCharacteristic(
    deviceId: string,
    characteristicUuid: string,
  ): Promise<number[]>;

  writeCharacteristic(
    deviceId: string,
    characteristicUuid: string,
    payload: number[],
    writeType?: PansWriteType,
  ): Promise<boolean>;

  setCharacteristicNotifications(
    deviceId: string,
    characteristicUuid: string,
    enabled: boolean,
  ): Promise<boolean>;

  requestMtu?(deviceId: string, mtu: number): Promise<number>;
  getMaximumWriteValueLength?(
    deviceId: string,
    writeType: PansWriteType,
  ): Promise<number>;
}

type EventMap = {
  [ExpoPansBleApiModuleEvents.onDeviceDiscovered]: (event: {
    devices: PansBleDevice[];
  }) => void;
  [ExpoPansBleApiModuleEvents.onConnectionStateChanged]: (
    event: ConnectionStateChangeEvent,
  ) => void;
  [ExpoPansBleApiModuleEvents.onCharacteristicNotification]: (
    event: PansCharacteristicNotificationEvent,
  ) => void;
  [ExpoPansBleApiModuleEvents.onError]: (event: PansApiError) => void;
};

const nativeModule =
  requireNativeModule<ExpoPansBleApiNativeModule>("ExpoPansBleApi");
const emitter = new EventEmitter<EventMap>(nativeModule as never);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROXY_POSITION_ENTRIES = 5;
const MAX_ANCHOR_LIST_ENTRIES = 16;
const MAX_DISTANCE_ONLY_ENTRIES = 15;
const MAX_COMBINED_DISTANCE_ENTRIES = 4;

export function addDeviceDiscoveredListener(
  listener: (event: { devices: PansBleDevice[] }) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoPansBleApiModuleEvents.onDeviceDiscovered,
    listener,
  );
}

export function addConnectionStateChangedListener(
  listener: (event: ConnectionStateChangeEvent) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoPansBleApiModuleEvents.onConnectionStateChanged,
    listener,
  );
}

export function addCharacteristicNotificationListener(
  listener: (event: PansCharacteristicNotificationEvent) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoPansBleApiModuleEvents.onCharacteristicNotification,
    listener,
  );
}

export function addLocationDataListener(
  listener: (event: PansCharacteristicNotificationEvent) => void,
): EventSubscription {
  return addFilteredCharacteristicListener(
    PANS_BLE_UUIDS.characteristics.locationData,
    listener,
  );
}

export function addProxyPositionsListener(
  listener: (event: PansCharacteristicNotificationEvent) => void,
): EventSubscription {
  return addFilteredCharacteristicListener(
    PANS_BLE_UUIDS.characteristics.proxyPositions,
    listener,
  );
}

export function addFirmwareUpdatePollListener(
  listener: (event: PansCharacteristicNotificationEvent) => void,
): EventSubscription {
  return addFilteredCharacteristicListener(
    PANS_BLE_UUIDS.characteristics.firmwareUpdatePoll,
    listener,
  );
}

export function addErrorListener(
  listener: (event: PansApiError) => void,
): EventSubscription {
  return emitter.addListener(ExpoPansBleApiModuleEvents.onError, listener);
}

export async function startScanning(): Promise<void> {
  await nativeModule.startScanning();
}

export function stopScanning(): void {
  nativeModule.stopScanning();
}

export function clearDevices(): void {
  nativeModule.clearDevices();
}

export function getCapabilities(): PansBleCapabilities {
  return nativeModule.getCapabilities();
}

export function getPermissionStatus(): PansBlePermissionStatus {
  return nativeModule.getPermissionStatus();
}

export async function requestPermissions(): Promise<PansBlePermissionStatus> {
  return await nativeModule.requestPermissions();
}

export async function connect(
  deviceId: string,
  timeoutMs?: number,
): Promise<boolean> {
  validateDeviceId(deviceId);
  validateTimeoutMs(timeoutMs);
  return await nativeModule.connect(deviceId, timeoutMs);
}

export async function disconnect(deviceId: string): Promise<boolean> {
  validateDeviceId(deviceId);
  return await nativeModule.disconnect(deviceId);
}

export async function readCharacteristic(
  deviceId: string,
  characteristicUuid: string,
): Promise<number[]> {
  validateDeviceId(deviceId);
  validateCharacteristicUuid(characteristicUuid);
  return validateBytes(
    await nativeModule.readCharacteristic(deviceId, characteristicUuid),
  );
}

export async function writeCharacteristic(
  deviceId: string,
  characteristicUuid: string,
  payload: number[],
  writeType: PansWriteType = "withResponse",
): Promise<boolean> {
  validateDeviceId(deviceId);
  validateCharacteristicUuid(characteristicUuid);
  validateByteArray(payload, "payload");
  validateWriteType(writeType);
  return await nativeModule.writeCharacteristic(
    deviceId,
    characteristicUuid,
    payload,
    writeType,
  );
}

export async function setCharacteristicNotifications(
  deviceId: string,
  characteristicUuid: string,
  enabled: boolean,
): Promise<boolean> {
  validateDeviceId(deviceId);
  validateCharacteristicUuid(characteristicUuid);
  return await nativeModule.setCharacteristicNotifications(
    deviceId,
    characteristicUuid,
    enabled,
  );
}

export async function requestMtu(
  deviceId: string,
  mtu: number,
): Promise<number> {
  validateDeviceId(deviceId);
  if (!Number.isInteger(mtu) || mtu < 23 || mtu > 517) {
    throw new Error("INVALID_ARGUMENT: MTU must be in range 23..517.");
  }
  if (!nativeModule.requestMtu) {
    throw new Error(
      "UNSUPPORTED: explicit MTU requests are not supported on this platform.",
    );
  }
  return await nativeModule.requestMtu(deviceId, mtu);
}

export async function getMaximumWriteValueLength(
  deviceId: string,
  writeType: PansWriteType,
): Promise<number | undefined> {
  validateDeviceId(deviceId);
  validateWriteType(writeType);
  return await nativeModule.getMaximumWriteValueLength?.(deviceId, writeType);
}

export async function prepareFirmwareUpdateTransport(
  deviceId: string,
): Promise<PansFirmwareTransportLimits> {
  validateDeviceId(deviceId);
  const capabilities = getCapabilities();
  let maxPacketBytes = 0;

  if (capabilities.supportsMtuRequest) {
    const negotiatedMtu = await requestMtu(deviceId, 64);
    maxPacketBytes = Math.max(0, negotiatedMtu - 3);
  } else if (capabilities.supportsMaximumWriteValueLength) {
    maxPacketBytes =
      (await getMaximumWriteValueLength(deviceId, "withoutResponse")) ?? 0;
  }

  const maxChunkDataBytes = Math.min(32, Math.max(0, maxPacketBytes - 5));
  if (maxChunkDataBytes <= 0) {
    throw new Error(
      "OPERATION_FAILED: firmware update transport cannot carry data chunks.",
    );
  }

  return { maxPacketBytes, maxChunkDataBytes };
}

export async function readLabel(deviceId: string): Promise<string> {
  const payload = await readCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.label,
  );
  return textDecoder.decode(Uint8Array.from(payload));
}

export async function writeLabel(
  deviceId: string,
  label: string,
): Promise<boolean> {
  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.label,
    Array.from(textEncoder.encode(label)),
  );
}

export async function readOperationMode(
  deviceId: string,
): Promise<PansOperationMode> {
  return decodeOperationMode(
    await readCharacteristic(
      deviceId,
      PANS_BLE_UUIDS.characteristics.operationMode,
    ),
  );
}

export async function writeOperationMode(
  deviceId: string,
  nextMode: PansOperationMode | [number, number],
): Promise<boolean> {
  const payload = Array.isArray(nextMode)
    ? validateOperationModeTuple(nextMode)
    : encodeOperationMode(nextMode);
  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.operationMode,
    payload,
  );
}

export async function patchOperationMode(
  deviceId: string,
  patch: PansOperationModePatch,
): Promise<PansOperationMode> {
  const current = await readOperationMode(deviceId);
  const next: PansOperationMode = { ...current, ...patch, raw: current.raw };
  const encoded = encodeOperationMode(next);
  const raw: [number, number] = [encoded[0], encoded[1]];
  await writeOperationMode(deviceId, raw);
  return { ...next, raw };
}

export async function setTagLocationEngineEnabled(
  deviceId: string,
  enabled: boolean,
): Promise<PansResult<PansOperationMode>> {
  return toResult(
    async () =>
      await patchOperationMode(deviceId, {
        role: "tag",
        locationEngineEnabled: enabled,
      }),
  );
}

export async function readNetworkId(deviceId: string): Promise<number> {
  const payload = await readCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.networkId,
  );
  ensureLength(payload, 2, "network ID");
  return dataView(payload).getUint16(0, true);
}

export async function writeNetworkId(
  deviceId: string,
  panId: number,
): Promise<boolean> {
  assertUintRange(panId, 0xffff, "PAN ID");
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, panId, true);
  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.networkId,
    Array.from(bytes),
  );
}

export async function readLocationDataMode(
  deviceId: string,
): Promise<PansLocationDataMode> {
  const payload = await readCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.locationDataMode,
  );
  ensureLength(payload, 1, "location-data mode");
  return normalizeLocationDataMode(payload[0]);
}

export async function writeLocationDataMode(
  deviceId: string,
  mode: PansLocationDataMode,
): Promise<boolean> {
  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.locationDataMode,
    [normalizeLocationDataMode(mode)],
  );
}

export async function readLocationData(
  deviceId: string,
): Promise<PansLocationData> {
  return decodeLocationData(
    await readCharacteristic(
      deviceId,
      PANS_BLE_UUIDS.characteristics.locationData,
    ),
  );
}

export async function subscribeLocationData(
  deviceId: string,
): Promise<boolean> {
  return await setCharacteristicNotifications(
    deviceId,
    PANS_BLE_UUIDS.characteristics.locationData,
    true,
  );
}

export async function unsubscribeLocationData(
  deviceId: string,
): Promise<boolean> {
  return await setCharacteristicNotifications(
    deviceId,
    PANS_BLE_UUIDS.characteristics.locationData,
    false,
  );
}

export async function readProxyPositions(
  deviceId: string,
): Promise<PansProxyPosition[]> {
  return decodeProxyPositions(
    await readCharacteristic(
      deviceId,
      PANS_BLE_UUIDS.characteristics.proxyPositions,
    ),
  );
}

export async function subscribeProxyPositions(
  deviceId: string,
): Promise<boolean> {
  return await setCharacteristicNotifications(
    deviceId,
    PANS_BLE_UUIDS.characteristics.proxyPositions,
    true,
  );
}

export async function unsubscribeProxyPositions(
  deviceId: string,
): Promise<boolean> {
  return await setCharacteristicNotifications(
    deviceId,
    PANS_BLE_UUIDS.characteristics.proxyPositions,
    false,
  );
}

export async function readDeviceInfo(
  deviceId: string,
): Promise<PansDeviceInfo> {
  return decodeDeviceInfo(
    await readCharacteristic(
      deviceId,
      PANS_BLE_UUIDS.characteristics.deviceInfo,
    ),
  );
}

export async function readStatistics(deviceId: string): Promise<number[]> {
  return await readCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.statistics,
  );
}

export async function writePersistedPosition(
  deviceId: string,
  position: Omit<PansPosition, "zMeters" | "quality"> & {
    zMeters?: number;
    quality?: number;
  },
): Promise<boolean> {
  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.persistedPosition,
    encodePersistedPosition(position),
  );
}

export async function readAnchorMacStats(deviceId: string): Promise<number[]> {
  return await readCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.macStats,
  );
}

export async function readClusterInfo(
  deviceId: string,
): Promise<PansClusterInfo> {
  return decodeClusterInfo(
    await readCharacteristic(
      deviceId,
      PANS_BLE_UUIDS.characteristics.clusterInfo,
    ),
  );
}

export async function readAnchorList(
  deviceId: string,
): Promise<PansAnchorList> {
  return decodeAnchorList(
    await readCharacteristic(
      deviceId,
      PANS_BLE_UUIDS.characteristics.anchorList,
    ),
  );
}

export async function readTagUpdateRate(
  deviceId: string,
): Promise<PansTagUpdateRate> {
  return decodeTagUpdateRate(
    await readCharacteristic(
      deviceId,
      PANS_BLE_UUIDS.characteristics.updateRate,
    ),
  );
}

export async function requestExplicitDisconnect(
  deviceId: string,
): Promise<boolean> {
  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.explicitDisconnect,
    [1],
  );
}

export async function subscribeFirmwareUpdatePoll(
  deviceId: string,
): Promise<boolean> {
  return await setCharacteristicNotifications(
    deviceId,
    PANS_BLE_UUIDS.characteristics.firmwareUpdatePoll,
    true,
  );
}

export async function unsubscribeFirmwareUpdatePoll(
  deviceId: string,
): Promise<boolean> {
  return await setCharacteristicNotifications(
    deviceId,
    PANS_BLE_UUIDS.characteristics.firmwareUpdatePoll,
    false,
  );
}

export async function writeFirmwareUpdateOffer(
  deviceId: string,
  offer: PansFirmwareUpdateOffer,
): Promise<boolean> {
  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.firmwareUpdatePush,
    encodeFirmwareUpdateOffer(offer),
    "withResponse",
  );
}

export async function writeFirmwareUpdateChunk(
  deviceId: string,
  offset: number,
  data: number[],
  limits?: PansFirmwareTransportLimits,
): Promise<boolean> {
  if (limits) {
    if (
      !Number.isInteger(limits.maxPacketBytes) ||
      !Number.isInteger(limits.maxChunkDataBytes) ||
      limits.maxPacketBytes < 5 ||
      limits.maxChunkDataBytes < 0
    ) {
      throw new Error(
        "INVALID_ARGUMENT: firmware transport limits are invalid.",
      );
    }

    if (
      data.length > limits.maxChunkDataBytes ||
      5 + data.length > limits.maxPacketBytes
    ) {
      throw new Error(
        "INVALID_ARGUMENT: firmware update chunk exceeds transport limits.",
      );
    }
  }

  return await writeCharacteristic(
    deviceId,
    PANS_BLE_UUIDS.characteristics.firmwareUpdatePush,
    encodeFirmwareUpdateChunk(offset, data),
    "withoutResponse",
  );
}

export function encodeOperationMode(mode: PansOperationMode): number[] {
  const raw = mode.raw ?? [0, 0];
  let byte0 = raw[0] & 0x01;
  let byte1 = raw[1] & 0x1f;

  if (mode.role === "anchor") byte0 |= 0x80;
  byte0 |= uwbModeToBits(mode.uwbMode) << 5;
  if (mode.selectedFirmware === 2) byte0 |= 0x10;
  if (mode.accelerometerEnabled) byte0 |= 0x08;
  if (mode.ledEnabled) byte0 |= 0x04;
  if (mode.firmwareUpdateEnabled) byte0 |= 0x02;
  if (mode.initiatorEnabled) byte1 |= 0x80;
  if (mode.lowPowerModeEnabled) byte1 |= 0x40;
  if (mode.locationEngineEnabled) byte1 |= 0x20;

  return [byte0, byte1];
}

export function decodeOperationMode(payload: number[]): PansOperationMode {
  ensureLength(payload, 2, "operation mode");
  const byte0 = payload[0];
  const byte1 = payload[1];
  return {
    role: byte0 & 0x80 ? "anchor" : "tag",
    uwbMode: bitsToUwbMode((byte0 >> 5) & 0x03),
    selectedFirmware: byte0 & 0x10 ? 2 : 1,
    accelerometerEnabled: Boolean(byte0 & 0x08),
    ledEnabled: Boolean(byte0 & 0x04),
    firmwareUpdateEnabled: Boolean(byte0 & 0x02),
    initiatorEnabled: Boolean(byte1 & 0x80),
    lowPowerModeEnabled: Boolean(byte1 & 0x40),
    locationEngineEnabled: Boolean(byte1 & 0x20),
    raw: [byte0, byte1],
  };
}

export function encodePersistedPosition(
  position: Omit<PansPosition, "zMeters" | "quality"> & {
    zMeters?: number;
    quality?: number;
  },
): number[] {
  const bytes = new Uint8Array(13);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, metersToMillimeters(position.xMeters), true);
  view.setInt32(4, metersToMillimeters(position.yMeters), true);
  view.setInt32(8, metersToMillimeters(position.zMeters ?? 0), true);
  const quality = Math.round(position.quality ?? 100);
  if (quality < 1 || quality > 100) {
    throw new Error(
      "INVALID_ARGUMENT: persisted position quality must be in range 1..100.",
    );
  }
  bytes[12] = quality;
  return Array.from(bytes);
}

export function decodePosition(payload: number[], offset = 0): PansPosition {
  if (offset + 13 > payload.length) {
    throw new Error("MALFORMED_PAYLOAD: position requires 13 bytes.");
  }
  const view = dataView(payload);
  return {
    xMeters: view.getInt32(offset, true) / 1000,
    yMeters: view.getInt32(offset + 4, true) / 1000,
    zMeters: view.getInt32(offset + 8, true) / 1000,
    quality: payload[offset + 12],
  };
}

export function decodeLocationData(payload: number[]): PansLocationData {
  const raw = validateBytes(payload);
  const diagnostics: string[] = [];
  if (!raw.length) return { distances: [], raw, diagnostics };

  const frameType = raw[0];
  if (frameType !== 0 && frameType !== 1 && frameType !== 2) {
    throw new Error(
      `MALFORMED_PAYLOAD: unknown location-data frame type ${frameType}.`,
    );
  }

  let position: PansPosition | undefined;

  if (frameType === 0) {
    if (raw.length >= 14) {
      position = decodePosition(raw, 1);
      if (raw.length > 14) {
        diagnostics.push(
          `unexpected ${raw.length - 14} trailing byte(s) after position frame`,
        );
      }
    } else {
      diagnostics.push("position frame is shorter than 14 bytes");
    }

    return { frameType, position, distances: [], raw, diagnostics };
  }

  if (frameType === 1) {
    return {
      frameType,
      distances: decodeDistances(
        raw,
        1,
        diagnostics,
        MAX_DISTANCE_ONLY_ENTRIES,
      ),
      raw,
      diagnostics,
    };
  }

  const combinedLayoutIsValid =
    raw.length >= 15 &&
    isExactDistanceSection(raw, 14, MAX_COMBINED_DISTANCE_ENTRIES);
  const distanceOnlyFallbackIsValid = isExactDistanceSection(
    raw,
    1,
    MAX_DISTANCE_ONLY_ENTRIES,
  );

  if (combinedLayoutIsValid) {
    position = decodePosition(raw, 1);

    return {
      frameType,
      position,
      distances: decodeDistances(
        raw,
        14,
        diagnostics,
        MAX_COMBINED_DISTANCE_ENTRIES,
      ),
      raw,
      diagnostics,
    };
  }

  if (distanceOnlyFallbackIsValid) {
    return {
      frameType,
      distances: decodeDistances(
        raw,
        1,
        diagnostics,
        MAX_DISTANCE_ONLY_ENTRIES,
      ),
      raw,
      diagnostics,
    };
  }

  diagnostics.push(
    "combined frame does not match position-plus-distances or distance-only layout",
  );
  return { frameType, distances: [], raw, diagnostics };
}

export function decodeProxyPositions(payload: number[]): PansProxyPosition[] {
  const raw = validateBytes(payload);
  if (!raw.length) return [];
  const view = dataView(raw);
  const count = raw[0];
  if (count > MAX_PROXY_POSITION_ENTRIES) {
    throw new Error(
      `MALFORMED_PAYLOAD: proxy positions count ${count} exceeds maximum ${MAX_PROXY_POSITION_ENTRIES}.`,
    );
  }
  const positions: PansProxyPosition[] = [];
  let index = 1;
  for (let i = 0; i < count; i += 1) {
    if (index + 15 > raw.length) {
      throw new Error(
        `MALFORMED_PAYLOAD: truncated proxy-position entry ${i + 1} of ${count}.`,
      );
    }
    positions.push({
      nodeId: view.getUint16(index, true),
      position: decodePosition(raw, index + 2),
    });
    index += 15;
  }
  if (index < raw.length) {
    throw new Error(
      `MALFORMED_PAYLOAD: unexpected ${raw.length - index} trailing byte(s) after proxy-position entries.`,
    );
  }
  return positions;
}

export function decodeDeviceInfo(payload: number[]): PansDeviceInfo {
  ensureLength(payload, 29, "device info");
  const raw = validateBytes(payload);
  const view = dataView(raw);
  const nodeIdHex = readUint64Hex(raw, 0);
  return {
    nodeIdHex,
    lowNodeId: view.getUint16(0, true),
    hardwareVersion: view.getUint32(8, true),
    firmware1Version: view.getUint32(12, true),
    firmware2Version: view.getUint32(16, true),
    firmware1Checksum: view.getUint32(20, true),
    firmware2Checksum: view.getUint32(24, true),
    operationFlags: raw[28],
    raw,
  };
}

export function decodeClusterInfo(payload: number[]): PansClusterInfo {
  ensureLength(payload, 5, "cluster info");
  const raw = validateBytes(payload);
  const view = dataView(raw);
  return {
    seatNumber: raw[0],
    clusterMap: view.getUint16(1, true),
    clusterNeighborMap: view.getUint16(3, true),
    raw,
  };
}

export function decodeAnchorList(payload: number[]): PansAnchorList {
  const raw = validateBytes(payload);
  const diagnostics: string[] = [];
  if (!raw.length) return { anchors: [], raw, diagnostics };
  const count = raw[0];
  if (count > MAX_ANCHOR_LIST_ENTRIES) {
    throw new Error(
      `MALFORMED_PAYLOAD: anchor-list count ${count} exceeds maximum ${MAX_ANCHOR_LIST_ENTRIES}.`,
    );
  }
  const view = dataView(raw);
  const anchors = [];
  let index = 1;
  for (let i = 0; i < count; i += 1) {
    if (index + 8 > raw.length) {
      diagnostics.push(`truncated anchor-list entry ${i + 1} of ${count}`);
      break;
    }
    anchors.push({
      nodeIdHex: readUint64Hex(raw, index),
      lowNodeId: view.getUint16(index, true),
    });
    index += 8;
  }
  if (index < raw.length) {
    diagnostics.push(
      `unexpected ${raw.length - index} trailing byte(s) after anchor-list entries`,
    );
  }
  return { anchors, raw, diagnostics };
}

export function decodeTagUpdateRate(payload: number[]): PansTagUpdateRate {
  ensureLength(payload, 8, "tag update rate");
  const raw = validateBytes(payload);
  const view = dataView(raw);
  return {
    movingUpdateRateMs: view.getUint32(0, true),
    stationaryUpdateRateMs: view.getUint32(4, true),
    raw,
  };
}

export function decodePresenceData(payload: number[]): PansPresenceData {
  ensureLength(payload, 2, "presence data");
  const rawOperationModeByte = payload[0];
  const rawUwbModeBits = rawOperationModeByte & 0x03;
  const uwbMode = tryBitsToUwbMode(rawUwbModeBits);
  return {
    rawOperationModeByte,
    rawUwbModeBits,
    role: rawOperationModeByte & 0x80 ? "anchor" : "tag",
    errorIndicated: Boolean(rawOperationModeByte & 0x10),
    initiator: Boolean(rawOperationModeByte & 0x08),
    bridge: Boolean(rawOperationModeByte & 0x04),
    ...(uwbMode ? { uwbMode } : {}),
    changeCounter: payload[1],
  };
}

export function encodeFirmwareUpdateOffer(
  offer: PansFirmwareUpdateOffer,
): number[] {
  assertUintRange(offer.hardwareVersion, 0xffffffff, "hardware version");
  assertUintRange(offer.firmwareVersion, 0xffffffff, "firmware version");
  assertUintRange(offer.firmwareChecksum, 0xffffffff, "firmware checksum");
  assertUintRange(offer.totalBinarySize, 0xffffffff, "firmware binary size");

  const bytes = new Uint8Array(17);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0;
  view.setUint32(1, offer.hardwareVersion, true);
  view.setUint32(5, offer.firmwareVersion, true);
  view.setUint32(9, offer.firmwareChecksum, true);
  view.setUint32(13, offer.totalBinarySize, true);
  return Array.from(bytes);
}

export function encodeFirmwareUpdateChunk(
  offset: number,
  chunk: number[],
): number[] {
  assertUintRange(offset, 0xffffffff, "firmware update offset");
  validateByteArray(chunk, "firmware update chunk");
  if (chunk.length > 32) {
    throw new Error(
      "INVALID_ARGUMENT: firmware update chunk data must be at most 32 bytes.",
    );
  }
  const bytes = new Uint8Array(5 + chunk.length);
  const view = new DataView(bytes.buffer);
  bytes[0] = 1;
  view.setUint32(1, offset, true);
  bytes.set(chunk, 5);
  return Array.from(bytes);
}

export function decodeFirmwareUpdatePoll(
  payload: number[],
): PansFirmwareUpdatePoll {
  const raw = validateBytes(payload);
  ensureMinLength(raw, 1, "firmware update poll");
  const type = raw[0];
  if (type === 1) {
    ensureMinLength(raw, 9, "firmware update poll request");
    const view = dataView(raw);
    return {
      type,
      kind: "request",
      requestedOffset: view.getUint32(1, true),
      requestedSize: view.getUint32(5, true),
      raw,
    };
  }
  if (type === 0) return { type, kind: "refused", raw };
  if (type === 2) return { type, kind: "complete", raw };
  if (type === 3) return { type, kind: "saveFailed", raw };
  if (type === 14) return { type, kind: "invalidChecksum", raw };
  return { type, kind: "unknown", raw };
}

function addFilteredCharacteristicListener(
  characteristicUuid: string,
  listener: (event: PansCharacteristicNotificationEvent) => void,
): EventSubscription {
  return addCharacteristicNotificationListener((event) => {
    if (sameUuid(event.characteristicUuid, characteristicUuid)) listener(event);
  });
}

function validateOperationModeTuple(tuple: [number, number]): number[] {
  validateByteArray(tuple, "operation mode");
  if (tuple.length !== 2) {
    throw new Error(
      "INVALID_ARGUMENT: operation mode requires exactly 2 bytes.",
    );
  }
  return tuple;
}

function normalizeLocationDataMode(mode: number): PansLocationDataMode {
  if (mode !== 0 && mode !== 1 && mode !== 2) {
    throw new Error("INVALID_ARGUMENT: location-data mode must be 0, 1, or 2.");
  }
  return mode;
}

function decodeDistance(payload: number[], offset: number): PansDistance {
  const view = dataView(payload);
  const nodeId = view.getUint16(offset, true);
  return {
    nodeId,
    anchorKey: toAnchorKey(nodeId),
    distanceMeters: view.getUint32(offset + 2, true) / 1000,
    quality: payload[offset + 6],
  };
}

function isExactDistanceSection(
  raw: number[],
  countOffset: number,
  maxCount: number,
): boolean {
  if (countOffset >= raw.length) return false;

  const count = raw[countOffset];
  if (count > maxCount) return false;
  return countOffset + 1 + count * 7 === raw.length;
}

function decodeDistances(
  raw: number[],
  countOffset: number,
  diagnostics: string[],
  maxCount: number,
): PansDistance[] {
  if (countOffset >= raw.length) {
    diagnostics.push("distance frame is missing count byte");
    return [];
  }

  const count = raw[countOffset];
  if (count > maxCount) {
    throw new Error(
      `MALFORMED_PAYLOAD: distance count ${count} exceeds maximum ${maxCount}.`,
    );
  }
  const distances: PansDistance[] = [];
  let index = countOffset + 1;

  for (let i = 0; i < count; i += 1) {
    if (index + 7 > raw.length) {
      diagnostics.push(`truncated distance entry ${i + 1} of ${count}`);
      break;
    }

    distances.push(decodeDistance(raw, index));
    index += 7;
  }

  if (index < raw.length) {
    diagnostics.push(
      `unexpected ${raw.length - index} trailing byte(s) after distance entries`,
    );
  }

  return distances;
}

function readUint64Hex(payload: number[], offset: number): string {
  let hex = "";
  for (let i = 7; i >= 0; i -= 1) {
    hex += payload[offset + i].toString(16).padStart(2, "0");
  }
  return hex;
}

function uwbModeToBits(mode: PansUwbMode): number {
  if (mode === "off") return 0;
  if (mode === "passive") return 1;
  return 2;
}

function bitsToUwbMode(bits: number): PansUwbMode {
  if (bits === 0) return "off";
  if (bits === 1) return "passive";
  if (bits === 2) return "active";
  throw new Error(`MALFORMED_PAYLOAD: unsupported UWB mode bits ${bits}.`);
}

function metersToMillimeters(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      "INVALID_ARGUMENT: position coordinates must be finite numbers.",
    );
  }
  return Math.round(value * 1000);
}

function assertUintRange(value: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(
      `INVALID_ARGUMENT: ${label} must be an unsigned integer in range 0..${max}.`,
    );
  }
}

function ensureLength(payload: number[], length: number, label: string): void {
  validateByteArray(payload, label);
  if (payload.length !== length) {
    throw new Error(
      `MALFORMED_PAYLOAD: ${label} requires exactly ${length} bytes.`,
    );
  }
}

function ensureMinLength(
  payload: number[],
  length: number,
  label: string,
): void {
  validateByteArray(payload, label);
  if (payload.length < length) {
    throw new Error(
      `MALFORMED_PAYLOAD: ${label} requires at least ${length} bytes.`,
    );
  }
}

function validateBytes(payload: number[]): number[] {
  validateByteArray(payload, "payload");
  return payload.slice();
}

function validateByteArray(payload: number[], label: string): void {
  if (
    !Array.isArray(payload) ||
    !payload.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    throw new Error(
      `INVALID_ARGUMENT: ${label} must be an array of byte integers in range 0..255.`,
    );
  }
}

function validateWriteType(writeType: PansWriteType): void {
  if (writeType !== "withResponse" && writeType !== "withoutResponse") {
    throw new Error(
      "INVALID_ARGUMENT: write type must be withResponse or withoutResponse.",
    );
  }
}

function validateTimeoutMs(timeoutMs: number | undefined): void {
  if (timeoutMs === undefined) return;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("INVALID_ARGUMENT: timeoutMs must be a positive integer.");
  }
}

function validateCharacteristicUuid(uuid: string): void {
  if (typeof uuid !== "string" || !CANONICAL_UUID_PATTERN.test(uuid)) {
    throw new Error(
      "INVALID_ARGUMENT: characteristicUuid must be a canonical 128-bit UUID string.",
    );
  }
}

function dataView(payload: number[]): DataView {
  const bytes = Uint8Array.from(payload);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function sameUuid(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function tryBitsToUwbMode(bits: number): PansUwbMode | undefined {
  if (bits === 0) return "off";
  if (bits === 1) return "passive";
  if (bits === 2) return "active";
  return undefined;
}

function validateDeviceId(deviceId: string): void {
  if (typeof deviceId !== "string" || deviceId.trim().length === 0) {
    throw new Error("INVALID_ARGUMENT: deviceId must be a non-empty string.");
  }
}

function toAnchorKey(nodeId: number): string {
  return `uwb-anchor-${nodeId.toString(16).padStart(4, "0")}`;
}

async function toResult<T>(
  operation: () => Promise<T>,
): Promise<PansResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error: normalizeError(error) };
  }
}

function normalizeError(error: unknown): PansApiError {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    "message" in error
  ) {
    const coded = error as PansApiError;
    return { code: coded.code, message: coded.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  const maybeCode = message.split(":", 1)[0];
  const code = isPansApiErrorCode(maybeCode) ? maybeCode : "OPERATION_FAILED";
  return { code, message };
}

function isPansApiErrorCode(code: string): code is PansApiError["code"] {
  return [
    "UNSUPPORTED",
    "PERMISSION_DENIED",
    "BLUETOOTH_UNAVAILABLE",
    "DEVICE_NOT_FOUND",
    "NOT_CONNECTED",
    "SERVICE_NOT_FOUND",
    "CHARACTERISTIC_NOT_FOUND",
    "INVALID_ARGUMENT",
    "MALFORMED_PAYLOAD",
    "GATT_ERROR",
    "TIMEOUT",
    "OPERATION_FAILED",
  ].includes(code);
}
