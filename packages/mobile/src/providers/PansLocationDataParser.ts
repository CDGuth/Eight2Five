import { LocalizationObservation } from "../localization/types";

export interface PansDistanceSample {
  nodeId: number;
  anchorKey: string;
  distanceMeters: number;
  quality: number;
}

export interface PansPositionSample {
  xMeters: number;
  yMeters: number;
  zMeters: number;
  /** Deprecated compatibility alias. Prefer zMeters. */
  zCm?: number;
  quality: number;
}

export interface PansLocationDataFrame {
  frameType?: 0 | 1 | 2;
  position?: PansPositionSample;
  distances: PansDistanceSample[];
  raw: number[];
  diagnostics: string[];
}

export interface PansProxyPositionSample {
  nodeId: number;
  position: PansPositionSample;
}

export interface PansOperationModeSample {
  role: "tag" | "anchor";
  uwbMode: "off" | "passive" | "active";
  selectedFirmware: 1 | 2;
  accelerometerEnabled: boolean;
  ledEnabled: boolean;
  firmwareUpdateEnabled: boolean;
  initiatorEnabled: boolean;
  lowPowerModeEnabled: boolean;
  locationEngineEnabled: boolean;
  raw: [number, number];
}

export interface PansPresenceSample {
  rawOperationModeByte: number;
  role: "tag" | "anchor";
  errorIndicated: boolean;
  initiator: boolean;
  bridge: boolean;
  uwbMode: "off" | "passive" | "active";
  changeCounter: number;
}

export interface PansAnchorListSample {
  anchors: { nodeIdHex: string; lowNodeId: number }[];
  raw: number[];
  diagnostics: string[];
}

export function parsePansLocationDataPayload(
  payload: number[],
): PansLocationDataFrame {
  const raw = validatePayload(payload);
  const diagnostics: string[] = [];
  if (!raw.length) return { distances: [], raw, diagnostics };

  const frameType = raw[0];
  if (frameType !== 0 && frameType !== 1 && frameType !== 2) {
    return {
      distances: [],
      raw,
      diagnostics: [`unknown location-data frame type ${frameType}`],
    };
  }

  let position: PansPositionSample | undefined;
  let distancesOffset = 1;
  if (frameType === 0 || frameType === 2) {
    if (raw.length >= 14) {
      position = parsePosition(raw, 1);
      distancesOffset = 14;
    } else if (frameType === 0) {
      diagnostics.push("position frame is shorter than 14 bytes");
    }
  }

  const distances: PansDistanceSample[] = [];
  if ((frameType === 1 || frameType === 2) && raw.length > distancesOffset) {
    const count = raw[distancesOffset] ?? 0;
    let index = distancesOffset + 1;
    for (let i = 0; i < count; i += 1) {
      if (index + 7 > raw.length) {
        diagnostics.push(`truncated distance entry ${i + 1} of ${count}`);
        break;
      }
      distances.push(parseDistance(raw, index));
      index += 7;
    }
  } else if (frameType === 1) {
    diagnostics.push("distance frame is missing count byte");
  }

  return { frameType, position, distances, raw, diagnostics };
}

export function parsePansProxyPositionsPayload(
  payload: number[],
): PansProxyPositionSample[] {
  const raw = validatePayload(payload);
  if (!raw.length) return [];
  const count = raw[0] ?? 0;
  const view = dataView(raw);
  const proxyPositions: PansProxyPositionSample[] = [];
  let index = 1;
  for (let i = 0; i < count; i += 1) {
    if (index + 15 > raw.length) break;
    proxyPositions.push({
      nodeId: view.getUint16(index, true),
      position: parsePosition(raw, index + 2),
    });
    index += 15;
  }
  return proxyPositions;
}

export function parsePansOperationModePayload(
  payload: number[],
): PansOperationModeSample {
  if (payload.length !== 2) {
    throw new Error("operation mode requires exactly 2 bytes");
  }
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

export function parsePansPresencePayload(
  payload: number[],
): PansPresenceSample {
  if (payload.length < 2) {
    throw new Error("presence data requires at least 2 bytes");
  }
  const rawOperationModeByte = payload[0];
  return {
    rawOperationModeByte,
    role: rawOperationModeByte & 0x80 ? "anchor" : "tag",
    errorIndicated: Boolean(rawOperationModeByte & 0x10),
    initiator: Boolean(rawOperationModeByte & 0x08),
    bridge: Boolean(rawOperationModeByte & 0x04),
    uwbMode: bitsToUwbMode(rawOperationModeByte & 0x03),
    changeCounter: payload[1],
  };
}

export function parseAnchorListPayload(
  payload: number[],
): PansAnchorListSample {
  const raw = validatePayload(payload);
  const diagnostics: string[] = [];
  if (!raw.length) return { anchors: [], raw, diagnostics };
  const count = raw[0];
  const view = dataView(raw);
  const anchors: PansAnchorListSample["anchors"] = [];
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
  return { anchors, raw, diagnostics };
}

export function locationFrameToObservations(
  deviceId: string,
  frame: PansLocationDataFrame,
  observedAtMs: number = Date.now(),
): LocalizationObservation[] {
  const observations: LocalizationObservation[] = [];

  if (frame.position) {
    observations.push({
      mac: deviceId,
      observedAtMs,
      source: "pans-ble-uwb",
      measurementKind: "position",
      positionXMeters: frame.position.xMeters,
      positionYMeters: frame.position.yMeters,
      positionZMeters: frame.position.zMeters,
      zCm: Math.round(frame.position.zMeters * 100),
      quality: frame.position.quality,
    });
  }

  frame.distances.forEach((distance) => {
    observations.push({
      mac: distance.anchorKey,
      observedAtMs,
      source: "pans-ble-uwb",
      measurementKind: "distance",
      distanceMeters: distance.distanceMeters,
      quality: distance.quality,
    });
  });

  return observations;
}

export function toAnchorKey(nodeId: number): string {
  return `uwb-anchor-${nodeId.toString(16).padStart(4, "0")}`;
}

function parsePosition(payload: number[], offset: number): PansPositionSample {
  const view = dataView(payload);
  const zMeters = view.getInt32(offset + 8, true) / 1000;
  return {
    xMeters: view.getInt32(offset, true) / 1000,
    yMeters: view.getInt32(offset + 4, true) / 1000,
    zMeters,
    zCm: Math.round(zMeters * 100),
    quality: payload[offset + 12] ?? 0,
  };
}

function parseDistance(payload: number[], offset: number): PansDistanceSample {
  const view = dataView(payload);
  const nodeId = view.getUint16(offset, true);
  return {
    nodeId,
    anchorKey: toAnchorKey(nodeId),
    distanceMeters: view.getUint32(offset + 2, true) / 1000,
    quality: payload[offset + 6] ?? 0,
  };
}

function bitsToUwbMode(bits: number): "off" | "passive" | "active" {
  if (bits === 0) return "off";
  if (bits === 1) return "passive";
  return "active";
}

function readUint64Hex(payload: number[], offset: number): string {
  let hex = "";
  for (let i = 7; i >= 0; i -= 1) {
    hex += payload[offset + i].toString(16).padStart(2, "0");
  }
  return hex;
}

function validatePayload(payload: number[]): number[] {
  if (
    !Array.isArray(payload) ||
    !payload.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    throw new Error("PANS payload must be an array of byte integers.");
  }
  return payload.slice();
}

function dataView(payload: number[]): DataView {
  const bytes = Uint8Array.from(payload);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
