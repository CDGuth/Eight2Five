import { RssiFilter } from "../types";

export interface KalmanFilterOptions {
  processNoise?: number;
  measurementNoise?: number;
  initialEstimate?: number;
  initialErrorCovariance?: number;
}

/**
 * Lightweight 1D Kalman filter tuned for RSSI smoothing.
 * The filter assumes a static process model, which is appropriate for RSSI
 * streams where the state (true signal strength) evolves slowly compared to
 * the sample interval.
 */
export class KalmanFilter implements RssiFilter {
  private readonly processNoise: number;
  private readonly measurementNoise: number;
  private estimate: number | undefined;
  private errorCovariance: number;

  constructor(options: KalmanFilterOptions = {}) {
    this.processNoise = options.processNoise ?? 0.01;
    this.measurementNoise = options.measurementNoise ?? 3;
    this.errorCovariance = options.initialErrorCovariance ?? 1;
    this.estimate = options.initialEstimate;
  }

  filterSample(rssi: number): number {
    if (this.estimate === undefined) {
      this.estimate = rssi;
      return rssi;
    }

    // Predict step (identity state transition)
    const predictedEstimate = this.estimate;
    const predictedError = this.errorCovariance + this.processNoise;

    // Update step
    const kalmanGain =
      predictedError / (predictedError + this.measurementNoise);
    const innovation = rssi - predictedEstimate;
    this.estimate = predictedEstimate + kalmanGain * innovation;
    this.errorCovariance = (1 - kalmanGain) * predictedError;

    return this.estimate;
  }
}
