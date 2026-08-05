import type { FieldPoint, FusedPositionOutput } from "@eight2five/mobile/field";
import {
  ConservativePositionFusion,
  type DeviceMotionAdapter,
  type DeviceMotionSample,
} from "@eight2five/mobile/motion";
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

export interface MobilePansPositionPublisherOptions {
  readonly motionAdapter?: DeviceMotionAdapter;
  readonly motionInterpolationEnabled?: boolean;
}

/** Publishes high-rate samples to Skia and coalesced human-readable state to React. */
export class MobilePansPositionPublisher {
  private positionValue?: SharedValue<FieldPoint | null>;
  private fusionValue?: SharedValue<FusedPositionOutput | null>;
  private staleTimer?: ReturnType<typeof setTimeout>;
  private lastHudPublicationAt = Number.NEGATIVE_INFINITY;
  private sampleTimes: number[] = [];
  private readonly fusion = new ConservativePositionFusion();
  private readonly motionAdapter?: DeviceMotionAdapter;
  private motionInterpolationEnabled: boolean;
  private motionSensorActive = false;
  private activeGeneration?: number;
  private motionStartToken = 0;

  constructor(
    private readonly host: PositionPublisherHost,
    options: MobilePansPositionPublisherOptions = {},
  ) {
    this.motionAdapter = options.motionAdapter;
    this.motionInterpolationEnabled =
      options.motionInterpolationEnabled ?? Boolean(options.motionAdapter);
  }

  attachPositionValue(value: SharedValue<FieldPoint | null>): void {
    if (this.positionValue && this.positionValue !== value) {
      this.positionValue.value = null;
    }
    this.positionValue = value;
    const live = this.host.getSnapshot().livePosition;
    value.value = live.isStale ? null : (live.position ?? null);
  }

  attachFusionValue(value: SharedValue<FusedPositionOutput | null>): void {
    if (this.fusionValue && this.fusionValue !== value) {
      this.fusionValue.value = null;
    }
    this.fusionValue = value;
    const live = this.host.getSnapshot().livePosition;
    if (live.isStale || !live.position) {
      value.value = null;
      return;
    }
    const fusedAt = live.receivedAt ?? live.lastUwbAt ?? 0;
    value.value = {
      position: live.position,
      source: live.source ?? "uwb",
      fusedAt,
      freshnessMs: live.freshnessMs ?? 0,
      lastUwbAt: live.lastUwbAt ?? fusedAt,
      lastUwbPosition: live.lastUwbPosition ?? live.position,
      interpolationActive: live.interpolationActive ?? false,
    };
  }

  setMotionInterpolationEnabled(enabled: boolean): void {
    if (this.motionInterpolationEnabled === enabled) return;
    this.motionInterpolationEnabled = enabled;
    if (!enabled) {
      this.stopMotion();
      this.fusion.reset();
      this.publishUwbOnlyState();
      return;
    }
    if (this.activeGeneration !== undefined) {
      void this.startMotion(this.activeGeneration);
    }
  }

  async startMotion(generation: number): Promise<void> {
    this.activeGeneration = generation;
    this.stopMotionSubscription();
    this.fusion.setMotionSensorActive(false);
    if (!this.motionInterpolationEnabled || !this.motionAdapter) return;

    const token = ++this.motionStartToken;
    try {
      const result = await this.motionAdapter.start((sample) => {
        if (
          token !== this.motionStartToken ||
          this.activeGeneration !== generation ||
          !this.host.isConnectionCurrent(generation)
        ) {
          return;
        }
        this.receiveMotionSample(sample, generation);
      });
      if (
        token !== this.motionStartToken ||
        this.activeGeneration !== generation ||
        !this.host.isConnectionCurrent(generation) ||
        !this.motionInterpolationEnabled
      ) {
        try {
          this.motionAdapter.stop();
        } catch {
          // A best-effort cleanup must not turn optional motion into a
          // connection failure.
        }
        return;
      }
      this.motionSensorActive = result === "active";
      this.fusion.setMotionSensorActive(this.motionSensorActive);
    } catch {
      // Sensor permission/availability is optional. UWB continues as the sole
      // source when a phone cannot provide DeviceMotion.
      this.motionSensorActive = false;
      this.fusion.setMotionSensorActive(false);
    }
  }

  stopMotion(): void {
    ++this.motionStartToken;
    this.activeGeneration = undefined;
    this.stopMotionSubscription();
    this.fusion.setMotionSensorActive(false);
  }

  receiveSample(sample: PansPositionStreamSample, generation: number): void {
    if (!this.host.isConnectionCurrent(generation) || !sample.position) return;
    const receivedAt = sample.receivedAt;
    const fieldPoint = pansPositionToFieldPoint(sample.position);
    if (!this.motionInterpolationEnabled) {
      this.sampleTimes = this.sampleTimes.filter(
        (time) => receivedAt - time <= 1_000,
      );
      this.sampleTimes.push(receivedAt);
      this.publishOutput(
        createRawUwbOutput(fieldPoint, receivedAt),
        generation,
        {
          acceptedUwb: true,
          rawPosition: {
            xMeters: sample.position.xMeters,
            yMeters: sample.position.yMeters,
            zMeters: sample.position.zMeters,
          },
        },
      );
      return;
    }
    const output = this.fusion.acceptUwb({
      position: fieldPoint,
      receivedAt,
    });
    if (!output) return;

    const acceptedUwb = output.lastUwbAt === receivedAt;
    if (acceptedUwb) {
      this.sampleTimes = this.sampleTimes.filter(
        (time) => receivedAt - time <= 1_000,
      );
      this.sampleTimes.push(receivedAt);
    }
    this.publishOutput(output, generation, {
      acceptedUwb,
      rawPosition: {
        xMeters: sample.position.xMeters,
        yMeters: sample.position.yMeters,
        zMeters: sample.position.zMeters,
      },
    });
  }

  private receiveMotionSample(
    sample: DeviceMotionSample,
    generation: number,
  ): void {
    const output = this.fusion.acceptMotion(sample);
    if (!output) return;
    this.publishOutput(output, generation, { acceptedUwb: false });
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
    this.stopMotion();
    this.fusion.reset();
    this.sampleTimes = [];
    this.lastHudPublicationAt = Number.NEGATIVE_INFINITY;
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
    if (this.fusionValue) this.fusionValue.value = null;
  }

  dispose(): void {
    this.stopMotion();
    this.cancelStaleTimer();
    this.clearLiveMarker();
    this.positionValue = undefined;
    this.fusionValue = undefined;
  }

  private publishOutput(
    output: FusedPositionOutput,
    generation: number,
    options: {
      readonly acceptedUwb: boolean;
      readonly rawPosition?: MobilePansSnapshot["rawPosition"];
    },
  ): void {
    if (!this.host.isConnectionCurrent(generation)) return;
    const fieldPoint = output.position;
    if (this.positionValue) this.positionValue.value = fieldPoint;
    if (this.fusionValue) this.fusionValue.value = output;
    this.scheduleStale(generation, output.freshnessMs);
    if (
      output.fusedAt - this.lastHudPublicationAt <
      HUD_PUBLICATION_INTERVAL_MS
    ) {
      return;
    }
    this.lastHudPublicationAt = output.fusedAt;
    const snapshot = this.host.getSnapshot();
    this.host.publish({
      ...snapshot,
      connectionState: "connected",
      livePosition: {
        connectionState: "connected",
        position: fieldPoint,
        receivedAt: output.fusedAt,
        isStale: false,
        source: output.source,
        freshnessMs: output.freshnessMs,
        lastUwbAt: output.lastUwbAt,
        lastUwbPosition: output.lastUwbPosition,
        interpolationActive: output.interpolationActive,
      },
      ...(options.acceptedUwb && options.rawPosition
        ? { rawPosition: options.rawPosition }
        : {}),
      lastUpdateAt: output.fusedAt,
      effectiveUpdateRateHz: effectiveRate(this.sampleTimes),
      error: undefined,
    });
  }

  private scheduleStale(generation: number, freshnessMs: number): void {
    this.cancelStaleTimer();
    this.staleTimer = this.host.schedule(
      () => {
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
      },
      Math.max(0, this.host.staleAfterMs - Math.max(0, freshnessMs)),
    );
  }

  private cancelStaleTimer(): void {
    if (this.staleTimer !== undefined) this.host.cancel(this.staleTimer);
    this.staleTimer = undefined;
  }

  private stopMotionSubscription(): void {
    if (!this.motionSensorActive && !this.motionAdapter) return;
    try {
      this.motionAdapter?.stop();
    } catch {
      // Sensor cleanup is best effort; UWB remains independently usable.
    }
    this.motionSensorActive = false;
  }

  private publishUwbOnlyState(): void {
    const snapshot = this.host.getSnapshot();
    const live = snapshot.livePosition;
    if (!live.position) {
      if (this.fusionValue) this.fusionValue.value = null;
      return;
    }
    const position = live.lastUwbPosition ?? live.position;
    const lastUwbAt = live.lastUwbAt ?? live.receivedAt ?? 0;
    const fusedAt = live.receivedAt ?? lastUwbAt;
    const freshnessMs =
      live.lastUwbAt !== undefined ? Math.max(0, fusedAt - live.lastUwbAt) : 0;
    const output: FusedPositionOutput = {
      position,
      source: "uwb",
      fusedAt,
      freshnessMs,
      lastUwbAt,
      lastUwbPosition: position,
      interpolationActive: false,
    };
    if (this.positionValue)
      this.positionValue.value = live.isStale ? null : position;
    if (this.fusionValue) this.fusionValue.value = live.isStale ? null : output;
    this.host.publish({
      ...snapshot,
      livePosition: {
        ...live,
        position,
        receivedAt: fusedAt,
        source: "uwb",
        freshnessMs,
        lastUwbAt: output.lastUwbAt,
        lastUwbPosition: position,
        interpolationActive: false,
        isStale: live.isStale,
      },
      lastUpdateAt: fusedAt,
    });
  }
}

function effectiveRate(sampleTimes: readonly number[]): number {
  if (sampleTimes.length < 2) return 0;
  const elapsedMs = sampleTimes[sampleTimes.length - 1] - sampleTimes[0];
  return elapsedMs > 0 ? ((sampleTimes.length - 1) * 1_000) / elapsedMs : 0;
}

function createRawUwbOutput(
  position: FieldPoint,
  receivedAt: number,
): FusedPositionOutput {
  return {
    position,
    source: "uwb",
    fusedAt: receivedAt,
    freshnessMs: 0,
    lastUwbAt: receivedAt,
    lastUwbPosition: position,
    interpolationActive: false,
  };
}
