import type { PansDistance, PansPosition } from "expo-pans-ble-api";
import { ManagerError } from "./errors";
import type { PansManagerRepository } from "./PansManagerRepository";
import type { PositionLogSample, PositionLogSession } from "./types";

export interface StartPositionLogOptions {
  id?: string;
  networkId: string;
  panId: number;
  deviceId: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface AppendPositionSampleOptions {
  timestampMs?: number;
  nodeId?: string;
  label?: string;
  solver: string;
  anchorCount: number;
  distances?: PansDistance[];
  notes?: string;
  eventMarker?: string;
}

export interface PositionLogIngestionCounters {
  readonly accepted: number;
  readonly persisted: number;
  readonly droppedBackpressure: number;
  readonly droppedInvalid: number;
  readonly queuedSamples: number;
  readonly highWaterMark: number;
  readonly flushes: number;
  readonly flushFailures: number;
  readonly lastError?: string;
  readonly lastErrorAt?: number;
}

export type PositionLogIngestRejectionReason =
  | "backpressure"
  | "invalid"
  | "closed"
  | "unknown-session";

export type PositionLogIngestResult =
  | {
      readonly accepted: true;
      readonly sample: PositionLogSample;
      readonly counters: PositionLogIngestionCounters;
    }
  | {
      readonly accepted: false;
      readonly reason: PositionLogIngestRejectionReason;
      readonly error: ManagerError;
      readonly counters: PositionLogIngestionCounters;
    };

export interface PansPositionLogServiceOptions {
  memoryCap?: number;
  flushSize?: number;
  flushLatencyMs?: number;
  now?: () => number;
  createId?: () => string;
}

interface MutableCounters {
  accepted: number;
  persisted: number;
  droppedBackpressure: number;
  droppedInvalid: number;
  queuedSamples: number;
  highWaterMark: number;
  flushes: number;
  flushFailures: number;
  lastError?: string;
  lastErrorAt?: number;
}

interface SessionState {
  session: PositionLogSession;
  pending: PositionLogSample[];
  inFlight?: PositionLogSample[];
  flushPromise?: Promise<void>;
  flushTimer?: ReturnType<typeof setTimeout>;
  latencyFlushRequested?: boolean;
  nextSequence: number;
  accepting: boolean;
  counters: MutableCounters;
}

const EMPTY_COUNTERS: PositionLogIngestionCounters = Object.freeze({
  accepted: 0,
  persisted: 0,
  droppedBackpressure: 0,
  droppedInvalid: 0,
  queuedSamples: 0,
  highWaterMark: 0,
  flushes: 0,
  flushFailures: 0,
});

export class PansPositionLogService {
  private readonly states = new Map<string, SessionState>();
  private readonly unknownSessionCounters = new Map<string, MutableCounters>();
  private readonly memoryCap: number;
  private readonly flushSize: number;
  private readonly flushLatencyMs: number;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(
    private readonly repository: PansManagerRepository,
    options: PansPositionLogServiceOptions = {},
  ) {
    this.memoryCap = Math.max(1, options.memoryCap ?? 1_000);
    this.flushSize = Math.max(
      1,
      Math.min(options.flushSize ?? 100, this.memoryCap),
    );
    this.flushLatencyMs = Math.max(1, options.flushLatencyMs ?? 1_000);
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? defaultId;
  }

  async startSession(
    options: StartPositionLogOptions,
  ): Promise<PositionLogSession> {
    const session: PositionLogSession = {
      id: options.id ?? this.createId(),
      networkId: options.networkId,
      panId: options.panId,
      deviceId: options.deviceId,
      startedAt: this.now(),
      ...(options.notes !== undefined ? { notes: options.notes } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    };
    await this.repository.savePositionLogSession(session);
    this.unknownSessionCounters.delete(session.id);
    this.states.set(session.id, {
      session,
      pending: [],
      nextSequence: 0,
      accepting: true,
      counters: { ...EMPTY_COUNTERS },
    });
    return session;
  }

  /** Synchronous, allocation-bounded position stream hot path. */
  ingestSample(
    sessionId: string,
    position: PansPosition,
    options: AppendPositionSampleOptions,
  ): PositionLogIngestResult {
    const state = this.states.get(sessionId);
    if (!state)
      return this.rejectUnknown(
        sessionId,
        "The position log session does not exist.",
      );
    if (!state.accepting || state.session.endedAt !== undefined)
      return this.reject(
        state,
        "closed",
        "The position log session is already closed.",
      );
    if (!isValidLoggedPosition(position))
      return this.reject(state, "invalid", "The position sample is invalid.");
    if (state.counters.queuedSamples >= this.memoryCap) {
      state.counters.droppedBackpressure += 1;
      return {
        accepted: false,
        reason: "backpressure",
        error: new ManagerError(
          "STORAGE_FAILURE",
          "The position log pending queue is full.",
        ),
        counters: snapshotCounters(state.counters),
      };
    }

    const sequence = state.nextSequence;
    const sample: PositionLogSample = {
      sessionId,
      sequence,
      timestampMs: options.timestampMs ?? this.now(),
      networkId: state.session.networkId,
      panId: state.session.panId,
      deviceId: state.session.deviceId,
      ...(options.nodeId !== undefined ? { nodeId: options.nodeId } : {}),
      ...(options.label !== undefined ? { label: options.label } : {}),
      xMeters: position.xMeters,
      yMeters: position.yMeters,
      zMeters: position.zMeters,
      quality: position.quality,
      solver: options.solver,
      anchorCount: options.anchorCount,
      ...(options.distances ? { distances: options.distances } : {}),
      ...(options.notes !== undefined ? { notes: options.notes } : {}),
      ...(options.eventMarker !== undefined
        ? { eventMarker: options.eventMarker }
        : {}),
    };
    state.nextSequence += 1;
    state.pending.push(sample);
    state.counters.accepted += 1;
    state.counters.queuedSamples += 1;
    state.counters.highWaterMark = Math.max(
      state.counters.highWaterMark,
      state.counters.queuedSamples,
    );
    if (state.pending.length >= this.flushSize) this.requestFlush(state);
    else this.ensureFlushTimer(state);
    return {
      accepted: true,
      sample,
      counters: snapshotCounters(state.counters),
    };
  }

  async appendSample(
    sessionId: string,
    position: PansPosition,
    options: AppendPositionSampleOptions,
  ): Promise<PositionLogSample> {
    const result = this.ingestSample(sessionId, position, options);
    if (!result.accepted) throw result.error;
    return result.sample;
  }

  getIngestionCounters(sessionId: string): PositionLogIngestionCounters {
    const state = this.states.get(sessionId);
    const counters =
      state?.counters ?? this.unknownSessionCounters.get(sessionId);
    return counters ? snapshotCounters(counters) : EMPTY_COUNTERS;
  }

  async flush(sessionId?: string): Promise<void> {
    const states = sessionId
      ? [this.states.get(sessionId)].filter(
          (state): state is SessionState => state !== undefined,
        )
      : [...this.states.values()];
    for (const state of states) await this.drain(state);
  }

  async stopSession(
    sessionId: string,
  ): Promise<PositionLogSession | undefined> {
    const state = this.states.get(sessionId);
    if (!state) {
      const session = await this.repository.getPositionLogSession(sessionId);
      if (!session || session.endedAt !== undefined) return session;
      const finished = { ...session, endedAt: this.now() };
      await this.repository.savePositionLogSession(finished);
      return finished;
    }
    state.accepting = false;
    this.clearFlushTimer(state);
    await this.drain(state);
    const finished = { ...state.session, endedAt: this.now() };
    await this.repository.savePositionLogSession(finished);
    state.session = finished;
    return finished;
  }

  async exportCsv(sessionId: string): Promise<string> {
    await this.flush(sessionId);
    const samples = await this.repository.listPositionLogSamples(sessionId);
    const rows: unknown[][] = [
      [
        "timestamp_iso",
        "timestamp_ms",
        "network_id",
        "pan_id",
        "device_id",
        "node_id",
        "label",
        "x_m",
        "y_m",
        "z_m",
        "quality",
        "solver",
        "anchor_count",
      ],
      ...samples.map((sample) => [
        new Date(sample.timestampMs).toISOString(),
        sample.timestampMs,
        sample.networkId,
        sample.panId,
        sample.deviceId,
        sample.nodeId ?? "",
        sample.label ?? "",
        sample.xMeters,
        sample.yMeters,
        sample.zMeters,
        sample.quality,
        sample.solver,
        sample.anchorCount,
      ]),
    ];
    return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  async exportJson(sessionId: string): Promise<string> {
    await this.flush(sessionId);
    const session = await this.repository.getPositionLogSession(sessionId);
    const samples = await this.repository.listPositionLogSamples(sessionId);
    return JSON.stringify({ session, samples });
  }

  private reject(
    state: SessionState,
    reason: Exclude<PositionLogIngestRejectionReason, "backpressure">,
    message: string,
  ): PositionLogIngestResult {
    state.counters.droppedInvalid += 1;
    return {
      accepted: false,
      reason,
      error: new ManagerError("INVALID_CONFIGURATION", message),
      counters: snapshotCounters(state.counters),
    };
  }

  private rejectUnknown(
    sessionId: string,
    message: string,
  ): PositionLogIngestResult {
    const counters = this.unknownSessionCounters.get(sessionId) ?? {
      ...EMPTY_COUNTERS,
    };
    counters.droppedInvalid += 1;
    this.unknownSessionCounters.set(sessionId, counters);
    return {
      accepted: false,
      reason: "unknown-session",
      error: new ManagerError("INVALID_CONFIGURATION", message),
      counters: snapshotCounters(counters),
    };
  }

  private requestFlush(state: SessionState): void {
    const flush = this.startFlush(state);
    if (flush) void flush.catch(() => undefined);
  }

  private startFlush(state: SessionState): Promise<void> | undefined {
    if (state.flushPromise || !state.pending.length) return state.flushPromise;
    this.clearFlushTimer(state);
    const batch = state.pending.splice(0, this.flushSize);
    state.inFlight = batch;
    let succeeded = false;
    const promise = this.repository.appendPositionLogSamples(batch).then(
      () => {
        succeeded = true;
        state.counters.persisted += batch.length;
        state.counters.queuedSamples -= batch.length;
        state.counters.flushes += 1;
        state.inFlight = undefined;
      },
      (error: unknown) => {
        // No accepted work can exceed memoryCap (in-flight work counts toward
        // queuedSamples), so prepending always remains bounded and ordered.
        state.pending = [...batch, ...state.pending];
        state.inFlight = undefined;
        state.counters.flushFailures += 1;
        state.counters.lastError = errorMessage(error);
        state.counters.lastErrorAt = this.now();
        throw error;
      },
    );
    state.flushPromise = promise.finally(() => {
      state.flushPromise = undefined;
      if (
        succeeded &&
        (state.pending.length >= this.flushSize || state.latencyFlushRequested)
      ) {
        state.latencyFlushRequested = false;
        this.requestFlush(state);
      } else if (state.pending.length) {
        state.latencyFlushRequested = false;
        this.ensureFlushTimer(state);
      }
    });
    return state.flushPromise;
  }

  private async drain(state: SessionState): Promise<void> {
    this.clearFlushTimer(state);
    while (state.counters.queuedSamples > 0) {
      const flush = state.flushPromise ?? this.startFlush(state);
      if (!flush) return;
      await flush;
    }
  }

  private ensureFlushTimer(state: SessionState): void {
    if (state.flushTimer || !state.pending.length) return;
    state.flushTimer = setTimeout(() => {
      state.flushTimer = undefined;
      if (state.flushPromise) state.latencyFlushRequested = true;
      else this.requestFlush(state);
    }, this.flushLatencyMs);
  }

  private clearFlushTimer(state: SessionState): void {
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.flushTimer = undefined;
  }
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isValidLoggedPosition(position: PansPosition): boolean {
  return (
    Number.isFinite(position.xMeters) &&
    Number.isFinite(position.yMeters) &&
    Number.isFinite(position.zMeters) &&
    Number.isFinite(position.quality) &&
    position.quality >= 0 &&
    position.quality <= 100
  );
}

function snapshotCounters(
  counters: MutableCounters,
): PositionLogIngestionCounters {
  return Object.freeze({ ...counters });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultId(): string {
  return `position-log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
