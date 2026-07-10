import {
  decodeAnchorList,
  decodeLocationData,
  decodeOperationMode,
  decodePresenceData,
  decodeProxyPositions,
} from "expo-pans-ble-api";
import type {
  PansAnchorList,
  PansLocationData,
  PansOperationMode,
  PansPresenceData,
  PansProxyPosition,
} from "expo-pans-ble-api";
import { LocalizationObservation } from "../localization/types";

export type PansDistanceSample = PansLocationData["distances"][number];
export type PansPositionSample = NonNullable<PansLocationData["position"]>;
export type PansLocationDataFrame = PansLocationData;
export type PansProxyPositionSample = PansProxyPosition;
export type PansOperationModeSample = PansOperationMode;
export type PansPresenceSample = PansPresenceData;
export type PansAnchorListSample = PansAnchorList;

export const parsePansLocationDataPayload = decodeLocationData;
export const parsePansProxyPositionsPayload = decodeProxyPositions;
export const parsePansOperationModePayload = decodeOperationMode;
export const parsePansPresencePayload = decodePresenceData;
export const parseAnchorListPayload = decodeAnchorList;

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
