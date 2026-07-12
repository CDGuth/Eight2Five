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

export interface PansPositionLogServiceOptions {
  memoryCap?: number;
  flushSize?: number;
  now?: () => number;
  createId?: () => string;
}

export class PansPositionLogService {
  private readonly buffers = new Map<string, PositionLogSample[]>();
  private readonly sessions = new Map<string, PositionLogSession>();
  private readonly nextSequences = new Map<string, number>();
  private readonly memoryCap: number;
  private readonly flushSize: number;
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
    this.sessions.set(session.id, session);
    this.buffers.set(session.id, []);
    this.nextSequences.set(session.id, 0);
    return session;
  }

  async appendSample(
    sessionId: string,
    position: PansPosition,
    options: AppendPositionSampleOptions,
  ): Promise<PositionLogSample> {
    validateLoggedPosition(position);
    const session =
      this.sessions.get(sessionId) ??
      (await this.repository.getPositionLogSession(sessionId));
    if (!session) {
      throw new ManagerError(
        "STORAGE_FAILURE",
        "The position log session does not exist.",
      );
    }
    this.sessions.set(sessionId, session);
    const sequence = this.nextSequences.get(sessionId) ?? 0;
    const sample: PositionLogSample = {
      sessionId,
      sequence,
      timestampMs: options.timestampMs ?? this.now(),
      networkId: session.networkId,
      panId: session.panId,
      deviceId: session.deviceId,
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
    this.nextSequences.set(sessionId, sequence + 1);
    const buffer = this.buffers.get(sessionId) ?? [];
    buffer.push(sample);
    if (buffer.length > this.memoryCap)
      buffer.splice(0, buffer.length - this.memoryCap);
    this.buffers.set(sessionId, buffer);
    if (buffer.length >= this.flushSize) await this.flush(sessionId);
    return sample;
  }

  async flush(sessionId?: string): Promise<void> {
    const sessionIds = sessionId
      ? [sessionId]
      : Array.from(this.buffers.keys());
    for (const id of sessionIds) {
      const samples = this.buffers.get(id) ?? [];
      if (!samples.length) continue;
      await this.repository.appendPositionLogSamples(samples);
      this.buffers.set(id, []);
    }
  }

  async stopSession(
    sessionId: string,
  ): Promise<PositionLogSession | undefined> {
    await this.flush(sessionId);
    const session = await this.repository.getPositionLogSession(sessionId);
    if (!session) return undefined;
    const finished = { ...session, endedAt: this.now() };
    await this.repository.savePositionLogSession(finished);
    this.buffers.delete(sessionId);
    this.sessions.delete(sessionId);
    this.nextSequences.delete(sessionId);
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
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function validateLoggedPosition(position: PansPosition): void {
  if (
    !Number.isFinite(position.xMeters) ||
    !Number.isFinite(position.yMeters) ||
    !Number.isFinite(position.zMeters) ||
    !Number.isFinite(position.quality) ||
    position.quality < 0 ||
    position.quality > 100
  ) {
    throw new ManagerError(
      "INVALID_CONFIGURATION",
      "The position sample is invalid.",
    );
  }
}

function defaultId(): string {
  return `position-log-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
