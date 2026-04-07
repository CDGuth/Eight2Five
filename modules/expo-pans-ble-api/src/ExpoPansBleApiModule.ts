import {
  EventEmitter,
  EventSubscription,
  requireNativeModule,
} from "expo-modules-core";
import {
  ConnectionStateChangeEvent,
  ExpoPansBleApiModuleEvents,
  NotifyDataEvent,
  PansApiError,
  PansApiCapabilities,
  PansBleDevice,
  PansCommandType,
  PansCommandResult,
  PansTlvRequest,
} from "./ExpoPansBleApi.types";

interface ExpoPansBleApiNativeModule {
  startScanning(): void;
  stopScanning(): void;
  clearDevices(): void;
  getCapabilities(): PansApiCapabilities;
  connect(macAddress: string, timeoutMs?: number): Promise<boolean>;
  disconnect(macAddress: string): Promise<boolean>;
  executeCommand(
    macAddress: string,
    request: PansTlvRequest,
  ): Promise<PansCommandResult>;
}

type EventMap = {
  [ExpoPansBleApiModuleEvents.onDeviceDiscovered]: (event: {
    devices: PansBleDevice[];
  }) => void;
  [ExpoPansBleApiModuleEvents.onConnectionStateChanged]: (
    event: ConnectionStateChangeEvent,
  ) => void;
  [ExpoPansBleApiModuleEvents.onNotificationReceived]: (
    event: NotifyDataEvent,
  ) => void;
  [ExpoPansBleApiModuleEvents.onError]: (event: PansApiError) => void;
};

const nativeModule =
  requireNativeModule<ExpoPansBleApiNativeModule>("ExpoPansBleApi");
const emitter = new EventEmitter<EventMap>(nativeModule as never);

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

export function addNotificationReceivedListener(
  listener: (event: NotifyDataEvent) => void,
): EventSubscription {
  return emitter.addListener(
    ExpoPansBleApiModuleEvents.onNotificationReceived,
    listener,
  );
}

export function addErrorListener(
  listener: (event: PansApiError) => void,
): EventSubscription {
  return emitter.addListener(ExpoPansBleApiModuleEvents.onError, listener);
}

export function startScanning(): void {
  return nativeModule.startScanning();
}

export function stopScanning(): void {
  return nativeModule.stopScanning();
}

export function clearDevices(): void {
  return nativeModule.clearDevices();
}

export function getCapabilities(): PansApiCapabilities {
  return nativeModule.getCapabilities();
}

export async function connect(
  macAddress: string,
  timeoutMs?: number,
): Promise<boolean> {
  validateMacAddress(macAddress);
  return await nativeModule.connect(macAddress, timeoutMs);
}

export async function disconnect(macAddress: string): Promise<boolean> {
  validateMacAddress(macAddress);
  return await nativeModule.disconnect(macAddress);
}

export async function executeCommand(
  macAddress: string,
  request: PansTlvRequest,
): Promise<PansCommandResult> {
  validateMacAddress(macAddress);
  validateTlvRequest(request);
  return await nativeModule.executeCommand(macAddress, request);
}

export async function readLocationData(
  macAddress: string,
): Promise<PansCommandResult> {
  return await executeCommand(macAddress, {
    type: PansCommandType.readLocationData,
    value: [],
  });
}

export async function readProxyPositions(
  macAddress: string,
): Promise<PansCommandResult> {
  return await executeCommand(macAddress, {
    type: PansCommandType.readProxyPositions,
    value: [],
  });
}

export async function readOperationMode(
  macAddress: string,
): Promise<PansCommandResult> {
  return await executeCommand(macAddress, {
    type: PansCommandType.readOperationMode,
    value: [],
  });
}

export async function writeLocationDataMode(
  macAddress: string,
  mode: number,
): Promise<PansCommandResult> {
  if (!Number.isInteger(mode) || mode < 0 || mode > 255)
    throw new Error(
      "INVALID_ARGUMENT: mode must be a byte integer in range 0..255.",
    );

  return await executeCommand(macAddress, {
    type: PansCommandType.writeLocationDataMode,
    value: [mode],
  });
}

export async function writeOperationMode(
  macAddress: string,
  operationModeBytes: [number, number],
): Promise<PansCommandResult> {
  const [byte0, byte1] = operationModeBytes;
  const isValid =
    Number.isInteger(byte0) &&
    Number.isInteger(byte1) &&
    byte0 >= 0 &&
    byte0 <= 255 &&
    byte1 >= 0 &&
    byte1 <= 255;

  if (!isValid)
    throw new Error(
      "INVALID_ARGUMENT: operation mode requires two bytes in range 0..255.",
    );

  return await executeCommand(macAddress, {
    type: PansCommandType.writeOperationMode,
    value: [byte0, byte1],
  });
}

export async function setTagLocationEngineEnabled(
  macAddress: string,
  enabled: boolean,
): Promise<PansCommandResult> {
  const readResult = await readOperationMode(macAddress);
  if (!readResult.ok) {
    return readResult;
  }

  const bytes = readResult.response?.value ?? [];
  if (bytes.length < 2) {
    return {
      ok: false,
      error: {
        code: "OPERATION_FAILED",
        message:
          "Operation mode read returned an invalid payload. Expected at least 2 bytes.",
      },
    };
  }

  const nextByte1 = enabled ? bytes[1] | 0x20 : bytes[1] & ~0x20;
  return await writeOperationMode(macAddress, [bytes[0], nextByte1]);
}

export async function writePersistedPosition(
  macAddress: string,
  position: {
    xMeters: number;
    yMeters: number;
    zMeters?: number;
    quality?: number;
  },
): Promise<PansCommandResult> {
  const xMm = Math.round(position.xMeters * 1000);
  const yMm = Math.round(position.yMeters * 1000);
  const zMm = Math.round((position.zMeters ?? 0) * 1000);
  const quality = Math.max(
    1,
    Math.min(100, Math.round(position.quality ?? 100)),
  );

  const bytes = new Uint8Array(13);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, xMm, true);
  view.setInt32(4, yMm, true);
  view.setInt32(8, zMm, true);
  bytes[12] = quality;

  return await executeCommand(macAddress, {
    type: PansCommandType.writePersistedPosition,
    value: Array.from(bytes),
  });
}

export async function readAnchorList(
  macAddress: string,
): Promise<PansCommandResult> {
  return await executeCommand(macAddress, {
    type: PansCommandType.readAnchorList,
    value: [],
  });
}

export async function pushFwUpdatePayload(
  macAddress: string,
  payload: number[],
): Promise<PansCommandResult> {
  return await executeCommand(macAddress, {
    type: PansCommandType.fwUpdatePush,
    value: payload,
  });
}

function validateMacAddress(macAddress: string): void {
  const isMac = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(macAddress);
  const isIosPeripheralId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      macAddress,
    );

  const isValid = isMac || isIosPeripheralId;
  if (isValid) return;

  throw new Error(
    "INVALID_ARGUMENT: address must be a colon-delimited MAC or iOS peripheral UUID string.",
  );
}

function validateTlvRequest(request: PansTlvRequest): void {
  const typeInRange =
    Number.isInteger(request.type) && request.type >= 0 && request.type <= 255;
  if (!typeInRange)
    throw new Error(
      "INVALID_ARGUMENT: TLV type must be an integer in range 0..255.",
    );

  const validValue =
    Array.isArray(request.value) &&
    request.value.length <= 253 &&
    request.value.every(
      (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
    );

  if (validValue) return;

  throw new Error(
    "INVALID_ARGUMENT: TLV value must be an array of byte integers in range 0..255 with max length 253.",
  );
}
