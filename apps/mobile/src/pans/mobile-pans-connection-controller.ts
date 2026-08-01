import {
  normalizeManagerError,
  normalizeTransportDeviceId,
  type DiscoveredDeviceSnapshot,
  type ManagedDevice,
  type PansConnectionStateEvent,
} from "@eight2five/mobile/pans-manager";

import {
  findDiscovery,
  isSelectableTagDiscovery,
  staleLivePosition,
  type MobilePansSnapshot,
  type TagConnectionState,
} from "./mobile-pans-model";
import type { MobilePansPositionPublisher } from "./mobile-pans-position-publisher";
import type { MobilePansRuntime } from "./mobile-pans-runtime";

interface ConnectionControllerHost {
  readonly reconnectDelaysMs: readonly number[];
  readonly discoveryTimeoutMs: number;
  readonly schedule: typeof setTimeout;
  readonly cancel: typeof clearTimeout;
  readonly positionPublisher: MobilePansPositionPublisher;
  getRuntime(): MobilePansRuntime | undefined;
  getRememberedTag(): ManagedDevice | undefined;
  getDiscoveries(): readonly DiscoveredDeviceSnapshot[];
  getSnapshot(): MobilePansSnapshot;
  publish(snapshot: MobilePansSnapshot): void;
  publishState(
    state: TagConnectionState,
    changes?: Partial<MobilePansSnapshot>,
  ): void;
}

/** Coordinates one connection attempt and one bounded reconnect loop. */
export class MobilePansConnectionController {
  private connectionGeneration = 0;
  private reconnectGeneration = 0;
  private foreground = true;
  private wantsConnection = false;
  private connectPromise?: Promise<void>;
  private reconnectPromise?: Promise<void>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectDelayResolve?: () => void;
  private cancelPendingDiscovery?: () => void;
  private backgroundShutdown: Promise<unknown> = Promise.resolve();

  constructor(private readonly host: ConnectionControllerHost) {}

  get shouldReconnect(): boolean {
    return this.wantsConnection && this.foreground;
  }

  get isConnecting(): boolean {
    return Boolean(this.connectPromise);
  }

  setWantsConnection(value: boolean): void {
    this.wantsConnection = value;
  }

  isConnectionCurrent(generation: number): boolean {
    return (
      generation === this.connectionGeneration &&
      this.wantsConnection &&
      this.foreground
    );
  }

  async connect(reconnecting: boolean): Promise<void> {
    if (
      !reconnecting &&
      this.host.getSnapshot().connectionState === "connected"
    ) {
      return;
    }
    this.wantsConnection = true;
    this.cancelReconnect();
    await this.connectOnce(reconnecting);
  }

  async disconnect(): Promise<void> {
    this.wantsConnection = false;
    this.invalidateConnection();
    const runtime = this.requireRuntime();
    await Promise.allSettled([runtime.stream.stop(), runtime.discovery.stop()]);
    const rememberedTag = this.host.getRememberedTag();
    this.host.publishState(rememberedTag ? "disconnected" : "idle", {
      livePosition: staleLivePosition(
        this.host.getSnapshot().livePosition,
        rememberedTag ? "disconnected" : "idle",
      ),
      error: undefined,
    });
  }

  setForeground(foreground: boolean): void {
    if (this.foreground === foreground) return;
    this.foreground = foreground;
    if (!foreground) {
      this.invalidateConnection();
      const runtime = this.host.getRuntime();
      if (runtime) {
        this.backgroundShutdown = Promise.allSettled([
          runtime.stream.stop(),
          runtime.discovery.stop(),
        ]);
      }
      if (this.wantsConnection) {
        this.host.publishState("reconnecting", {
          livePosition: staleLivePosition(
            this.host.getSnapshot().livePosition,
            "reconnecting",
          ),
        });
      }
      return;
    }
    if (this.wantsConnection && this.host.getRememberedTag()) {
      void this.resumeAfterBackground();
    }
  }

  async pauseForOperation(): Promise<void> {
    this.connectionGeneration += 1;
    this.host.positionPublisher.resetStreamState();
    this.host.positionPublisher.clearLiveMarker();
    this.host.publishState("reconnecting", {
      livePosition: staleLivePosition(
        this.host.getSnapshot().livePosition,
        "reconnecting",
      ),
      error: undefined,
    });
    await this.requireRuntime().stream.stop();
  }

  async resumeAfterOperation(): Promise<void> {
    if (this.shouldReconnect) await this.connectOnce(true);
  }

  startReconnectLoop(): Promise<void> {
    if (!this.shouldReconnect || !this.host.getRememberedTag()) {
      return Promise.resolve();
    }
    if (this.reconnectPromise) return this.reconnectPromise;
    const generation = ++this.reconnectGeneration;
    const operation = this.runReconnectLoop(generation);
    const tracked = operation.finally(() => {
      if (this.reconnectPromise === tracked) this.reconnectPromise = undefined;
    });
    this.reconnectPromise = tracked;
    return tracked;
  }

  receiveConnectionEvent(event: PansConnectionStateEvent): void {
    const tag = this.host.getRememberedTag();
    if (
      !tag ||
      normalizeTransportDeviceId(event.deviceId) !==
        normalizeTransportDeviceId(tag.transportDeviceId) ||
      event.state !== "disconnected" ||
      this.host.getSnapshot().connectionState !== "connected"
    ) {
      return;
    }
    this.host.positionPublisher.clearLiveMarker();
    this.host.publishState(
      this.wantsConnection ? "reconnecting" : "disconnected",
      {
        livePosition: staleLivePosition(
          this.host.getSnapshot().livePosition,
          this.wantsConnection ? "reconnecting" : "disconnected",
          event.reason,
        ),
      },
    );
    if (this.shouldReconnect) void this.startReconnectLoop();
  }

  dispose(): void {
    this.wantsConnection = false;
    this.invalidateConnection();
  }

  private async connectOnce(reconnecting: boolean): Promise<void> {
    if (this.connectPromise) return await this.connectPromise;
    const generation = ++this.connectionGeneration;
    const operation = this.performConnect(generation, reconnecting);
    const tracked = operation.finally(() => {
      if (this.connectPromise === tracked) this.connectPromise = undefined;
    });
    this.connectPromise = tracked;
    return await tracked;
  }

  private async performConnect(
    generation: number,
    reconnecting: boolean,
  ): Promise<void> {
    const runtime = this.requireRuntime();
    const tag = this.host.getRememberedTag();
    if (!tag) throw new Error("Select a PANS tag before connecting.");
    if (!this.foreground) return;
    const state = reconnecting ? "reconnecting" : "connecting";
    this.host.publishState(state, { error: undefined });
    try {
      const available = await this.ensureDiscovered(tag, generation);
      if (!this.isConnectionCurrent(generation)) return;
      this.host.publishState(state);
      this.host.positionPublisher.resetStreamState();
      await runtime.stream.start({
        deviceId: tag.id,
        transportDeviceId: available.transportDeviceId,
        onSample: (sample) =>
          this.host.positionPublisher.receiveSample(sample, generation),
        onDiagnostic: (message) =>
          this.host.positionPublisher.receiveDiagnostic(message, generation),
        onCounters: (counters) => {
          if (this.isConnectionCurrent(generation)) {
            this.host.publish({ ...this.host.getSnapshot(), counters });
          }
        },
      });
      if (!this.isConnectionCurrent(generation)) {
        await runtime.stream.stop();
        return;
      }
      await runtime.discovery.stop().catch(() => undefined);
      this.host.publishState("connected", {
        livePosition: {
          ...this.host.getSnapshot().livePosition,
          connectionState: "connected",
        },
        error: undefined,
      });
    } catch (cause) {
      await runtime.discovery.stop().catch(() => undefined);
      if (!this.isConnectionCurrent(generation)) return;
      const error = normalizeManagerError(cause, {
        deviceId: tag.id,
        operation: reconnecting ? "reconnect tag" : "connect tag",
      });
      this.host.positionPublisher.clearLiveMarker();
      this.host.publishState("error", {
        livePosition: staleLivePosition(
          this.host.getSnapshot().livePosition,
          "error",
          error.message,
        ),
        error,
      });
      throw error;
    }
  }

  private async ensureDiscovered(
    tag: ManagedDevice,
    generation: number,
  ): Promise<DiscoveredDeviceSnapshot> {
    const existing = findDiscovery(
      this.host.getDiscoveries(),
      tag.transportDeviceId,
    );
    if (existing && isSelectableTagDiscovery(existing)) return existing;
    const runtime = this.requireRuntime();
    this.host.publishState("scanning");
    const permission = runtime.discovery.getPermissionStatus();
    if (permission.bluetooth !== "granted") {
      await runtime.discovery.requestPermissions();
    }
    await runtime.discovery.start();
    return await new Promise<DiscoveredDeviceSnapshot>((resolve, reject) => {
      let settled = false;
      let subscription: { remove(): void } | undefined;
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        this.host.cancel(timer);
        subscription?.remove();
        if (this.cancelPendingDiscovery === cancelWait) {
          this.cancelPendingDiscovery = undefined;
        }
        action();
      };
      const cancelWait = () =>
        finish(() =>
          reject(new Error("The connection attempt was cancelled.")),
        );
      const timer = this.host.schedule(() => {
        finish(() =>
          reject(new Error("The remembered PANS tag was not found nearby.")),
        );
      }, this.host.discoveryTimeoutMs);
      this.cancelPendingDiscovery = cancelWait;
      subscription = runtime.discovery.subscribe((items) => {
        if (!this.isConnectionCurrent(generation)) {
          cancelWait();
          return;
        }
        const match = findDiscovery(items, tag.transportDeviceId);
        if (!match || !isSelectableTagDiscovery(match)) return;
        finish(() => resolve(match));
      });
      if (settled) subscription.remove();
    });
  }

  private async runReconnectLoop(generation: number): Promise<void> {
    for (
      let attempt = 0;
      attempt <= this.host.reconnectDelaysMs.length;
      attempt += 1
    ) {
      if (!this.isReconnectCurrent(generation)) return;
      if (attempt > 0) {
        await new Promise<void>((resolve) => {
          this.reconnectDelayResolve = resolve;
          this.reconnectTimer = this.host.schedule(
            () => {
              this.reconnectTimer = undefined;
              this.reconnectDelayResolve = undefined;
              resolve();
            },
            this.host.reconnectDelaysMs[attempt - 1],
          );
        });
        if (!this.isReconnectCurrent(generation)) return;
      }
      try {
        await this.connectOnce(true);
        return;
      } catch {
        // connectOnce publishes the bounded error for each attempt.
      }
    }
  }

  private async resumeAfterBackground(): Promise<void> {
    await this.backgroundShutdown.catch(() => undefined);
    if (this.shouldReconnect && this.host.getRememberedTag()) {
      await this.startReconnectLoop();
    }
  }

  private invalidateConnection(): void {
    this.connectionGeneration += 1;
    this.cancelReconnect();
    this.cancelPendingDiscovery?.();
    this.cancelPendingDiscovery = undefined;
    this.host.positionPublisher.resetStreamState();
    this.host.positionPublisher.clearLiveMarker();
  }

  private isReconnectCurrent(generation: number): boolean {
    return generation === this.reconnectGeneration && this.shouldReconnect;
  }

  private cancelReconnect(): void {
    this.reconnectGeneration += 1;
    if (this.reconnectTimer !== undefined) {
      this.host.cancel(this.reconnectTimer);
    }
    this.reconnectTimer = undefined;
    const resolve = this.reconnectDelayResolve;
    this.reconnectDelayResolve = undefined;
    resolve?.();
  }

  private requireRuntime(): MobilePansRuntime {
    const runtime = this.host.getRuntime();
    if (!runtime) throw new Error("PANS services are not ready.");
    return runtime;
  }
}
