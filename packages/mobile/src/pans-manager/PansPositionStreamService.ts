import { ManagerError, normalizeManagerError } from "./errors";
import type { PansLiveSession } from "./PansDeviceSessionManager";
import { PansDeviceSessionManager } from "./PansDeviceSessionManager";
import type { PansPositionStreamSample } from "./types";

export interface StartPansPositionStreamOptions {
  deviceId: string;
  transportDeviceId: string;
  onSample(sample: PansPositionStreamSample): void;
  onDiagnostic?(message: string): void;
}

export class PansPositionStreamService {
  private active?: {
    token: symbol;
    session: PansLiveSession;
    subscription: { remove(): void };
    options: StartPansPositionStreamOptions;
  };
  private lifecycleTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly sessions: PansDeviceSessionManager,
    private readonly now: () => number = Date.now,
  ) {}

  get isRunning(): boolean {
    return Boolean(this.active);
  }

  async start(options: StartPansPositionStreamOptions): Promise<void> {
    await this.runLifecycle(async () => {
      await this.stopActive();
      const session = await this.sessions.openLiveSession(
        options.transportDeviceId,
      );
      try {
        const token = Symbol("pans-position-stream");
        const subscription = session.addLocationDataListener((event) => {
          if (this.active?.token !== token) return;
          if (event.transportDeviceId !== options.transportDeviceId) return;
          try {
            this.emit(
              options,
              session.decodeLocationData(event.payload),
              "notification",
            );
          } catch (error) {
            options.onDiagnostic?.(
              `Location notification decode failed: ${normalizeManagerError(error).message}`,
            );
          }
        });
        this.active = { token, session, subscription, options };
        if (!(await session.subscribeLocationData())) {
          throw new ManagerError(
            "GATT_FAILURE",
            "The device rejected location notifications.",
          );
        }
        try {
          this.emit(options, await session.readLocationData(), "initial-read");
        } catch (error) {
          options.onDiagnostic?.(
            `Initial location read failed: ${normalizeManagerError(error).message}`,
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
    options: StartPansPositionStreamOptions,
    data: {
      position?: PansPositionStreamSample["position"];
      distances: PansPositionStreamSample["distances"];
      diagnostics: string[];
    },
    source: PansPositionStreamSample["source"],
  ): void {
    if (
      !data.position &&
      data.distances.length === 0 &&
      data.diagnostics.length === 0
    )
      return;
    options.onSample({
      deviceId: options.deviceId,
      transportDeviceId: options.transportDeviceId,
      receivedAt: this.now(),
      source,
      ...(data.position ? { position: data.position } : {}),
      distances: data.distances,
      diagnostics: data.diagnostics,
    });
  }
}
