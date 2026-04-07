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
  zCm: number;
  quality: number;
}

export interface PansLocationDataFrame {
  position?: PansPositionSample;
  distances: PansDistanceSample[];
}

export function parsePansLocationDataPayload(
  payload: number[],
): PansLocationDataFrame {
  if (!payload.length) {
    return { distances: [] };
  }

  const view = new DataView(Uint8Array.from(payload).buffer);
  const frameType = payload[0];

  let position: PansPositionSample | undefined;
  let distancesOffset = 1;

  if ((frameType === 0 || frameType === 2) && payload.length >= 14) {
    position = {
      xMeters: view.getInt32(1, true) / 1000,
      yMeters: view.getInt32(5, true) / 1000,
      zCm: view.getInt32(9, true),
      quality: payload[13] ?? 100,
    };
    distancesOffset = 14;
  }

  const distances: PansDistanceSample[] = [];
  if (
    (frameType === 1 || frameType === 2) &&
    payload.length > distancesOffset
  ) {
    const count = payload[distancesOffset] ?? 0;
    let index = distancesOffset + 1;

    for (let i = 0; i < count; i += 1) {
      if (index + 7 > payload.length) break;

      const nodeId = view.getUint16(index, true);
      const distMm = view.getUint32(index + 2, true);
      const quality = payload[index + 6] ?? 0;

      distances.push({
        nodeId,
        anchorKey: toAnchorKey(nodeId),
        distanceMeters: distMm / 1000,
        quality,
      });

      index += 7;
    }
  }

  return {
    position,
    distances,
  };
}

export function locationFrameToObservations(
  macAddress: string,
  frame: PansLocationDataFrame,
  observedAtMs: number = Date.now(),
): LocalizationObservation[] {
  const observations: LocalizationObservation[] = [];

  if (frame.position) {
    observations.push({
      mac: macAddress,
      observedAtMs,
      source: "pans-ble-uwb",
      measurementKind: "position",
      positionXMeters: frame.position.xMeters,
      positionYMeters: frame.position.yMeters,
      zCm: frame.position.zCm,
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
