import { PropagationModel, PropagationConstants } from "../types";

export interface LogNormalOptions {
  referenceDistanceMeters?: number;
  referencePathLossDb?: number;
  pathLossExponent?: number;
}

/**
 * Classic log-distance path-loss model. Useful indoors where reflections are
 * dominated by walls rather than ground interactions.
 */
export class LogNormalModel implements PropagationModel {
  private readonly referenceDistance: number;
  private readonly referencePathLossDb: number;
  private readonly pathLossExponent: number;

  constructor(options: LogNormalOptions = {}) {
    this.referenceDistance = options.referenceDistanceMeters ?? 1;
    this.referencePathLossDb = options.referencePathLossDb ?? 40;
    this.pathLossExponent = options.pathLossExponent ?? 2;
  }

  estimateRssi({
    distanceMeters,
    txPowerDbm,
  }: {
    distanceMeters: number;
    txPowerDbm: number;
    constants: PropagationConstants;
  }): number {
    const d = Math.max(distanceMeters, this.referenceDistance);
    const loss =
      this.referencePathLossDb +
      10 * this.pathLossExponent * Math.log10(d / this.referenceDistance);

    return txPowerDbm - loss;
  }
}
