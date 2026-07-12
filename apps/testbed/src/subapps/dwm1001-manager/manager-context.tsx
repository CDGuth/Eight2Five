import React from "react";
import type {
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  ManagedDeviceConfig,
  ManagedNetwork,
  PansBatchOperationService,
  PansConfigurationResult,
  PansConfigurationService,
  PansDeviceSessionManager,
  PansDiscoveryService,
  PansInspectionResult,
  PansManagerRepository,
  PansManagerSettings,
  PansNetworkExport,
  PansNetworkExportService,
  PansPositionLogService,
} from "@eight2five/mobile/pans-manager";

import {
  createManagerId,
  deviceFromDiscovery,
  displayError,
} from "./manager-utils";

export type ManagerStepStatus = "checking" | "opening" | "ready" | "error";

export interface ManagerPermissionStatus {
  bluetooth: "granted" | "denied" | "undetermined" | "unavailable";
  location?: "granted" | "denied" | "undetermined" | "unavailable";
  canAskAgain?: boolean;
}

export interface PansManagerRuntime {
  repository: PansManagerRepository;
  discovery: Pick<
    PansDiscoveryService,
    | "isScanning"
    | "getPermissionStatus"
    | "requestPermissions"
    | "start"
    | "stop"
    | "clear"
    | "subscribe"
  >;
  sessions: Pick<PansDeviceSessionManager, "closeDevice" | "closeAll">;
  configuration: Pick<
    PansConfigurationService,
    "inspect" | "configureDevice" | "assignPanId"
  >;
  batch: PansBatchOperationService;
  logs: Pick<PansPositionLogService, "flush">;
  networkExport: Pick<
    PansNetworkExportService,
    "exportNetworkJson" | "validateImport" | "importNetwork"
  >;
  closeStorage(): Promise<void>;
}

export interface RuntimeStatusReporter {
  module(status: ManagerStepStatus): void;
  storage(status: ManagerStepStatus): void;
}

export type PansManagerRuntimeFactory = (
  reporter: RuntimeStatusReporter,
) => Promise<PansManagerRuntime>;

export interface NetworkCreationInput {
  name: string;
  panId: number;
  notes?: string;
  discoveries: DiscoveredDeviceSnapshot[];
}

export interface NetworkCreationResult {
  network: ManagedNetwork;
  configurations: PansConfigurationResult[];
}

interface PansManagerContextValue {
  initialization: "initializing" | "ready" | "error";
  moduleStatus: ManagerStepStatus;
  storageStatus: ManagerStepStatus;
  permission: ManagerPermissionStatus | undefined;
  initializationError?: string;
  retryInitialization(): void;
  networks: ManagedNetwork[];
  devices: ManagedDevice[];
  refreshPersisted(): Promise<void>;
  discoveries: DiscoveredDeviceSnapshot[];
  isScanning: boolean;
  discoveryError?: string;
  selectedDiscoveryIds: Set<string>;
  toggleDiscoverySelection(id: string): void;
  clearDiscoverySelection(): void;
  startDiscovery(): Promise<void>;
  stopDiscovery(): void;
  clearDiscovery(): void;
  persistDiscovery(discovery: DiscoveredDeviceSnapshot): Promise<ManagedDevice>;
  assignDiscoveries(networkId: string, ids: string[]): Promise<void>;
  createNetwork(input: NetworkCreationInput): Promise<NetworkCreationResult>;
  saveNetwork(network: ManagedNetwork): Promise<void>;
  deleteNetwork(networkId: string): Promise<void>;
  saveDevice(device: ManagedDevice): Promise<void>;
  inspectDevice(deviceId: string): Promise<PansInspectionResult>;
  configureDevice(
    deviceId: string,
    config: ManagedDeviceConfig,
  ): Promise<PansConfigurationResult>;
  disconnectDevice(deviceId: string): Promise<void>;
  exportNetworkJson(networkId: string): Promise<string>;
  importNetwork(input: string): Promise<PansNetworkExport>;
  managerSettings: PansManagerSettings | undefined;
  saveManagerSettings(settings: PansManagerSettings): Promise<void>;
}

const PansManagerContext = React.createContext<PansManagerContextValue | null>(
  null,
);

export interface PansManagerProviderProps {
  children: React.ReactNode;
  createRuntime?: PansManagerRuntimeFactory;
}

export function PansManagerProvider({
  children,
  createRuntime = createDefaultRuntime,
}: PansManagerProviderProps) {
  const [initialization, setInitialization] =
    React.useState<PansManagerContextValue["initialization"]>("initializing");
  const [moduleStatus, setModuleStatus] =
    React.useState<ManagerStepStatus>("checking");
  const [storageStatus, setStorageStatus] =
    React.useState<ManagerStepStatus>("checking");
  const [initializationError, setInitializationError] =
    React.useState<string>();
  const [runtime, setRuntime] = React.useState<PansManagerRuntime>();
  const [runtimeAttempt, setRuntimeAttempt] = React.useState(0);
  const [permission, setPermission] = React.useState<ManagerPermissionStatus>();
  const [networks, setNetworks] = React.useState<ManagedNetwork[]>([]);
  const [devices, setDevices] = React.useState<ManagedDevice[]>([]);
  const [managerSettings, setManagerSettings] =
    React.useState<PansManagerSettings>();
  const [discoveries, setDiscoveries] = React.useState<
    DiscoveredDeviceSnapshot[]
  >([]);
  const [isScanning, setIsScanning] = React.useState(false);
  const [discoveryError, setDiscoveryError] = React.useState<string>();
  const [selectedDiscoveryIds, setSelectedDiscoveryIds] = React.useState(
    () => new Set<string>(),
  );

  const retryInitialization = React.useCallback(() => {
    setInitialization("initializing");
    setInitializationError(undefined);
    setModuleStatus("checking");
    setStorageStatus("checking");
    setRuntimeAttempt((attempt) => attempt + 1);
  }, []);

  const refreshPersisted = React.useCallback(async () => {
    if (!runtime) return;
    const [nextNetworks, nextDevices, nextSettings] = await Promise.all([
      runtime.repository.listNetworks(),
      runtime.repository.listDevices(),
      runtime.repository.getSettings(),
    ]);
    setNetworks(nextNetworks);
    setDevices(nextDevices);
    setManagerSettings(nextSettings);
  }, [runtime]);

  React.useEffect(() => {
    let active = true;
    let opened: PansManagerRuntime | undefined;
    createRuntime({
      module: (status) => active && setModuleStatus(status),
      storage: (status) => active && setStorageStatus(status),
    })
      .then(async (created) => {
        opened = created;
        if (!active) return;
        const [savedNetworks, savedDevices, savedSettings] = await Promise.all([
          created.repository.listNetworks(),
          created.repository.listDevices(),
          created.repository.getSettings(),
        ]);
        if (!active) return;
        setRuntime(created);
        setNetworks(savedNetworks);
        setDevices(savedDevices);
        setManagerSettings(savedSettings);
        setPermission(created.discovery.getPermissionStatus());
        setInitialization("ready");
      })
      .catch((error) => {
        if (!active) return;
        setInitializationError(displayError(error));
        setInitialization("error");
        setModuleStatus((status) => (status === "checking" ? "error" : status));
        setStorageStatus((status) => (status === "opening" ? "error" : status));
      });
    return () => {
      active = false;
      const current = opened;
      if (!current) return;
      current.discovery.stop();
      void Promise.allSettled([
        current.logs.flush(),
        current.sessions.closeAll(),
      ]).then(async () => await current.closeStorage());
    };
  }, [createRuntime, runtimeAttempt]);

  React.useEffect(() => {
    if (!runtime) return;
    const subscription = runtime.discovery.subscribe((next) => {
      setDiscoveries(next);
      setIsScanning(runtime.discovery.isScanning);
    });
    return () => subscription.remove();
  }, [runtime]);

  const startDiscovery = React.useCallback(async () => {
    if (!runtime) return;
    setDiscoveryError(undefined);
    try {
      let status = runtime.discovery.getPermissionStatus();
      if (!permissionsGranted(status)) {
        status = await runtime.discovery.requestPermissions();
      }
      setPermission(status);
      if (!permissionsGranted(status)) {
        throw new Error(
          "Bluetooth permission is required to discover devices.",
        );
      }
      await runtime.discovery.start();
      setIsScanning(true);
    } catch (error) {
      setDiscoveryError(displayError(error));
      setIsScanning(false);
    }
  }, [runtime]);

  const stopDiscovery = React.useCallback(() => {
    runtime?.discovery.stop();
    setIsScanning(false);
  }, [runtime]);

  const clearDiscovery = React.useCallback(() => {
    runtime?.discovery.clear();
    setDiscoveries([]);
    setSelectedDiscoveryIds(new Set());
  }, [runtime]);

  const persistDiscovery = React.useCallback(
    async (discovery: DiscoveredDeviceSnapshot) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const existing = devices.find(
        (item) => item.transportDeviceId === discovery.transportDeviceId,
      );
      const device = deviceFromDiscovery(discovery, existing);
      await runtime.repository.saveDevice(device);
      await refreshPersisted();
      return device;
    },
    [devices, refreshPersisted, runtime],
  );

  const assignDiscoveries = React.useCallback(
    async (networkId: string, ids: string[]) => {
      if (!runtime) throw new Error("Manager is not ready.");
      for (const id of ids) {
        const discovery = discoveries.find(
          (item) => item.transportDeviceId === id,
        );
        if (!discovery) continue;
        const device = await persistDiscovery(discovery);
        await runtime.repository.associateDevice({
          networkId,
          deviceId: device.id,
          associatedAt: Date.now(),
        });
      }
      setSelectedDiscoveryIds(new Set());
      await refreshPersisted();
    },
    [discoveries, persistDiscovery, refreshPersisted, runtime],
  );

  const createNetwork = React.useCallback(
    async (input: NetworkCreationInput): Promise<NetworkCreationResult> => {
      if (!runtime) throw new Error("Manager is not ready.");
      const manager = await import("@eight2five/mobile/pans-manager");
      manager.assertPanId(input.panId);
      manager.assertUniqueName(
        input.name,
        networks.map((network) => network.name),
      );
      const now = Date.now();
      const network: ManagedNetwork = {
        id: createManagerId("network"),
        name: input.name.trim(),
        panId: input.panId,
        settings: manager.DEFAULT_MANAGED_NETWORK_SETTINGS,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
      };
      // Persist the profile before touching hardware so partial commissioning is recoverable.
      await runtime.repository.saveNetwork(network);
      const configurations: PansConfigurationResult[] = [];
      for (const discovery of input.discoveries) {
        let device = await persistDiscovery(discovery);
        await runtime.repository.associateDevice({
          networkId: network.id,
          deviceId: device.id,
          associatedAt: Date.now(),
        });
        const result = await runtime.configuration.assignPanId(
          device.id,
          network.panId,
        );
        configurations.push(result);
        if (result.outcome === "failure") {
          device = {
            ...device,
            networkId: network.id,
            notes: [
              device.notes,
              `PAN assignment failed: ${result.error?.message}`,
            ]
              .filter(Boolean)
              .join("\n"),
            updatedAt: Date.now(),
          };
          await runtime.repository.saveDevice(device);
        }
      }
      setSelectedDiscoveryIds(new Set());
      await refreshPersisted();
      return { network, configurations };
    },
    [networks, persistDiscovery, refreshPersisted, runtime],
  );

  const saveNetwork = React.useCallback(
    async (network: ManagedNetwork) => {
      if (!runtime) throw new Error("Manager is not ready.");
      await runtime.repository.saveNetwork(network);
      await refreshPersisted();
    },
    [refreshPersisted, runtime],
  );

  const deleteNetwork = React.useCallback(
    async (networkId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      await runtime.repository.deleteNetwork(networkId);
      await refreshPersisted();
    },
    [refreshPersisted, runtime],
  );

  const saveDevice = React.useCallback(
    async (device: ManagedDevice) => {
      if (!runtime) throw new Error("Manager is not ready.");
      await runtime.repository.saveDevice(device);
      await refreshPersisted();
    },
    [refreshPersisted, runtime],
  );

  const inspectDevice = React.useCallback(
    async (deviceId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return await runtime.configuration.inspect(deviceId);
    },
    [runtime],
  );

  const configureDevice = React.useCallback(
    async (deviceId: string, config: ManagedDeviceConfig) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const result = await runtime.configuration.configureDevice(
        deviceId,
        config,
      );
      await refreshPersisted();
      return result;
    },
    [refreshPersisted, runtime],
  );

  const disconnectDevice = React.useCallback(
    async (deviceId: string) => {
      if (!runtime) return;
      const device = devices.find((item) => item.id === deviceId);
      if (device) await runtime.sessions.closeDevice(device.transportDeviceId);
    },
    [devices, runtime],
  );

  const exportNetworkJson = React.useCallback(
    async (networkId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return await runtime.networkExport.exportNetworkJson(networkId);
    },
    [runtime],
  );

  const importNetwork = React.useCallback(
    async (input: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const imported = await runtime.networkExport.importNetwork(input);
      await refreshPersisted();
      return imported;
    },
    [refreshPersisted, runtime],
  );

  const saveManagerSettings = React.useCallback(
    async (settings: PansManagerSettings) => {
      if (!runtime) throw new Error("Manager is not ready.");
      await runtime.repository.saveSettings(settings);
      setManagerSettings(settings);
    },
    [runtime],
  );

  const value = React.useMemo<PansManagerContextValue>(
    () => ({
      initialization,
      moduleStatus,
      storageStatus,
      permission,
      initializationError,
      retryInitialization,
      networks,
      devices,
      refreshPersisted,
      discoveries,
      isScanning,
      discoveryError,
      selectedDiscoveryIds,
      toggleDiscoverySelection: (id) =>
        setSelectedDiscoveryIds((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      clearDiscoverySelection: () => setSelectedDiscoveryIds(new Set()),
      startDiscovery,
      stopDiscovery,
      clearDiscovery,
      persistDiscovery,
      assignDiscoveries,
      createNetwork,
      saveNetwork,
      deleteNetwork,
      saveDevice,
      inspectDevice,
      configureDevice,
      disconnectDevice,
      exportNetworkJson,
      importNetwork,
      managerSettings,
      saveManagerSettings,
    }),
    [
      initialization,
      moduleStatus,
      storageStatus,
      permission,
      initializationError,
      retryInitialization,
      networks,
      devices,
      refreshPersisted,
      discoveries,
      isScanning,
      discoveryError,
      selectedDiscoveryIds,
      startDiscovery,
      stopDiscovery,
      clearDiscovery,
      persistDiscovery,
      assignDiscoveries,
      createNetwork,
      saveNetwork,
      deleteNetwork,
      saveDevice,
      inspectDevice,
      configureDevice,
      disconnectDevice,
      exportNetworkJson,
      importNetwork,
      managerSettings,
      saveManagerSettings,
    ],
  );

  return (
    <PansManagerContext.Provider value={value}>
      {children}
    </PansManagerContext.Provider>
  );
}

export function usePansManager(): PansManagerContextValue {
  const value = React.useContext(PansManagerContext);
  if (!value)
    throw new Error("usePansManager must be used inside PansManagerProvider.");
  return value;
}

export function useManagerReadiness() {
  const manager = usePansManager();
  return {
    initialization: manager.initialization,
    moduleStatus: manager.moduleStatus,
    storageStatus: manager.storageStatus,
    permission: manager.permission,
    error: manager.initializationError,
    retry: manager.retryInitialization,
  };
}

export function usePansDiscovery() {
  const manager = usePansManager();
  return {
    discoveries: manager.discoveries,
    isScanning: manager.isScanning,
    error: manager.discoveryError,
    selectedIds: manager.selectedDiscoveryIds,
    toggleSelection: manager.toggleDiscoverySelection,
    clearSelection: manager.clearDiscoverySelection,
    start: manager.startDiscovery,
    stop: manager.stopDiscovery,
    clear: manager.clearDiscovery,
    persist: manager.persistDiscovery,
    assign: manager.assignDiscoveries,
  };
}

export function useManagedNetworks() {
  const manager = usePansManager();
  return { networks: manager.networks, devices: manager.devices };
}

export function useManagedNetwork(networkId: string) {
  const manager = usePansManager();
  return {
    network: manager.networks.find((item) => item.id === networkId),
    devices: manager.devices.filter((item) => item.networkId === networkId),
  };
}

export function useManagedDevice(deviceId: string) {
  const manager = usePansManager();
  return manager.devices.find((item) => item.id === deviceId);
}

export function usePansBatchAndLogs() {
  const manager = usePansManager();
  return { refresh: manager.refreshPersisted };
}

async function createDefaultRuntime(
  reporter: RuntimeStatusReporter,
): Promise<PansManagerRuntime> {
  // Dynamic loading lets the route render a useful custom-dev-build error when
  // the native module is absent, rather than touching native code in registry tests.
  const manager = await import("@eight2five/mobile/pans-manager");
  reporter.module("ready");
  reporter.storage("opening");
  const storage = await manager.openPansManagerRepository();
  try {
    await storage.repository.initialize();
    reporter.storage("ready");
    const settings =
      (await storage.repository.getSettings()) ??
      manager.DEFAULT_PANS_MANAGER_SETTINGS;
    const discovery = new manager.PansDiscoveryService(undefined, {
      staleAfterMs: settings.discoveryStaleAfterMs,
    });
    const sessions = new manager.PansDeviceSessionManager(
      undefined,
      settings.connectionTimeoutMs,
    );
    return {
      repository: storage.repository,
      discovery,
      sessions,
      configuration: new manager.PansConfigurationService(
        sessions,
        storage.repository,
      ),
      batch: new manager.PansBatchOperationService(storage.repository),
      logs: new manager.PansPositionLogService(storage.repository, {
        memoryCap: settings.positionLogMemoryCap,
        flushSize: settings.positionLogFlushSize,
      }),
      networkExport: new manager.PansNetworkExportService(storage.repository),
      closeStorage: storage.close,
    };
  } catch (error) {
    reporter.storage("error");
    await storage.close();
    throw error;
  }
}

function permissionsGranted(status: ManagerPermissionStatus): boolean {
  return (
    status.bluetooth === "granted" &&
    (!status.location || status.location === "granted")
  );
}
