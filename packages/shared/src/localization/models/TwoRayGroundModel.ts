import { PropagationModel, PropagationConstants } from "../types";

const SPEED_OF_LIGHT = 299_792_458; // meters per second
const MIN_DISTANCE = 0.1; // meters, avoid division by zero close to anchor

/**
 * Implements equation set (2)-(6) from the provided paper.
 */
export class TwoRayGroundModel implements PropagationModel {
  estimateRssi({
    distanceMeters,
    txPowerDbm,
    constants,
  }: {
    distanceMeters: number;
    txPowerDbm: number;
    constants: PropagationConstants;
  }): number {
    const d = Math.max(distanceMeters, MIN_DISTANCE);
    const {
      transmitterHeightMeters: ht,
      receiverHeightMeters: hr,
      frequencyHz,
      transmitterGain,
      receiverGain,
      reflectionCoefficient,
    } = constants;

    const wavelength = SPEED_OF_LIGHT / frequencyHz;
    const l = Math.sqrt((ht - hr) ** 2 + d ** 2);
    const xPlusXPrime = Math.sqrt((ht + hr) ** 2 + d ** 2);
    const deltaPhi = (2 * Math.PI * (xPlusXPrime - l)) / wavelength;

    const combinedGainRoot = Math.sqrt(transmitterGain * receiverGain);
    const directComponent = combinedGainRoot / l;
    const reflectedComponentMagnitude =
      (reflectionCoefficient * combinedGainRoot) / xPlusXPrime;

    const real =
      directComponent + reflectedComponentMagnitude * Math.cos(deltaPhi);
    const imaginary = -reflectedComponentMagnitude * Math.sin(deltaPhi);
    const magnitudeSquared = real ** 2 + imaginary ** 2;

    const txPowerMilliwatt = 10 ** (txPowerDbm / 10);
    const scalar = (wavelength / (4 * Math.PI)) ** 2;
    const receivedMilliwatt =
      txPowerMilliwatt * scalar * Math.max(magnitudeSquared, Number.EPSILON);

    return 10 * Math.log10(receivedMilliwatt);
  }
}
