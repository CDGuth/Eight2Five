import type { PansDecoderDiagnostic } from "expo-pans-ble-api";
import { ManagerError, normalizeManagerError } from "./errors";
import type {
  PansLiveSession,
  PansLocationNotification,
} from "./PansDeviceSessionManager";
import { PansDeviceSessionManager } from "./PansDeviceSessionManager";
import type { PansPositionStreamSample } from "./types";

export interface PansPositionStreamCounters {
  notificationEvents: number;
  matchingDeviceNotifications: number;
  filteredDeviceNotifications: number;
  decodedFrames: number;
  decodeFailures: number;
  positionFrames: number;
  distanceFrames: number;
  diagnosticFrames: number;
  emittedSamples: number;
  nativeSequenceDiscontinuities: number;
  negotiatedMtu?: number;
}

export interface StartPansPositionStreamOptions {
  deviceId: string;
  transportDeviceId: string;
  onSample(sample: PansPositionStreamSample): void;
  onDiagnostic?(message: string): void;
  onCounters?(counters: Readonly<PansPositionStreamCounters>): void;
}

interface ActivePositionStream {
  token: symbol;
  session: PansLiveSession;
  subscription: { remove(): void };
  options: StartPansPositionStreamOptions;
  counters: PansPositionStreamCounters;
  lastNativeSequence?: number;
}

interface DecodedLocationFrame {
  position?: PansPositionStreamSample["position"];
  distances: PansPositionStreamSample["distances"];
  diagnostics: string[];
  decoderDiagnostics?: PansDecoderDiagnostic[];
}

export class PansPositionStreamService {
  private active?: ActivePositionStream;
  private lifecycleTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly sessions: PansDeviceSessionManager,
    private readonly now: () => number = Date.now,
  ) {}

  get isRunning(): boolean {
    return Boolean(this.active);
  }

  get counters(): Readonly<PansPositionStreamCounters> | undefined {
    return this.active ? { ...this.active.counters } : undefined;
  }

  async start(options: StartPansPositionStreamOptions): Promise<void> {
    await this.runLifecycle(async () => {
      await this.stopActive();
      const session = await this.sessions.openLiveSession(
        options.transportDeviceId,
      );
      try {
        const token = Symbol("pans-position-stream");
        const counters = createPositionStreamCounters();
        const subscription = session.addLocationDataListener((event) => {
          const active = this.active;
          if (active?.token !== token) return;
          this.handleNotification(active, event);
        });
        const active: ActivePositionStream = {
          token,
          session,
          subscription,
          options,
          counters,
        };
        this.active = active;
        this.reportCounters(active);

        if (session.requestMtu) {
          try {
            const negotiatedMtu = await session.requestMtu(247);
            if (negotiatedMtu !== undefined) {
              active.counters.negotiatedMtu = negotiatedMtu;
              this.reportCounters(active);
            }
          } catch (error) {
            options.onDiagnostic?.(
              `Location notification MTU negotiation failed: ${normalizeManagerError(error).message}`,
            );
          }
        }

        // Read before enabling notifications. CoreBluetooth reports reads and
        // notifications through the same delegate callback; this ordering keeps
        // the initial read from consuming a live notification as its response.
        try {
          const data = await session.readLocationData();
          this.recordDecodedFrame(active, data);
          this.emit(active, data, "initial-read");
        } catch (error) {
          options.onDiagnostic?.(
            `Initial location read failed: ${normalizeManagerError(error).message}`,
          );
        }

        if (!(await session.subscribeLocationData())) {
          throw new ManagerError(
            "GATT_FAILURE",
            "The device rejected location notifications.",
          );
        }
      } catch (error) {
        if (this.active?.session === session) await this.stopActive();
        else await session.close().catch(() => undefined);
        throw normalizeManagerError(error);
      }
    });
  }

  async stop(): Promise<void> {
    await this.runLifecycle(async () => await this.stopActive());
  }

  private handleNotification(
    active: ActivePositionStream,
    event: PansLocationNotification,
  ): void {
    active.counters.notificationEvents += 1;
    if (
      normalizeTransportDeviceId(event.transportDeviceId) !==
      normalizeTransportDeviceId(active.options.transportDeviceId)
    ) {
      active.counters.filteredDeviceNotifications += 1;
      this.reportCounters(active);
      return;
    }

    active.counters.matchingDeviceNotifications += 1;
    if (event.sequence !== undefined) {
      if (
        active.lastNativeSequence !== undefined &&
        event.sequence !== active.lastNativeSequence + 1
      ) {
        active.counters.nativeSequenceDiscontinuities += 1;
      }
      active.lastNativeSequence = event.sequence;
    }

    try {
      const data = active.session.decodeLocationData(event.payload);
      this.recordDecodedFrame(active, data);
      this.emit(active, data, "notification", event);
    } catch (error) {
      active.counters.decodeFailures += 1;
      this.reportCounters(active);
      active.options.onDiagnostic?.(
        `Location notification decode failed: ${normalizeManagerError(error).message}`,
      );
    }
  }

  private recordDecodedFrame(
    active: ActivePositionStream,
    data: DecodedLocationFrame,
  ): void {
    active.counters.decodedFrames += 1;
    if (data.position) active.counters.positionFrames += 1;
    if (data.distances.length > 0) active.counters.distanceFrames += 1;
    if (
      data.diagnostics.length > 0 ||
      (data.decoderDiagnostics?.length ?? 0) > 0
    ) {
      active.counters.diagnosticFrames += 1;
    }
    this.reportCounters(active);
  }

  private async stopActive(): Promise<void> {
    const active = this.active;
    if (!active) return;
    this.active = undefined;
    try {
      active.subscription.remove();
    } catch (error) {
      active.options.onDiagnostic?.(
        `Location listener cleanup failed: ${normalizeManagerError(error).message}`,
      );
    }
    try {
      await active.session.unsubscribeLocationData();
    } catch (error) {
      active.options.onDiagnostic?.(
        `Location notification cleanup failed: ${normalizeManagerError(error).message}`,
      );
    } finally {
      try {
        await active.session.close();
      } catch (error) {
        active.options.onDiagnostic?.(
          `Location session cleanup failed: ${normalizeManagerError(error).message}`,
        );
      }
    }
  }

  private async runLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.lifecycleTail;
    let release!: () => void;
    this.lifecycleTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private emit(
    active: ActivePositionStream,
    data: DecodedLocationFrame,
    source: PansPositionStreamSample["source"],
    nativeEvent?: PansLocationNotification,
  ): void {
    const decoderDiagnostics = data.decoderDiagnostics ?? [];
    if (
      !data.position &&
      data.distances.length === 0 &&
      data.diagnostics.length === 0 &&
      decoderDiagnostics.length === 0
    )
      return;
    active.counters.emittedSamples += 1;
    this.reportCounters(active);
    active.options.onSample({
      deviceId: active.options.deviceId,
      transportDeviceId: active.options.transportDeviceId,
      receivedAt: this.now(),
      source,
      ...(data.position ? { position: data.position } : {}),
      distances: data.distances,
      diagnostics: data.diagnostics,
      decoderDiagnostics,
      ...(nativeEvent?.sequence !== undefined
        ? { nativeSequence: nativeEvent.sequence }
        : {}),
      ...(nativeEvent?.monotonicTimestampMs !== undefined
        ? { nativeMonotonicTimestampMs: nativeEvent.monotonicTimestampMs }
        : {}),
      ...(nativeEvent?.payloadLength !== undefined
        ? { payloadLength: nativeEvent.payloadLength }
        : {}),
    });
  }

  private reportCounters(active: ActivePositionStream): void {
    active.options.onCounters?.({ ...active.counters });
  }
}

export function normalizeTransportDeviceId(deviceId: string): string {
  const trimmed = deviceId.trim();
  const compact = trimmed.replace(/[:-]/g, "");
  return /^[0-9a-f]+$/i.test(compact)
    ? compact.toUpperCase()
    : trimmed.toLocaleLowerCase();
}

function createPositionStreamCounters(): PansPositionStreamCounters {
  return {
    notificationEvents: 0,
    matchingDeviceNotifications: 0,
    filteredDeviceNotifications: 0,
    decodedFrames: 0,
    decodeFailures: 0,
    positionFrames: 0,
    distanceFrames: 0,
    diagnosticFrames: 0,
    emittedSamples: 0,
    nativeSequenceDiscontinuities: 0,
  };
}
