import {
  DEFAULT_MFASA_OPTIONS,
  DEFAULT_TX_POWER_DBM,
} from "../LocalizationConfig";
import type {
  AnchorGeometry,
  LocalizationOptimizer,
  OptimizationInput,
  PositionEstimate,
  SearchBounds,
} from "../types";

interface Firefly {
  position: { x: number; y: number };
  error: number;
  intensity: number;
}

export interface MFASAOptions {
  populationSize: number;
  maxIterations: number;
  beta0: number;
  lightAbsorption: number;
  alpha: number;
  randomStepScale: number;
  initialTemperature: number;
  coolingRate: number;
  timeBudgetMs: number; // Per-slice time budget
  iterationTimeLimitMs?: number; // Total execution time limit
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function now(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export class MFASAOptimizer implements LocalizationOptimizer {
  private readonly options: MFASAOptions;
  private currentTimeout: any = null;
  private rejectCurrentSolve: ((reason?: any) => void) | null = null;

  constructor(options: Partial<MFASAOptions> = {}) {
    this.options = {
      ...DEFAULT_MFASA_OPTIONS,
      ...options,
    } as MFASAOptions;
  }

  cancel() {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    if (this.rejectCurrentSolve) {
      this.rejectCurrentSolve(new Error("Cancelled"));
      this.rejectCurrentSolve = null;
    }
  }

  solve(opts: OptimizationInput): Promise<PositionEstimate> {
    this.cancel(); // Cancel any previous solve

    const config: MFASAOptions = {
      ...this.options,
      timeBudgetMs: opts.timeBudgetMs ?? this.options.timeBudgetMs,
      iterationTimeLimitMs: opts.iterationTimeLimitMs,
    };

    const anchorMap = this.buildAnchorMap(opts.anchors);
    const metrics = { evaluations: 0 };
    const startTime = now();

    return new Promise((resolve, reject) => {
      this.rejectCurrentSolve = reject;
      const population = this.initializePopulation(
        config.populationSize,
        opts,
        anchorMap,
        metrics,
      );
      const initialPopulation = population.map((f) => ({
        x: f.position.x,
        y: f.position.y,
        error: f.error,
      }));

      let best = this.extractBest(population, 0);
      const initialError = best.errorRmse;
      let temperature = config.initialTemperature;
      let iteration = 0;

      const step = () => {
        this.currentTimeout = null;
        const stepStart = now();
        // Respect both maxIterations and iterationTimeLimitMs
        const hasTimeLimit =
          config.iterationTimeLimitMs !== undefined &&
          config.iterationTimeLimitMs > 0;

        while (iteration < config.maxIterations) {
          // Check total time limit
          if (
            hasTimeLimit &&
            now() - startTime >= config.iterationTimeLimitMs!
          ) {
            break;
          }

          this.performFireflyMoves(
            population,
            config,
            opts,
            anchorMap,
            metrics,
          );
          this.performSimulatedAnnealing(
            population,
            temperature,
            config,
            opts,
            anchorMap,
            metrics,
          );

          iteration += 1;
          temperature *= config.coolingRate;
          best = this.extractBest(population, iteration, best);

          if (now() - stepStart >= config.timeBudgetMs) {
            this.currentTimeout = setTimeout(step, 0);
            return;
          }
        }

        best.diagnostics = {
          executionTimeMs: now() - startTime,
          evaluations: metrics.evaluations,
          iterations: iteration,
          initialError,
          finalError: best.errorRmse,
          finalTemperature: temperature,
          initialPopulation,
          finalPopulation: population.map((f) => ({
            x: f.position.x,
            y: f.position.y,
            error: f.error,
          })),
        };
        this.rejectCurrentSolve = null;
        resolve(best);
      };

      step();
    });
  }

  private initializePopulation(
    size: number,
    opts: OptimizationInput,
    anchorMap: Map<string, AnchorGeometry>,
    metrics: { evaluations: number },
  ): Firefly[] {
    const fireflies: Firefly[] = [];
    for (let i = 0; i < size; i += 1) {
      const position =
        opts.initialPopulation?.[i] || this.randomPoint(opts.bounds);
      const error = this.evaluate(position, opts, anchorMap, metrics);
      fireflies.push({ position, error, intensity: -error });
    }
    return fireflies;
  }

  private extractBest(
    population: Firefly[],
    iterations: number,
    previous?: PositionEstimate,
  ): PositionEstimate {
    const bestFirefly = population.reduce((a, b) =>
      a.error <= b.error ? a : b,
    );
    if (previous && previous.errorRmse <= bestFirefly.error) {
      return previous;
    }
    return {
      x: bestFirefly.position.x,
      y: bestFirefly.position.y,
      errorRmse: bestFirefly.error,
      iterations,
    };
  }

  private performFireflyMoves(
    population: Firefly[],
    config: MFASAOptions,
    opts: OptimizationInput,
    anchorMap: Map<string, AnchorGeometry>,
    metrics: { evaluations: number },
  ) {
    for (let i = 0; i < population.length; i += 1) {
      for (let j = 0; j < population.length; j += 1) {
        if (population[j].intensity > population[i].intensity) {
          population[i] = this.moveTowards(
            population[i],
            population[j],
            config,
            opts,
            anchorMap,
            metrics,
          );
        }
      }
    }
  }

  private moveTowards(
    target: Firefly,
    attractor: Firefly,
    config: MFASAOptions,
    opts: OptimizationInput,
    anchorMap: Map<string, AnchorGeometry>,
    metrics: { evaluations: number },
  ): Firefly {
    const dx = attractor.position.x - target.position.x;
    const dy = attractor.position.y - target.position.y;
    const distance = Math.hypot(dx, dy);
    const beta =
      config.beta0 * Math.exp(-config.lightAbsorption * distance ** 2);

    const jitterX = (Math.random() - 0.5) * config.alpha;
    const jitterY = (Math.random() - 0.5) * config.alpha;

    const newX = clamp(
      target.position.x + beta * dx + jitterX,
      opts.bounds.xMin,
      opts.bounds.xMax,
    );
    const newY = clamp(
      target.position.y + beta * dy + jitterY,
      opts.bounds.yMin,
      opts.bounds.yMax,
    );

    const position = { x: newX, y: newY };
    const error = this.evaluate(position, opts, anchorMap, metrics);
    return { position, error, intensity: -error };
  }

  private performSimulatedAnnealing(
    population: Firefly[],
    temperature: number,
    config: MFASAOptions,
    opts: OptimizationInput,
    anchorMap: Map<string, AnchorGeometry>,
    metrics: { evaluations: number },
  ) {
    for (let i = 0; i < population.length; i += 1) {
      const candidatePosition = {
        x: clamp(
          population[i].position.x +
            (Math.random() - 0.5) * config.randomStepScale,
          opts.bounds.xMin,
          opts.bounds.xMax,
        ),
        y: clamp(
          population[i].position.y +
            (Math.random() - 0.5) * config.randomStepScale,
          opts.bounds.yMin,
          opts.bounds.yMax,
        ),
      };

      const candidateError = this.evaluate(
        candidatePosition,
        opts,
        anchorMap,
        metrics,
      );
      const delta = candidateError - population[i].error;

      if (delta < 0) {
        population[i] = {
          position: candidatePosition,
          error: candidateError,
          intensity: -candidateError,
        };
      } else {
        const acceptanceProbability = Math.exp(
          -delta / Math.max(temperature, 1e-6),
        );
        if (Math.random() < acceptanceProbability) {
          population[i] = {
            position: candidatePosition,
            error: candidateError,
            intensity: -candidateError,
          };
        }
      }
    }
  }

  private randomPoint(bounds: SearchBounds) {
    return {
      x: bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin),
      y: bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin),
    };
  }

  private evaluate(
    position: { x: number; y: number },
    opts: OptimizationInput,
    anchorMap: Map<string, AnchorGeometry>,
    metrics?: { evaluations: number },
  ): number {
    if (metrics) {
      metrics.evaluations += 1;
    }
    const { candidate, propagation, constants, weighting } = opts;
    if (!candidate.length || !anchorMap.size) {
      return Number.POSITIVE_INFINITY;
    }

    let weightedSumSq = 0;
    let sumWeights = 0;
    let used = 0;

    candidate.forEach((measurement) => {
      const anchor = anchorMap.get(measurement.mac);
      if (!anchor) return;

      const horizontalDistance = Math.hypot(
        position.x - anchor.x,
        position.y - anchor.y,
      );

      let diff = Number.NaN;
      if (Number.isFinite(measurement.distanceMeters)) {
        diff = (measurement.distanceMeters as number) - horizontalDistance;
      } else if (Number.isFinite(measurement.filteredRssi)) {
        const txPower = measurement.txPower ?? DEFAULT_TX_POWER_DBM;
        const estimated = propagation.estimateRssi({
          distanceMeters: horizontalDistance,
          txPowerDbm: txPower,
          constants,
        });
        diff = measurement.filteredRssi - estimated;
      }

      if (!Number.isFinite(diff)) {
        return;
      }

      let weight = 1.0;
      if (weighting?.enabled) {
        // Use filtered RSSI magnitude as proxy for distance/quality
        const rssi = measurement.filteredRssi;
        const base = weighting.base ?? 120;
        const scale = weighting.scale ?? 1.0;
        const param = weighting.param ?? 1.0;

        if (weighting.model === "linear") {
          // Default: Math.max(1, 120 + rssi)
          if (Number.isFinite(rssi)) {
            weight = Math.max(1, (base + rssi) * scale);
          }
        } else if (weighting.model === "inverse-rssi") {
          // Default: 1.0 / |RSSI|
          if (Number.isFinite(rssi)) {
            weight = scale / Math.pow(Math.abs(Math.min(-1, rssi)), param);
          }
        }
      }

      weightedSumSq += weight * diff ** 2;
      sumWeights += weight;
      used += 1;
    });

    if (!used || sumWeights === 0) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.sqrt(weightedSumSq / sumWeights);
  }

  private buildAnchorMap(anchors: AnchorGeometry[]) {
    const map = new Map<string, AnchorGeometry>();
    anchors.forEach((anchor) => {
      map.set(anchor.mac, anchor);
    });
    return map;
  }
}
