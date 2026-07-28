import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import type {
  AssignDeviceToNetworkProfileInput,
  AssignDeviceToNetworkProfileResult,
  DeviceConfigurationDiff,
  DeviceConfigurationSnapshot,
  DiscoveredDeviceSnapshot,
  ManagedDevice,
  ManagedDeviceConfig,
  ManagedNetwork,
  MigrateNetworkProfilePanInput,
  MigrateNetworkProfilePanResult,
  PansBatchOperationService,
  PansBatchRunOptions,
  PansBatchRunResult,
  PansConfigurationResult,
  PansConfigurationService,
  PansCommissioningService,
  PansDeviceSessionManager,
  PansDiagnosticsResult,
  PansDiagnosticsService,
  PansDiscoveryService,
  PansDiscoveryDiagnostics,
  PansDiscoveryState,
  PansInspectionResult,
  PansManagerRepository,
  PansManagerSettings,
  PansNetworkExport,
  PansNetworkExportService,
  PansPositionLogService,
  PansPositionStreamService,
  PansTopologyService,
  ObservedPansTopology,
  StartPositionLogOptions,
  AppendPositionSampleOptions,
  PositionLogSample,
  PositionLogSession,
  PansPosition,
} from "@eight2five/mobile/pans-manager";
import {
  assertNetworkProfilePanId,
  assertUniqueName,
  reconcileDeviceCachedProfileMatch,
} from "@eight2five/mobile/pans-manager";

import {
  createManagerId,
  deviceFromDiscovery,
  displayError,
} from "./manager-utils";

export type ManagerStepStatus = "checking" | "opening" | "ready" | "error";

const AUTO_INSPECTION_RETRY_BASE_MS = 1_000;
const AUTO_INSPECTION_RETRY_MAX_MS = 30_000;

export interface ManagerPermissionStatus {
  bluetooth: "granted" | "denied" | "undetermined" | "unavailable";
  location?: "granted" | "denied" | "undetermined" | "unavailable";
  bluetoothState?: "enabled" | "disabled" | "unavailable";
  locationServices?: "enabled" | "disabled" | "unavailable";
  canAskAgain?: boolean;
}

export interface PansManagerRuntime {
  repository: PansManagerRepository;
  discovery: Pick<
    PansDiscoveryService,
    | "isScanning"
    | "state"
    | "desiredScanning"
    | "getPermissionStatus"
    | "requestPermissions"
    | "start"
    | "stop"
    | "clear"
    | "subscribe"
    | "subscribeErrors"
    | "subscribeDiagnostics"
    | "subscribeState"
    | "getDiagnostics"
  >;
  sessions: Pick<PansDeviceSessionManager, "closeDevice" | "closeAll">;
  configuration: Pick<
    PansConfigurationService,
    | "inspect"
    | "inspectAndCache"
    | "configureDevice"
    | "applyConfigurationDiff"
    | "assignPanId"
    | "unassignDeviceHardware"
  >;
  commissioning: Pick<
    PansCommissioningService,
    "assignDeviceToNetworkProfile" | "migrateNetworkProfilePan"
  >;
  diagnostics: Pick<PansDiagnosticsService, "inspect">;
  batch: PansBatchOperationService;
  logs: Pick<
    PansPositionLogService,
    | "flush"
    | "startSession"
    | "appendSample"
    | "stopSession"
    | "exportCsv"
    | "exportJson"
  >;
  topology: PansTopologyService;
  createPositionStream(): PansPositionStreamService;
  networkExport: Pick<
    PansNetworkExportService,
    | "exportNetworkJson"
    | "exportNetworkCsv"
    | "validateImport"
    | "importNetwork"
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
  deviceSnapshots: Record<string, DeviceConfigurationSnapshot>;
  refreshPersisted(): Promise<void>;
  discoveries: DiscoveredDeviceSnapshot[];
  isScanning: boolean;
  discoveryState: PansDiscoveryState;
  desiredScanning: boolean;
  discoveryError?: string;
  discoveryDiagnostics: PansDiscoveryDiagnostics | undefined;
  selectedDiscoveryIds: Set<string>;
  toggleDiscoverySelection(id: string): void;
  clearDiscoverySelection(): void;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  clearDiscovery(): void;
  persistDiscovery(discovery: DiscoveredDeviceSnapshot): Promise<ManagedDevice>;
  assignDiscoveries(networkId: string, ids: string[]): Promise<void>;
  createNetwork(input: NetworkCreationInput): Promise<NetworkCreationResult>;
  saveNetwork(network: ManagedNetwork): Promise<void>;
  saveNetworkLocalDetails(input: {
    networkId: string;
    name: string;
    notes?: string;
  }): Promise<ManagedNetwork>;
  deleteNetwork(networkId: string): Promise<void>;
  deleteOfflineDevice(deviceId: string): Promise<void>;
  unassignOnlineDevice(deviceId: string): Promise<PansConfigurationResult>;
  inspectDevice(deviceId: string): Promise<PansInspectionResult>;
  inspectDiagnostics(deviceId: string): Promise<PansDiagnosticsResult>;
  configureDevice(
    deviceId: string,
    config: ManagedDeviceConfig,
  ): Promise<PansConfigurationResult>;
  applyDeviceConfiguration(
    deviceId: string,
    hardwareChanges: DeviceConfigurationDiff["hardwareChanges"],
  ): Promise<PansConfigurationResult>;
  assignDeviceToNetworkProfile(
    input: AssignDeviceToNetworkProfileInput,
  ): Promise<AssignDeviceToNetworkProfileResult>;
  migrateNetworkProfilePan(
    input: MigrateNetworkProfilePanInput,
  ): Promise<MigrateNetworkProfilePanResult>;
  disconnectDevice(deviceId: string): Promise<void>;
  exportNetworkJson(networkId: string): Promise<string>;
  exportNetwork(networkId: string, format: "csv" | "json"): Promise<string>;
  importNetwork(input: string): Promise<PansNetworkExport>;
  managerSettings: PansManagerSettings | undefined;
  saveManagerSettings(settings: PansManagerSettings): Promise<void>;
  refreshTopology(networkId: string): Promise<ObservedPansTopology>;
  createPositionStream(): PansPositionStreamService;
  runBatch<T>(options: PansBatchRunOptions<T>): Promise<PansBatchRunResult<T>>;
  startPositionLog(
    options: StartPositionLogOptions,
  ): Promise<PositionLogSession>;
  appendPositionSample(
    sessionId: string,
    position: PansPosition,
    options: AppendPositionSampleOptions,
  ): Promise<PositionLogSample>;
  stopPositionLog(sessionId: string): Promise<PositionLogSession | undefined>;
  listPositionLogs(networkId: string): Promise<PositionLogSession[]>;
  listPositionSamples(sessionId: string): Promise<PositionLogSample[]>;
  exportPositionLog(sessionId: string, format: "csv" | "json"): Promise<string>;
}

const PansManagerContext = React.createContext<PansManagerContextValue | null>(
  null,
);

export interface PansManagerProviderProps {
  children: React.ReactNode;
  createRuntime?: PansManagerRuntimeFactory;
  appState?: PansManagerAppState;
}

export interface PansManagerAppState {
  readonly currentState: AppStateStatus | null;
  addEventListener(
    type: "change",
    listener: (state: AppStateStatus) => void,
  ): { remove(): void };
}

export function PansManagerProvider({
  children,
  createRuntime = createDefaultRuntime,
  appState = AppState,
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
  const [deviceSnapshots, setDeviceSnapshots] = React.useState<
    Record<string, DeviceConfigurationSnapshot>
  >({});
  const [managerSettings, setManagerSettings] =
    React.useState<PansManagerSettings>();
  const [discoveries, setDiscoveries] = React.useState<
    DiscoveredDeviceSnapshot[]
  >([]);
  const [isScanning, setIsScanning] = React.useState(false);
  const [discoveryState, setDiscoveryState] =
    React.useState<PansDiscoveryState>("idle");
  const [desiredScanning, setDesiredScanning] = React.useState(true);
  const [discoveryError, setDiscoveryError] = React.useState<string>();
  const [discoveryDiagnostics, setDiscoveryDiagnostics] =
    React.useState<PansDiscoveryDiagnostics>();
  const [selectedDiscoveryIds, setSelectedDiscoveryIds] = React.useState(
    () => new Set<string>(),
  );
  const desiredScanningRef = React.useRef(true);
  const appIsActiveRef = React.useRef(
    appState.currentState !== "background" &&
      appState.currentState !== "inactive",
  );
  const permissionRequestAttemptedRef = React.useRef(false);
  const discoveryGenerationRef = React.useRef(0);
  const autoInspectedDeviceIdsRef = React.useRef(new Set<string>());
  const autoInspectionRuntimeGenerationRef = React.useRef(0);
  const autoInspectionFailureCountRef = React.useRef(new Map<string, number>());
  const autoInspectionRetryTimersRef = React.useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const [autoInspectionRetryGeneration, setAutoInspectionRetryGeneration] =
    React.useState(0);
  const inspectionPromisesRef = React.useRef(
    new Map<string, Promise<PansInspectionResult>>(),
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
    const [nextNetworks, storedDevices, savedSettings] = await Promise.all([
      runtime.repository.listNetworks(),
      runtime.repository.listDevices(),
      runtime.repository.getSettings(),
    ]);
    const nextDevices = await reconcileCachedProfileMatches(
      runtime.repository,
      nextNetworks,
      storedDevices,
    );
    setNetworks(nextNetworks);
    setDevices(nextDevices);
    setDeviceSnapshots(
      await loadLatestDeviceSnapshots(runtime.repository, nextDevices),
    );
    setManagerSettings(managerSettingsWithDefaults(savedSettings));
  }, [runtime]);

  React.useEffect(() => {
    let active = true;
    let opened: PansManagerRuntime | undefined;
    let closePromise: Promise<void> | undefined;
    const closeOpenedRuntime = () => {
      if (!opened) return Promise.resolve();
      closePromise ??= (async () => {
        await opened?.discovery.stop();
        await Promise.allSettled([
          opened?.logs.flush(),
          opened?.sessions.closeAll(),
        ]);
        await opened?.closeStorage();
      })();
      return closePromise;
    };
    createRuntime({
      module: (status) => active && setModuleStatus(status),
      storage: (status) => active && setStorageStatus(status),
    })
      .then(async (created) => {
        opened = created;
        if (!active) return await closeOpenedRuntime();
        const [savedNetworks, storedDevices, storedSettings] =
          await Promise.all([
            created.repository.listNetworks(),
            created.repository.listDevices(),
            created.repository.getSettings(),
          ]);
        if (!active) return await closeOpenedRuntime();
        const savedDevices = await reconcileCachedProfileMatches(
          created.repository,
          savedNetworks,
          storedDevices,
        );
        if (!active) return await closeOpenedRuntime();
        const savedSnapshots = await loadLatestDeviceSnapshots(
          created.repository,
          savedDevices,
        );
        if (!active) return await closeOpenedRuntime();
        setRuntime(created);
        setNetworks(savedNetworks);
        setDevices(savedDevices);
        setDeviceSnapshots(savedSnapshots);
        setManagerSettings(managerSettingsWithDefaults(storedSettings));
        setPermission(created.discovery.getPermissionStatus());
        setDiscoveryDiagnostics(created.discovery.getDiagnostics());
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
      void closeOpenedRuntime();
    };
  }, [createRuntime, runtimeAttempt]);

  React.useEffect(() => {
    const generation = ++autoInspectionRuntimeGenerationRef.current;
    const retryTimers = autoInspectionRetryTimersRef.current;
    autoInspectedDeviceIdsRef.current.clear();
    autoInspectionFailureCountRef.current.clear();
    for (const timer of retryTimers.values()) clearTimeout(timer);
    retryTimers.clear();
    inspectionPromisesRef.current.clear();
    return () => {
      if (autoInspectionRuntimeGenerationRef.current === generation)
        autoInspectionRuntimeGenerationRef.current += 1;
      for (const timer of retryTimers.values()) clearTimeout(timer);
      retryTimers.clear();
    };
  }, [runtime]);

  React.useEffect(() => {
    if (!runtime) return;
    const subscription = runtime.discovery.subscribe((next) => {
      setDiscoveries(next);
      setIsScanning(runtime.discovery.isScanning);
    });
    const errorSubscription = runtime.discovery.subscribeErrors((error) => {
      setDiscoveryError(displayError(error));
      setIsScanning(runtime.discovery.isScanning);
    });
    const diagnosticsSubscription = runtime.discovery.subscribeDiagnostics(
      (diagnostics) => {
        setDiscoveryDiagnostics(diagnostics);
        setIsScanning(runtime.discovery.isScanning);
      },
    );
    const stateSubscription = runtime.discovery.subscribeState((state) => {
      setDiscoveryState(state);
      setIsScanning(state === "scanning");
    });
    return () => {
      subscription.remove();
      errorSubscription.remove();
      diagnosticsSubscription.remove();
      stateSubscription.remove();
    };
  }, [runtime]);

  const reconcileDiscovery = React.useCallback(
    async (allowPermissionRequest: boolean) => {
      if (!runtime) return;
      const generation = ++discoveryGenerationRef.current;
      const isCurrent = () =>
        generation === discoveryGenerationRef.current &&
        desiredScanningRef.current &&
        appIsActiveRef.current;

      if (!desiredScanningRef.current || !appIsActiveRef.current) {
        if (runtime.discovery.state !== "idle") setDiscoveryState("stopping");
        await runtime.discovery.stop();
        if (generation === discoveryGenerationRef.current) {
          setDiscoveryState("idle");
          setIsScanning(false);
        }
        return;
      }

      setDiscoveryError(undefined);
      try {
        let status = runtime.discovery.getPermissionStatus();
        setPermission(status);
        if (
          !permissionsGranted(status) &&
          allowPermissionRequest &&
          shouldRequestPermissions(status) &&
          !permissionRequestAttemptedRef.current
        ) {
          permissionRequestAttemptedRef.current = true;
          setDiscoveryState("starting");
          status = await runtime.discovery.requestPermissions();
          if (!isCurrent()) return;
          setPermission(status);
        }
        if (!permissionsGranted(status)) {
          setDiscoveryState("idle");
          setIsScanning(false);
          setDiscoveryError(permissionFailureMessage(status));
          return;
        }
        if (!isCurrent()) return;
        setDiscoveryState("starting");
        await runtime.discovery.start();
        if (!isCurrent()) {
          setDiscoveryState("stopping");
          await runtime.discovery.stop();
          if (generation === discoveryGenerationRef.current)
            setDiscoveryState("idle");
          return;
        }
        setDiscoveryState("scanning");
        setIsScanning(true);
      } catch (error) {
        if (generation !== discoveryGenerationRef.current) return;
        setDiscoveryError(displayError(error));
        setDiscoveryState("error");
        setIsScanning(false);
      }
    },
    [runtime],
  );

  const startDiscovery = React.useCallback(async () => {
    desiredScanningRef.current = true;
    setDesiredScanning(true);
    await reconcileDiscovery(true);
  }, [reconcileDiscovery]);

  const stopDiscovery = React.useCallback(async () => {
    desiredScanningRef.current = false;
    setDesiredScanning(false);
    discoveryGenerationRef.current += 1;
    if (!runtime) return;
    if (runtime.discovery.state !== "idle") setDiscoveryState("stopping");
    await runtime.discovery.stop();
    setDiscoveryState("idle");
    setIsScanning(false);
  }, [runtime]);

  React.useEffect(() => {
    if (!runtime) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return reconcileDiscovery(true);
    });
    return () => {
      active = false;
    };
  }, [reconcileDiscovery, runtime]);

  React.useEffect(() => {
    const subscription = appState.addEventListener("change", (nextState) => {
      appIsActiveRef.current = nextState === "active";
      if (nextState === "active") {
        const status = runtime?.discovery.getPermissionStatus();
        if (status) setPermission(status);
        if (desiredScanningRef.current) void reconcileDiscovery(false);
        return;
      }
      discoveryGenerationRef.current += 1;
      if (!runtime) return;
      if (runtime.discovery.state !== "idle") setDiscoveryState("stopping");
      void Promise.resolve(runtime.discovery.stop()).finally(() => {
        if (!appIsActiveRef.current) {
          setDiscoveryState("idle");
          setIsScanning(false);
        }
      });
    });
    return () => subscription.remove();
  }, [appState, reconcileDiscovery, runtime]);

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
        const assignment =
          await runtime.commissioning.assignDeviceToNetworkProfile({
            deviceId: device.id,
            targetNetworkId: networkId,
          });
        if (assignment.outcome !== "assigned") {
          throw new Error(
            assignment.error?.message ?? "Network profile assignment failed.",
          );
        }
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
      manager.assertNetworkProfilePanId(input.panId);
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
        const device = await persistDiscovery(discovery);
        const assignment =
          await runtime.commissioning.assignDeviceToNetworkProfile({
            deviceId: device.id,
            targetNetworkId: network.id,
          });
        configurations.push(
          assignment.configuration ?? {
            deviceId: device.id,
            transportDeviceId: device.transportDeviceId,
            outcome: "failure",
            writes: [],
            warnings: [],
            error: assignment.error ?? {
              code: "UNKNOWN",
              message: "Network profile assignment failed.",
            },
          },
        );
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
      const [latest, existing] = await Promise.all([
        runtime.repository.getNetwork(network.id),
        runtime.repository.listNetworks(),
      ]);
      if (!latest) throw new Error("Network profile not found.");
      assertNetworkProfilePanId(latest.panId);
      if (network.panId !== latest.panId) {
        throw new Error(
          "PANS Network ID changes must use the network PAN migration workflow.",
        );
      }
      assertUniqueName(
        network.name.trim(),
        existing.map((item) => item.name),
        latest.name,
      );
      await runtime.repository.saveNetwork({
        ...latest,
        ...network,
        name: network.name.trim(),
        panId: latest.panId,
      });
      await refreshPersisted();
    },
    [refreshPersisted, runtime],
  );

  const saveNetworkLocalDetails = React.useCallback(
    async (input: { networkId: string; name: string; notes?: string }) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const [latest, existing] = await Promise.all([
        runtime.repository.getNetwork(input.networkId),
        runtime.repository.listNetworks(),
      ]);
      if (!latest) throw new Error("Network profile not found.");
      const name = input.name.trim();
      assertUniqueName(
        name,
        existing.map((item) => item.name),
        latest.name,
      );
      const saved: ManagedNetwork = {
        ...latest,
        name,
        ...(Object.prototype.hasOwnProperty.call(input, "notes")
          ? { notes: input.notes?.trim() || undefined }
          : {}),
        updatedAt: Date.now(),
      };
      await runtime.repository.saveNetwork(saved);
      await refreshPersisted();
      return saved;
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

  const deleteOfflineDevice = React.useCallback(
    async (deviceId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const device = await runtime.repository.getDevice(deviceId);
      if (!device) throw new Error("Managed device not found.");
      const available = discoveries.some(
        (discovery) =>
          discovery.transportDeviceId === device.transportDeviceId &&
          discovery.stale !== true,
      );
      if (available) {
        throw new Error(
          "Available devices must verify passive UWB mode and the PANS default PAN ID 0 unassigned state before their saved match can be removed.",
        );
      }
      await runtime.repository.deleteDevice(deviceId);
      await refreshPersisted();
    },
    [discoveries, refreshPersisted, runtime],
  );

  const unassignOnlineDevice = React.useCallback(
    async (deviceId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const device = await runtime.repository.getDevice(deviceId);
      if (!device) throw new Error("Managed device not found.");
      const available = discoveries.some(
        (discovery) =>
          discovery.transportDeviceId === device.transportDeviceId &&
          discovery.stale !== true,
      );
      if (!available) {
        throw new Error(
          "The device is offline. Delete its saved phone record instead.",
        );
      }
      const result =
        await runtime.configuration.unassignDeviceHardware(deviceId);
      await refreshPersisted();
      return result;
    },
    [discoveries, refreshPersisted, runtime],
  );

  const inspectDevice = React.useCallback(
    async (deviceId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const inFlight = inspectionPromisesRef.current.get(deviceId);
      if (inFlight) return await inFlight;
      const inspectionPromise = (async () => {
        const inspection =
          await runtime.configuration.inspectAndCache(deviceId);
        await refreshPersisted();
        return inspection;
      })();
      inspectionPromisesRef.current.set(deviceId, inspectionPromise);
      try {
        return await inspectionPromise;
      } finally {
        if (inspectionPromisesRef.current.get(deviceId) === inspectionPromise)
          inspectionPromisesRef.current.delete(deviceId);
      }
    },
    [refreshPersisted, runtime],
  );

  React.useEffect(() => {
    if (!runtime) return;
    const availableTransportIds = new Set(
      discoveries
        .filter(
          (discovery) =>
            discovery.stale !== true &&
            discovery.compatibility !== "malformed" &&
            discovery.transportDeviceId,
        )
        .map((discovery) => discovery.transportDeviceId),
    );
    const runtimeGeneration = autoInspectionRuntimeGenerationRef.current;
    const trackedDeviceIds = new Set([
      ...autoInspectedDeviceIdsRef.current,
      ...autoInspectionFailureCountRef.current.keys(),
      ...autoInspectionRetryTimersRef.current.keys(),
    ]);
    for (const deviceId of trackedDeviceIds) {
      const device = devices.find((item) => item.id === deviceId);
      if (device && availableTransportIds.has(device.transportDeviceId))
        continue;
      autoInspectedDeviceIdsRef.current.delete(deviceId);
      autoInspectionFailureCountRef.current.delete(deviceId);
      const retryTimer = autoInspectionRetryTimersRef.current.get(deviceId);
      if (retryTimer) clearTimeout(retryTimer);
      autoInspectionRetryTimersRef.current.delete(deviceId);
    }
    for (const device of devices) {
      if (
        autoInspectedDeviceIdsRef.current.has(device.id) ||
        autoInspectionRetryTimersRef.current.has(device.id) ||
        !availableTransportIds.has(device.transportDeviceId)
      )
        continue;
      autoInspectedDeviceIdsRef.current.add(device.id);
      void inspectDevice(device.id)
        .then(() => {
          if (autoInspectionRuntimeGenerationRef.current !== runtimeGeneration)
            return;
          autoInspectionFailureCountRef.current.delete(device.id);
          const retryTimer = autoInspectionRetryTimersRef.current.get(
            device.id,
          );
          if (retryTimer) clearTimeout(retryTimer);
          autoInspectionRetryTimersRef.current.delete(device.id);
        })
        .catch(() => {
          if (autoInspectionRuntimeGenerationRef.current !== runtimeGeneration)
            return;
          autoInspectedDeviceIdsRef.current.delete(device.id);
          const failureCount =
            (autoInspectionFailureCountRef.current.get(device.id) ?? 0) + 1;
          autoInspectionFailureCountRef.current.set(device.id, failureCount);
          if (autoInspectionRetryTimersRef.current.has(device.id)) return;
          const delayMs = Math.min(
            AUTO_INSPECTION_RETRY_BASE_MS * 2 ** (failureCount - 1),
            AUTO_INSPECTION_RETRY_MAX_MS,
          );
          const timer = setTimeout(() => {
            if (
              autoInspectionRuntimeGenerationRef.current !== runtimeGeneration
            )
              return;
            autoInspectionRetryTimersRef.current.delete(device.id);
            setAutoInspectionRetryGeneration((generation) => generation + 1);
          }, delayMs);
          autoInspectionRetryTimersRef.current.set(device.id, timer);
        });
    }
  }, [
    autoInspectionRetryGeneration,
    devices,
    discoveries,
    inspectDevice,
    runtime,
  ]);

  const inspectDiagnostics = React.useCallback(
    async (deviceId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const device = devices.find((item) => item.id === deviceId);
      if (!device) throw new Error("Managed device not found.");
      return await runtime.diagnostics.inspect(
        device.id,
        device.transportDeviceId,
      );
    },
    [devices, runtime],
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

  const applyDeviceConfiguration = React.useCallback(
    async (
      deviceId: string,
      hardwareChanges: DeviceConfigurationDiff["hardwareChanges"],
    ) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const result = await runtime.configuration.applyConfigurationDiff(
        deviceId,
        hardwareChanges,
      );
      await refreshPersisted();
      return result;
    },
    [refreshPersisted, runtime],
  );

  const assignDeviceToNetworkProfile = React.useCallback(
    async (input: AssignDeviceToNetworkProfileInput) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const result =
        await runtime.commissioning.assignDeviceToNetworkProfile(input);
      await refreshPersisted();
      return result;
    },
    [refreshPersisted, runtime],
  );

  const migrateNetworkProfilePan = React.useCallback(
    async (input: MigrateNetworkProfilePanInput) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const result =
        await runtime.commissioning.migrateNetworkProfilePan(input);
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

  const exportNetwork = React.useCallback(
    async (networkId: string, format: "csv" | "json") => {
      if (!runtime) throw new Error("Manager is not ready.");
      return format === "csv"
        ? await runtime.networkExport.exportNetworkCsv(networkId)
        : await runtime.networkExport.exportNetworkJson(networkId);
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

  const refreshTopology = React.useCallback(
    async (networkId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return await runtime.topology.refresh(
        devices.filter(
          (device) =>
            device.networkId === networkId && device.role === "anchor",
        ),
      );
    },
    [devices, runtime],
  );

  const createPositionStream = React.useCallback(() => {
    if (!runtime) throw new Error("Manager is not ready.");
    return runtime.createPositionStream();
  }, [runtime]);

  const runBatch = React.useCallback(
    async <T,>(options: PansBatchRunOptions<T>) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return await runtime.batch.run(options);
    },
    [runtime],
  );

  const startPositionLog = React.useCallback(
    async (options: StartPositionLogOptions) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return await runtime.logs.startSession(options);
    },
    [runtime],
  );

  const appendPositionSample = React.useCallback(
    async (
      sessionId: string,
      position: PansPosition,
      options: AppendPositionSampleOptions,
    ) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return await runtime.logs.appendSample(sessionId, position, options);
    },
    [runtime],
  );

  const stopPositionLog = React.useCallback(
    async (sessionId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return await runtime.logs.stopSession(sessionId);
    },
    [runtime],
  );

  const listPositionLogs = React.useCallback(
    async (networkId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return (await runtime.repository.listPositionLogSessions()).filter(
        (session) => session.networkId === networkId,
      );
    },
    [runtime],
  );

  const listPositionSamples = React.useCallback(
    async (sessionId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      await runtime.logs.flush(sessionId);
      return await runtime.repository.listPositionLogSamples(sessionId);
    },
    [runtime],
  );

  const exportPositionLog = React.useCallback(
    async (sessionId: string, format: "csv" | "json") => {
      if (!runtime) throw new Error("Manager is not ready.");
      return format === "csv"
        ? await runtime.logs.exportCsv(sessionId)
        : await runtime.logs.exportJson(sessionId);
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
      deviceSnapshots,
      refreshPersisted,
      discoveries,
      isScanning,
      discoveryState,
      desiredScanning,
      discoveryError,
      discoveryDiagnostics,
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
      saveNetworkLocalDetails,
      deleteNetwork,
      deleteOfflineDevice,
      unassignOnlineDevice,
      inspectDevice,
      inspectDiagnostics,
      configureDevice,
      applyDeviceConfiguration,
      assignDeviceToNetworkProfile,
      migrateNetworkProfilePan,
      disconnectDevice,
      exportNetworkJson,
      exportNetwork,
      importNetwork,
      managerSettings,
      saveManagerSettings,
      refreshTopology,
      createPositionStream,
      runBatch,
      startPositionLog,
      appendPositionSample,
      stopPositionLog,
      listPositionLogs,
      listPositionSamples,
      exportPositionLog,
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
      deviceSnapshots,
      refreshPersisted,
      discoveries,
      isScanning,
      discoveryState,
      desiredScanning,
      discoveryError,
      discoveryDiagnostics,
      selectedDiscoveryIds,
      startDiscovery,
      stopDiscovery,
      clearDiscovery,
      persistDiscovery,
      assignDiscoveries,
      createNetwork,
      saveNetwork,
      saveNetworkLocalDetails,
      deleteNetwork,
      deleteOfflineDevice,
      unassignOnlineDevice,
      inspectDevice,
      inspectDiagnostics,
      configureDevice,
      applyDeviceConfiguration,
      assignDeviceToNetworkProfile,
      migrateNetworkProfilePan,
      disconnectDevice,
      exportNetworkJson,
      exportNetwork,
      importNetwork,
      managerSettings,
      saveManagerSettings,
      refreshTopology,
      createPositionStream,
      runBatch,
      startPositionLog,
      appendPositionSample,
      stopPositionLog,
      listPositionLogs,
      listPositionSamples,
      exportPositionLog,
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
    state: manager.discoveryState,
    desiredScanning: manager.desiredScanning,
    error: manager.discoveryError,
    diagnostics: manager.discoveryDiagnostics,
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
  return {
    runBatch: manager.runBatch,
    startLog: manager.startPositionLog,
    appendSample: manager.appendPositionSample,
    stopLog: manager.stopPositionLog,
    listLogs: manager.listPositionLogs,
    listSamples: manager.listPositionSamples,
    exportLog: manager.exportPositionLog,
    refresh: manager.refreshPersisted,
  };
}

export function usePansLiveNetwork() {
  const manager = usePansManager();
  return {
    refreshTopology: manager.refreshTopology,
    createPositionStream: manager.createPositionStream,
  };
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
    const settings = manager.normalizePansManagerSettings(
      await storage.repository.getSettings(),
    );
    const discovery = new manager.PansDiscoveryService(undefined, {
      staleAfterMs: settings.discoveryStaleAfterMs,
    });
    const sessions = new manager.PansDeviceSessionManager(
      undefined,
      settings.connectionTimeoutMs,
    );
    const logs = new manager.PansPositionLogService(storage.repository, {
      memoryCap: settings.positionLogMemoryCap,
      flushSize: settings.positionLogFlushSize,
    });
    const configuration = new manager.PansConfigurationService(
      sessions,
      storage.repository,
    );
    const batch = new manager.PansBatchOperationService(storage.repository);
    return {
      repository: storage.repository,
      discovery,
      sessions,
      configuration,
      commissioning: new manager.PansCommissioningService(
        storage.repository,
        configuration,
        Date.now,
        batch,
      ),
      diagnostics: new manager.PansDiagnosticsService(sessions),
      batch,
      logs,
      topology: new manager.PansTopologyService(sessions),
      createPositionStream: () =>
        new manager.PansPositionStreamService(sessions),
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
    (!status.location || status.location === "granted") &&
    (!status.bluetoothState || status.bluetoothState === "enabled") &&
    (!status.locationServices || status.locationServices === "enabled")
  );
}

function permissionFailureMessage(status: ManagerPermissionStatus): string {
  if (status.bluetoothState === "disabled") {
    return "Enable Bluetooth before starting discovery.";
  }
  if (status.locationServices === "disabled") {
    return "Enable Location services before starting discovery.";
  }
  if (status.location && status.location !== "granted") {
    return "Precise location permission is required to receive PANS scan results.";
  }
  return "Nearby Devices permission is required to discover PANS devices.";
}

function shouldRequestPermissions(status: ManagerPermissionStatus): boolean {
  if (status.canAskAgain === false) return false;
  return (
    status.bluetooth === "undetermined" ||
    status.bluetooth === "denied" ||
    status.location === "undetermined" ||
    status.location === "denied"
  );
}

function managerSettingsWithDefaults(
  settings: Partial<PansManagerSettings> | undefined,
): PansManagerSettings {
  const compatible = { ...(settings ?? {}) } as Partial<PansManagerSettings> &
    Record<string, unknown>;
  delete compatible.discoveryScanDurationMs;
  return {
    discoveryStaleAfterMs: 10_000,
    connectionTimeoutMs: 10_000,
    positionLogMemoryCap: 1_000,
    positionLogFlushSize: 100,
    ...compatible,
  };
}

async function loadLatestDeviceSnapshots(
  repository: PansManagerRepository,
  devices: ManagedDevice[],
): Promise<Record<string, DeviceConfigurationSnapshot>> {
  const snapshots = await Promise.all(
    devices.map(
      async (device) =>
        [
          device.id,
          await repository.getLatestDeviceSnapshot(device.id),
        ] as const,
    ),
  );
  return Object.fromEntries(
    snapshots.filter(
      (entry): entry is readonly [string, DeviceConfigurationSnapshot] =>
        entry[1] !== undefined,
    ),
  );
}

async function reconcileCachedProfileMatches(
  repository: PansManagerRepository,
  networks: ManagedNetwork[],
  devices: ManagedDevice[],
): Promise<ManagedDevice[]> {
  const updatedAt = Date.now();
  let changed = false;
  await Promise.all(
    devices.map(async (device) => {
      const reconciled = reconcileDeviceCachedProfileMatch(
        device,
        networks,
        updatedAt,
      );
      if (reconciled === device) return;
      changed = true;
      if (reconciled.networkId) {
        await repository.associateDevice({
          networkId: reconciled.networkId,
          deviceId: device.id,
          associatedAt: updatedAt,
        });
      } else if (device.networkId) {
        await repository.dissociateDevice(
          device.networkId,
          device.id,
          updatedAt,
        );
      }
    }),
  );
  return changed ? await repository.listDevices() : devices;
}
