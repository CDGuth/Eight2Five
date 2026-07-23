import type { PansLocationNotification } from "../PansDeviceSessionManager";

export type SyntheticPansNotificationRateHz = 1 | 10;

export interface SyntheticPansPositionNotification extends PansLocationNotification {
  sequence: number;
  emittedAtMs: number;
}

export interface SyntheticPansPositionNotificationSourceOptions {
  rateHz: SyntheticPansNotificationRateHz;
  transportDeviceId?: string;
  startAtMs?: number;
}

/**
 * A timer-free PANS position source for deterministic throughput tests.
 * Durations use a half-open interval, so 10 Hz for 60 seconds emits 600 times.
 */
export class SyntheticPansPositionNotificationSource {
  private readonly listeners = new Set<
    (event: SyntheticPansPositionNotification) => void
  >();
  private readonly intervalMs: number;
  private readonly transportDeviceId: string;
  private nextEmittedAtMs: number;
  private sequence = 0;

  constructor(options: SyntheticPansPositionNotificationSourceOptions) {
    this.intervalMs = 1_000 / options.rateHz;
    this.transportDeviceId = options.transportDeviceId ?? "synthetic-pans-tag";
    this.nextEmittedAtMs = options.startAtMs ?? 0;
  }

  get emittedCount(): number {
    return this.sequence;
  }

  addListener(listener: (event: SyntheticPansPositionNotification) => void): {
    remove(): void;
  } {
    this.listeners.add(listener);
    return { remove: () => this.listeners.delete(listener) };
  }

  emitForDuration(durationMs: number): number {
    if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
      throw new Error("durationMs must be a nonnegative safe integer");
    }

    const endAtMs = this.nextEmittedAtMs + durationMs;
    const startCount = this.sequence;
    while (this.nextEmittedAtMs < endAtMs) this.emitNext();
    return this.sequence - startCount;
  }

  emitNext(): SyntheticPansPositionNotification {
    const event: SyntheticPansPositionNotification = {
      transportDeviceId: this.transportDeviceId,
      sequence: this.sequence,
      emittedAtMs: this.nextEmittedAtMs,
      monotonicTimestampMs: this.nextEmittedAtMs,
      payload: positionPacket(this.sequence),
      payloadLength: 14,
    };
    this.sequence += 1;
    this.nextEmittedAtMs += this.intervalMs;
    [...this.listeners].forEach((listener) => listener(event));
    return event;
  }
}

function positionPacket(sequence: number): number[] {
  const bytes = new Uint8Array(14);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0;
  view.setInt32(1, sequence, true);
  view.setInt32(5, sequence * 2, true);
  view.setInt32(9, 0, true);
  bytes[13] = 100;
  return Array.from(bytes);
}
