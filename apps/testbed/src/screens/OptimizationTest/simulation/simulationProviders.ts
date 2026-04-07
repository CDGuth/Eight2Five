import { KalmanFilter } from "@eight2five/shared/localization/filters/KalmanFilter";
import { DEFAULT_KALMAN_CONFIG } from "@eight2five/shared/localization/LocalizationConfig";
import {
  AnchorGeometry,
  BeaconMeasurement,
  PropagationConstants,
  PropagationModel,
} from "@eight2five/shared/localization/types";
import { SimulationSourceMode } from "../types";

interface SimulationGenerationInput {
  anchors: AnchorGeometry[];
  truePosition: { x: number; y: number };
  propagationModel: PropagationModel;
  constants: PropagationConstants;
  sourceMode: SimulationSourceMode;
  txPowerDbm: number;
  sampleCount: number;
  isNoiseEnabled: boolean;
  noiseWeightingModel: "linear" | "logarithmic" | "exponential";
  noiseBase: number;
  noiseScale: number;
  noiseParameter: number;
  uwbDistanceSigma: number;
}

interface SimulationGenerationResult {
  candidates: BeaconMeasurement[];
  measurementKinds: ("rssi" | "distance")[];
}

function sampleGaussian(): number {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

function estimateNoiseSigma(params: {
  distanceMeters: number;
  enabled: boolean;
  model: "linear" | "logarithmic" | "exponential";
  base: number;
  scale: number;
  parameter: number;
}): number {
  if (!params.enabled) return 0;

  if (params.model === "logarithmic") {
    return (
      params.base +
      params.scale * Math.log(1 + params.distanceMeters) * params.parameter
    );
  }

  if (params.model === "exponential") {
    return (
      params.base +
      params.scale * Math.exp(params.distanceMeters / (params.parameter || 20))
    );
  }

  return params.base + params.scale * params.distanceMeters;
}

function generateBleRssiCandidates(
  input: SimulationGenerationInput,
): BeaconMeasurement[] {
  const candidates: BeaconMeasurement[] = [];

  input.anchors.forEach((anchor) => {
    const dist = Math.hypot(
      input.truePosition.x - anchor.x,
      input.truePosition.y - anchor.y,
    );

    const trueRssi = input.propagationModel.estimateRssi({
      distanceMeters: dist,
      txPowerDbm: input.txPowerDbm,
      constants: input.constants,
    });

    const sigma = estimateNoiseSigma({
      distanceMeters: dist,
      enabled: input.isNoiseEnabled,
      model: input.noiseWeightingModel,
      base: input.noiseBase,
      scale: input.noiseScale,
      parameter: input.noiseParameter,
    });

    const kf = new KalmanFilter({
      processNoise: DEFAULT_KALMAN_CONFIG.processNoise,
      measurementNoise: sigma ** 2,
    });

    let filteredRssi = trueRssi;
    for (let i = 0; i < input.sampleCount; i++) {
      const noisyRssi = trueRssi + sampleGaussian() * sigma;
      filteredRssi = kf.filterSample(noisyRssi);
    }

    candidates.push({
      mac: anchor.mac,
      lastSeen: Date.now(),
      filteredRssi,
      txPower: input.txPowerDbm,
      measurementKind: "rssi",
      source: "testbed-sim-ble",
    });
  });

  return candidates;
}

function generateUwbDistanceCandidates(
  input: SimulationGenerationInput,
): BeaconMeasurement[] {
  const candidates: BeaconMeasurement[] = [];

  input.anchors.forEach((anchor) => {
    const dist = Math.hypot(
      input.truePosition.x - anchor.x,
      input.truePosition.y - anchor.y,
    );

    const noisyDistance = Math.max(
      0,
      dist + sampleGaussian() * input.uwbDistanceSigma,
    );

    candidates.push({
      mac: anchor.mac,
      lastSeen: Date.now(),
      filteredRssi: Number.NaN,
      distanceMeters: noisyDistance,
      txPower: input.txPowerDbm,
      measurementKind: "distance",
      source: "testbed-sim-uwb",
    });
  });

  return candidates;
}

export function generateSimulationCandidates(
  input: SimulationGenerationInput,
): SimulationGenerationResult {
  const candidates: BeaconMeasurement[] = [];
  const measurementKinds = new Set<"rssi" | "distance">();

  if (input.sourceMode === "ble-rssi" || input.sourceMode === "hybrid") {
    candidates.push(...generateBleRssiCandidates(input));
    measurementKinds.add("rssi");
  }

  if (input.sourceMode === "uwb-distance" || input.sourceMode === "hybrid") {
    candidates.push(...generateUwbDistanceCandidates(input));
    measurementKinds.add("distance");
  }

  return {
    candidates,
    measurementKinds: Array.from(measurementKinds),
  };
}
