import { formatMarchingCoordinate } from "@eight2five/mobile/field";
import type { FieldPoint } from "@eight2five/mobile/field";
import type { PansPositionStreamSample } from "@eight2five/mobile/pans-manager";
import type { SharedValue } from "react-native-reanimated";

import {
  pansPositionToFieldPoint,
  staleLivePosition,
  type MobilePansSnapshot,
} from "./mobile-pans-model";

const HUD_PUBLICATION_INTERVAL_MS = 100;

interface PositionPublisherHost {
  readonly staleAfterMs: number;
  readonly schedule: typeof setTimeout;
  readonly cancel: typeof clearTimeout;
  isConnectionCurrent(generation: number): boolean;
  getSnapshot(): MobilePansSnapshot;
  publish(snapshot: MobilePansSnapshot): void;
}

/** Publishes high-rate samples to Skia and coalesced human-readable state to React. */
export class MobilePansPositionPublisher {
  private positionValue?: SharedValue<FieldPoint | null>;
  private staleTimer?: ReturnType<typeof setTimeout>;
  private lastHudPublicationAt = 0;
  private lastHudKey?: string;
  private sampleTimes: number[] = [];

  constructor(private readonly host: PositionPublisherHost) {}

  attachPositionValue(value: SharedValue<FieldPoint | null>): void {
    if (this.positionValue && this.positionValue !== value) {
      this.positionValue.value = null;
    }
    this.positionValue = value;
    const live = this.host.getSnapshot().livePosition;
    value.value = live.isStale ? null : (live.position ?? null);
  }

  receiveSample(sample: PansPositionStreamSample, generation: number): void {
    if (!this.host.isConnectionCurrent(generation) || !sample.position) return;
    const fieldPoint = pansPositionToFieldPoint(sample.position);
    if (this.positionValue) this.positionValue.value = fieldPoint;
    const receivedAt = sample.receivedAt;
    this.sampleTimes = this.sampleTimes.filter(
      (time) => receivedAt - time <= 1_000,
    );
    this.sampleTimes.push(receivedAt);
    this.scheduleStale(generation);
    const hudKey = formatMarchingCoordinate(fieldPoint);
    if (
      hudKey === this.lastHudKey &&
      receivedAt - this.lastHudPublicationAt < HUD_PUBLICATION_INTERVAL_MS
    ) {
      return;
    }
    this.lastHudKey = hudKey;
    this.lastHudPublicationAt = receivedAt;
    const snapshot = this.host.getSnapshot();
    this.host.publish({
      ...snapshot,
      connectionState: "connected",
      livePosition: {
        connectionState: "connected",
        position: fieldPoint,
        receivedAt,
        isStale: false,
      },
      rawPosition: {
        xMeters: sample.position.xMeters,
        yMeters: sample.position.yMeters,
        zMeters: sample.position.zMeters,
      },
      lastUpdateAt: receivedAt,
      effectiveUpdateRateHz: effectiveRate(this.sampleTimes),
      error: undefined,
    });
  }

  receiveDiagnostic(message: string, generation: number): void {
    if (!this.host.isConnectionCurrent(generation)) return;
    const snapshot = this.host.getSnapshot();
    this.host.publish({
      ...snapshot,
      diagnosticMessages: [...snapshot.diagnosticMessages, message].slice(-8),
    });
  }

  resetStreamState(): void {
    this.sampleTimes = [];
    this.lastHudKey = undefined;
    this.lastHudPublicationAt = 0;
    this.cancelStaleTimer();
    const snapshot = this.host.getSnapshot();
    if (snapshot.effectiveUpdateRateHz !== 0 || snapshot.counters) {
      this.host.publish({
        ...snapshot,
        effectiveUpdateRateHz: 0,
        counters: undefined,
      });
    }
  }

  clearLiveMarker(): void {
    if (this.positionValue) this.positionValue.value = null;
  }

  dispose(): void {
    this.cancelStaleTimer();
    this.clearLiveMarker();
    this.positionValue = undefined;
  }

  private scheduleStale(generation: number): void {
    this.cancelStaleTimer();
    this.staleTimer = this.host.schedule(() => {
      this.staleTimer = undefined;
      if (!this.host.isConnectionCurrent(generation)) return;
      this.clearLiveMarker();
      const snapshot = this.host.getSnapshot();
      this.host.publish({
        ...snapshot,
        livePosition: staleLivePosition(
          snapshot.livePosition,
          snapshot.connectionState === "connected"
            ? "connected"
            : "reconnecting",
        ),
      });
    }, this.host.staleAfterMs);
  }

  private cancelStaleTimer(): void {
    if (this.staleTimer !== undefined) this.host.cancel(this.staleTimer);
    this.staleTimer = undefined;
  }
}

function effectiveRate(sampleTimes: readonly number[]): number {
  if (sampleTimes.length < 2) return 0;
  const elapsedMs = sampleTimes[sampleTimes.length - 1] - sampleTimes[0];
  return elapsedMs > 0 ? ((sampleTimes.length - 1) * 1_000) / elapsedMs : 0;
}
