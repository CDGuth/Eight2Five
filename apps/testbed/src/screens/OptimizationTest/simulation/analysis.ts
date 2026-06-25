import { BatchAnalysis, RunResult } from "../types";

/**
 * Computes aggregate batch statistics from a list of run results.
 *
 * Returns `null` when there are no results, matching the hook's previous
 * behaviour of only setting analysis when `errors.length > 0`.
 *
 * This is a pure function.
 */
export function analyzeBatch(results: RunResult[]): BatchAnalysis | null {
  const errors = results.map((r) => r.error);
  if (errors.length === 0) return null;

  const n = errors.length;
  const avgError = errors.reduce((a, b) => a + b, 0) / n;
  const avgDuration = results.reduce((a, b) => a + b.duration, 0) / n;
  const avgIter = results.reduce((a, b) => a + b.iterations, 0) / n;
  const rmse = Math.sqrt(errors.reduce((a, b) => a + b * b, 0) / n);
  const avgRssiRmse = results.reduce((a, b) => a + b.rssiRmse, 0) / n;
  const stdDev = Math.sqrt(
    errors.reduce((a, b) => a + Math.pow(b - avgError, 2), 0) / n,
  );
  const sortedErrors = [...errors].sort((a, b) => a - b);
  const medianError =
    n % 2 === 0
      ? (sortedErrors[n / 2 - 1] + sortedErrors[n / 2]) / 2
      : sortedErrors[Math.floor(n / 2)];

  const successRate1m = (errors.filter((e) => e < 1).length / n) * 100;
  const successRate2m = (errors.filter((e) => e < 2).length / n) * 100;

  return {
    avgError,
    stdDev,
    rmse,
    avgRssiRmse,
    medianError,
    minError: sortedErrors[0],
    maxError: sortedErrors[n - 1],
    avgDuration,
    avgIterations: avgIter,
    successRate1m,
    successRate2m,
    totalRuns: n,
    bestRuns: [...results].sort((a, b) => a.error - b.error),
  };
}
