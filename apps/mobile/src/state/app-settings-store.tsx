import React from "react";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsUpdate,
} from "@eight2five/mobile/settings";
import {
  openMobileRepositories,
  type OpenMobileRepositoriesResult,
} from "@eight2five/mobile/storage";

export type AppSettingsStoreStatus = "loading" | "ready" | "error";

export interface AppSettingsStoreSnapshot {
  readonly status: AppSettingsStoreStatus;
  readonly settings: AppSettings;
  readonly error?: Error;
}

export type OpenAppSettingsStorage =
  () => Promise<OpenMobileRepositoriesResult>;

const INITIAL_SNAPSHOT: AppSettingsStoreSnapshot = Object.freeze({
  status: "loading",
  settings: DEFAULT_APP_SETTINGS,
});

/** Owns the app database lifecycle and publishes one stable settings snapshot. */
export class AppSettingsStore {
  private snapshot: AppSettingsStoreSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private storage?: OpenMobileRepositoriesResult;
  private lifecycleGeneration = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly openStorage: OpenAppSettingsStorage = () =>
      openMobileRepositories(),
  ) {}

  readonly getSnapshot = (): AppSettingsStoreSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async initialize(): Promise<void> {
    const generation = ++this.lifecycleGeneration;
    this.publish(INITIAL_SNAPSHOT);
    const previousStorage = this.storage;
    this.storage = undefined;
    if (previousStorage) {
      await this.writeQueue;
      await closeStorageQuietly(previousStorage);
      if (generation !== this.lifecycleGeneration) return;
    }
    let storage: OpenMobileRepositoriesResult | undefined;
    try {
      storage = await this.openStorage();
      if (generation !== this.lifecycleGeneration) {
        await closeStorageQuietly(storage);
        return;
      }
      const settings = await storage.settingsRepository.load();
      if (generation !== this.lifecycleGeneration) {
        await closeStorageQuietly(storage);
        return;
      }
      this.storage = storage;
      this.publish(Object.freeze({ status: "ready", settings }));
    } catch (cause) {
      if (storage && storage !== this.storage)
        await closeStorageQuietly(storage);
      if (generation !== this.lifecycleGeneration) return;
      this.publish(
        Object.freeze({
          status: "error",
          settings: this.snapshot.settings,
          error: toError(cause),
        }),
      );
    }
  }

  async update(partial: AppSettingsUpdate): Promise<AppSettings> {
    return await this.enqueue(async (storage) => {
      const settings = await storage.settingsRepository.update(partial);
      this.publish(Object.freeze({ status: "ready", settings }));
      return settings;
    });
  }

  async resetPreferences(): Promise<AppSettings> {
    return await this.enqueue(async (storage) => {
      const settings = await storage.settingsRepository.resetPreferences();
      this.publish(Object.freeze({ status: "ready", settings }));
      return settings;
    });
  }

  async setActiveDrill(id: string | null): Promise<AppSettings> {
    return await this.enqueue(async (storage) => {
      const settings = await storage.drillRepository.setActiveDrill(id);
      this.publish(Object.freeze({ status: "ready", settings }));
      return settings;
    });
  }

  async setSelectedDrillSet(id: string | null): Promise<AppSettings> {
    return await this.enqueue(async (storage) => {
      const settings = await storage.drillRepository.setSelectedDrillSet(id);
      this.publish(Object.freeze({ status: "ready", settings }));
      return settings;
    });
  }

  /** @deprecated Use setSelectedDrillSet. */
  async setSelectedDrillPage(id: string | null): Promise<AppSettings> {
    return await this.setSelectedDrillSet(id);
  }

  async reload(): Promise<AppSettings> {
    return await this.enqueue(async (storage) => {
      const settings = await storage.settingsRepository.load();
      this.publish(Object.freeze({ status: "ready", settings }));
      return settings;
    });
  }

  getDrillRepository() {
    return this.requireStorage().drillRepository;
  }

  async dispose(): Promise<void> {
    this.lifecycleGeneration += 1;
    const storage = this.storage;
    this.storage = undefined;
    await this.writeQueue;
    if (storage) await storage.close();
  }

  private async enqueue<T>(
    operation: (storage: OpenMobileRepositoriesResult) => Promise<T>,
  ): Promise<T> {
    const storage = this.requireStorage();
    const result = this.writeQueue.then(() => operation(storage));
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }

  private requireStorage(): OpenMobileRepositoriesResult {
    if (!this.storage || this.snapshot.status !== "ready") {
      throw new Error("App settings storage is not ready.");
    }
    return this.storage;
  }

  private publish(snapshot: AppSettingsStoreSnapshot): void {
    if (this.snapshot === snapshot) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

const AppSettingsStoreContext = React.createContext<AppSettingsStore | null>(
  null,
);

export function AppSettingsProvider({
  children,
  store: injectedStore,
}: {
  children: React.ReactNode;
  store?: AppSettingsStore;
}) {
  const [ownedStore] = React.useState(() => new AppSettingsStore());
  const store = injectedStore ?? ownedStore;

  React.useEffect(() => {
    void store.initialize();
    return () => void store.dispose();
  }, [store]);

  return (
    <AppSettingsStoreContext.Provider value={store}>
      {children}
    </AppSettingsStoreContext.Provider>
  );
}

export function useAppSettingsStore(): AppSettingsStore {
  const store = React.useContext(AppSettingsStoreContext);
  if (!store) {
    throw new Error(
      "useAppSettingsStore must be used inside AppSettingsProvider.",
    );
  }
  return store;
}

export function useAppSettingsSnapshot(): AppSettingsStoreSnapshot {
  const store = useAppSettingsStore();
  return React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

async function closeStorageQuietly(
  storage: OpenMobileRepositoriesResult,
): Promise<void> {
  try {
    await storage.close();
  } catch {
    // Preserve initialization errors; disposal reports its own close failure.
  }
}
