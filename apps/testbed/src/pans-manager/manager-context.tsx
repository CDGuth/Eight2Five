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
  PositionLogIngestResult,
  PositionLogIngestionCounters,
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
import {
  DiscoveryStoreContext,
  PansDiscoveryStore,
  useDiscoveryStatus,
  usePansDiscoveryList,
  useDiscoveredDevice,
} from "./stores/discovery-store";
import {
  PersistedStoreContext,
  PansPersistedStore,
  useManagedDevice,
  useManagedDevices,
  useManagedDeviceSnapshots,
  useManagedDeviceSnapshot,
  useManagedNetwork,
  useManagedNetworks,
  useManagerSettings,
} from "./stores/persisted-store";
import { closePansManagerRuntime } from "./runtime/runtime-lifecycle";
import { createDefaultPansManagerRuntime } from "./runtime/default-runtime";
import {
  autoInspectionRetryDelay,
  availableDiscoveryTransportIds,
  INSPECTION_COOLDOWN_MS,
} from "./runtime/auto-inspection";

export type ManagerStepStatus = "checking" | "opening" | "ready" | "error";

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
    | "ingestSample"
    | "getIngestionCounters"
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

export interface PansManagerContextValue {
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
  updateNetworkMapSettings(
    networkIds: string[],
    settings: Partial<
      Pick<ManagedNetwork["settings"], "mapUnits" | "mapAreaMode">
    >,
  ): Promise<void>;
  saveNetworkLocalDetails(input: {
    networkId: string;
    name: string;
    notes?: string;
  }): Promise<ManagedNetwork>;
  deleteNetwork(networkId: string): Promise<void>;
  deleteOfflineDevice(deviceId: string): Promise<void>;
  unassignOnlineDevice(deviceId: string): Promise<PansConfigurationResult>;
  inspectDevice(
    deviceId: string,
    force?: boolean,
  ): Promise<PansInspectionResult>;
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
  ingestPositionSample(
    sessionId: string,
    position: PansPosition,
    options: AppendPositionSampleOptions,
  ): PositionLogIngestResult;
  getPositionLogCounters(sessionId: string): PositionLogIngestionCounters;
  stopPositionLog(sessionId: string): Promise<PositionLogSession | undefined>;
  listPositionLogs(networkId: string): Promise<PositionLogSession[]>;
  listPositionSamples(sessionId: string): Promise<PositionLogSample[]>;
  exportPositionLog(sessionId: string, format: "csv" | "json"): Promise<string>;
}

const PansManagerContext = React.createContext<PansManagerContextValue | null>(
  null,
);

const actionKeys = [
  "retryInitialization",
  "refreshPersisted",
  "toggleDiscoverySelection",
  "clearDiscoverySelection",
  "startDiscovery",
  "stopDiscovery",
  "clearDiscovery",
  "persistDiscovery",
  "assignDiscoveries",
  "createNetwork",
  "saveNetwork",
  "updateNetworkMapSettings",
  "saveNetworkLocalDetails",
  "deleteNetwork",
  "deleteOfflineDevice",
  "unassignOnlineDevice",
  "inspectDevice",
  "inspectDiagnostics",
  "configureDevice",
  "applyDeviceConfiguration",
  "assignDeviceToNetworkProfile",
  "migrateNetworkProfilePan",
  "disconnectDevice",
  "exportNetworkJson",
  "exportNetwork",
  "importNetwork",
  "saveManagerSettings",
  "refreshTopology",
  "createPositionStream",
  "runBatch",
  "startPositionLog",
  "appendPositionSample",
  "ingestPositionSample",
  "getPositionLogCounters",
  "stopPositionLog",
  "listPositionLogs",
  "listPositionSamples",
  "exportPositionLog",
] as const satisfies readonly (keyof PansManagerContextValue)[];
type PansActionKey = (typeof actionKeys)[number];
export type PansActions = Pick<PansManagerContextValue, PansActionKey>;

interface ReadinessValue {
  initialization: PansManagerContextValue["initialization"];
  moduleStatus: ManagerStepStatus;
  storageStatus: ManagerStepStatus;
  permission: ManagerPermissionStatus | undefined;
  error?: string;
  retry(): void;
}
const ReadinessContext = React.createContext<ReadinessValue | null>(null);
const ActionsContext = React.createContext<PansActions | null>(null);
const DiscoveryDiagnosticsContext = React.createContext<
  PansDiscoveryDiagnostics | undefined
>(undefined);
interface DiscoverySelectionValue {
  selectedIds: Set<string>;
  toggle(id: string): void;
  clear(): void;
}
const DiscoverySelectionContext =
  React.createContext<DiscoverySelectionValue | null>(null);

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
  createRuntime = createDefaultPansManagerRuntime,
  appState = AppState,
}: PansManagerProviderProps) {
  const [discoveryStore] = React.useState(() => new PansDiscoveryStore());
  const [persistedStore] = React.useState(() => new PansPersistedStore());
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
  const inspectionCacheRef = React.useRef(
    new Map<
      string,
      { inspection: PansInspectionResult; completedAt: number }
    >(),
  );

  React.useEffect(() => {
    discoveryStore.setList(discoveries);
  }, [discoveries, discoveryStore]);
  React.useEffect(() => {
    discoveryStore.updateStatus({
      isScanning,
      state: discoveryState,
      desiredScanning,
      error: discoveryError,
    });
  }, [
    desiredScanning,
    discoveryError,
    discoveryState,
    discoveryStore,
    isScanning,
  ]);
  React.useEffect(() => {
    persistedStore.replace({
      networks,
      devices,
      snapshots: deviceSnapshots,
      settings: managerSettings,
    });
  }, [deviceSnapshots, devices, managerSettings, networks, persistedStore]);

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
    const snapshots = await loadLatestDeviceSnapshots(
      runtime.repository,
      nextDevices,
    );
    const settings = managerSettingsWithDefaults(savedSettings);
    persistedStore.replace({
      networks: nextNetworks,
      devices: nextDevices,
      snapshots,
      settings,
    });
    setNetworks(nextNetworks);
    setDevices(nextDevices);
    setDeviceSnapshots(snapshots);
    setManagerSettings(settings);
  }, [persistedStore, runtime]);

  React.useEffect(() => {
    let active = true;
    let opened: PansManagerRuntime | undefined;
    let closePromise: Promise<void> | undefined;
    const closeOpenedRuntime = () => {
      if (!opened) return Promise.resolve();
      closePromise ??= closePansManagerRuntime(opened);
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
        setNetworks(savedNetworks);
        setDevices(savedDevices);
        const settings = managerSettingsWithDefaults(storedSettings);
        setManagerSettings(settings);
        persistedStore.replace({
          networks: savedNetworks,
          devices: savedDevices,
          snapshots: {},
          settings,
        });
        setRuntime(created);
        setPermission(created.discovery.getPermissionStatus());
        setDiscoveryDiagnostics(created.discovery.getDiagnostics());
        setInitialization("ready");
        let savedSnapshots: Record<string, DeviceConfigurationSnapshot>;
        try {
          savedSnapshots = await loadLatestDeviceSnapshots(
            created.repository,
            savedDevices,
          );
        } catch (error) {
          if (active) {
            setInitializationError(
              `Saved device snapshots could not be loaded: ${displayError(error)}`,
            );
          }
          return;
        }
        if (!active) return await closeOpenedRuntime();
        persistedStore.upsertSnapshots(Object.values(savedSnapshots));
        setDeviceSnapshots(savedSnapshots);
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
  }, [createRuntime, persistedStore, runtimeAttempt]);

  React.useEffect(() => {
    const generation = ++autoInspectionRuntimeGenerationRef.current;
    const retryTimers = autoInspectionRetryTimersRef.current;
    autoInspectedDeviceIdsRef.current.clear();
    autoInspectionFailureCountRef.current.clear();
    for (const timer of retryTimers.values()) clearTimeout(timer);
    retryTimers.clear();
    inspectionPromisesRef.current.clear();
    inspectionCacheRef.current.clear();
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

  const publishDevice = React.useCallback(
    async (deviceId: string, canonical?: ManagedDevice) => {
      if (!runtime) throw new Error("Manager is not ready.");
      let device = canonical ?? (await runtime.repository.getDevice(deviceId));
      const snapshotPromise =
        runtime.repository.getLatestDeviceSnapshot(deviceId);
      if (!device) {
        persistedStore.removeDevice(deviceId);
        setDevices((current) => current.filter((item) => item.id !== deviceId));
        setDeviceSnapshots((current) => removeRecordKey(current, deviceId));
        return;
      }
      const reconciled = reconcileDeviceCachedProfileMatch(
        device,
        networks,
        Date.now(),
      );
      if (reconciled !== device) {
        device = reconciled.networkId
          ? await runtime.repository.associateDevice({
              networkId: reconciled.networkId,
              deviceId,
              associatedAt: reconciled.updatedAt,
            })
          : device.networkId
            ? await runtime.repository.dissociateDevice(
                device.networkId,
                deviceId,
                reconciled.updatedAt,
              )
            : reconciled;
      }
      const snapshot = await snapshotPromise;
      persistedStore.upsertDeviceWithSnapshot(device, snapshot);
      setDevices((current) => upsertRecord(current, device));
      setDeviceSnapshots((current) =>
        snapshot
          ? { ...current, [deviceId]: snapshot }
          : removeRecordKey(current, deviceId),
      );
    },
    [networks, persistedStore, runtime],
  );

  const persistDiscovery = React.useCallback(
    async (discovery: DiscoveredDeviceSnapshot) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const existing = devices.find(
        (item) => item.transportDeviceId === discovery.transportDeviceId,
      );
      const device = deviceFromDiscovery(discovery, existing);
      const saved = await runtime.repository.saveDevice(device);
      persistedStore.upsertDevice(saved);
      setDevices((current) => upsertRecord(current, saved));
      return saved;
    },
    [devices, persistedStore, runtime],
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
        if (assignment.device)
          await publishDevice(assignment.device.id, assignment.device);
        if (assignment.network) {
          persistedStore.upsertNetwork(assignment.network);
          setNetworks((current) => upsertRecord(current, assignment.network!));
        }
        if (assignment.outcome !== "assigned") {
          throw new Error(
            assignment.error?.message ?? "Network profile assignment failed.",
          );
        }
      }
      setSelectedDiscoveryIds(new Set());
    },
    [discoveries, persistDiscovery, persistedStore, publishDevice, runtime],
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
      const savedNetwork = await runtime.repository.saveNetwork(network);
      persistedStore.upsertNetwork(savedNetwork);
      setNetworks((current) => upsertRecord(current, savedNetwork));
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
        if (assignment.device)
          await publishDevice(assignment.device.id, assignment.device);
      }
      setSelectedDiscoveryIds(new Set());
      return { network: savedNetwork, configurations };
    },
    [networks, persistDiscovery, persistedStore, publishDevice, runtime],
  );

  const saveNetwork = React.useCallback(
    async (network: ManagedNetwork) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const latest = await runtime.repository.getNetwork(network.id);
      if (!latest) throw new Error("Network profile not found.");
      assertNetworkProfilePanId(latest.panId);
      if (network.panId !== latest.panId) {
        throw new Error(
          "PANS Network ID changes must use the network PAN migration workflow.",
        );
      }
      assertUniqueName(
        network.name.trim(),
        networks.map((item) => item.name),
        latest.name,
      );
      const saved = await runtime.repository.saveNetwork({
        ...latest,
        ...network,
        name: network.name.trim(),
        panId: latest.panId,
      });
      persistedStore.upsertNetwork(saved);
      setNetworks((current) => upsertRecord(current, saved));
    },
    [networks, persistedStore, runtime],
  );

  const updateNetworkMapSettings = React.useCallback(
    async (
      networkIds: string[],
      settings: Partial<
        Pick<ManagedNetwork["settings"], "mapUnits" | "mapAreaMode">
      >,
    ) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const selected = new Set(networkIds);
      const now = Date.now();
      const updates = networks
        .filter((network) => selected.has(network.id))
        .map((network) => ({
          ...network,
          settings: { ...network.settings, ...settings },
          updatedAt: now,
        }));
      if (!updates.length) return;
      const saved = await runtime.repository.saveNetworks(updates);
      persistedStore.upsertNetworks(saved);
      setNetworks((current) => mergeRecords(current, saved));
    },
    [networks, persistedStore, runtime],
  );

  const saveNetworkLocalDetails = React.useCallback(
    async (input: { networkId: string; name: string; notes?: string }) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const latest = await runtime.repository.getNetwork(input.networkId);
      if (!latest) throw new Error("Network profile not found.");
      const name = input.name.trim();
      assertUniqueName(
        name,
        networks.map((item) => item.name),
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
      const canonical = await runtime.repository.saveNetwork(saved);
      persistedStore.upsertNetwork(canonical);
      setNetworks((current) => upsertRecord(current, canonical));
      return canonical;
    },
    [networks, persistedStore, runtime],
  );

  const deleteNetwork = React.useCallback(
    async (networkId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const affectedIds = devices
        .filter((device) => device.networkId === networkId)
        .map((device) => device.id);
      await runtime.repository.deleteNetwork(networkId);
      const affectedDevices = (
        await Promise.all(
          affectedIds.map((deviceId) => runtime.repository.getDevice(deviceId)),
        )
      ).filter((device): device is ManagedDevice => device !== undefined);
      persistedStore.removeNetwork(networkId, affectedDevices);
      setNetworks((current) => current.filter((item) => item.id !== networkId));
      setDevices((current) => mergeRecords(current, affectedDevices));
    },
    [devices, persistedStore, runtime],
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
      persistedStore.removeDevice(deviceId);
      setDevices((current) => current.filter((item) => item.id !== deviceId));
      setDeviceSnapshots((current) => removeRecordKey(current, deviceId));
    },
    [discoveries, persistedStore, runtime],
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
      await publishDevice(deviceId);
      return result;
    },
    [discoveries, publishDevice, runtime],
  );

  const inspectDevice = React.useCallback(
    async (deviceId: string, force = false) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const inFlight = inspectionPromisesRef.current.get(deviceId);
      if (inFlight) return await inFlight;
      const cached = inspectionCacheRef.current.get(deviceId);
      if (
        !force &&
        cached &&
        Date.now() - cached.completedAt < INSPECTION_COOLDOWN_MS
      )
        return cached.inspection;
      inspectionCacheRef.current.delete(deviceId);
      const inspectionPromise = (async () => {
        const inspection =
          await runtime.configuration.inspectAndCache(deviceId);
        await publishDevice(deviceId);
        inspectionCacheRef.current.set(deviceId, {
          inspection,
          completedAt: Date.now(),
        });
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
    [publishDevice, runtime],
  );

  React.useEffect(() => {
    if (!runtime) return;
    const availableTransportIds = availableDiscoveryTransportIds(discoveries);
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
          const delayMs = autoInspectionRetryDelay(failureCount);
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
      await publishDevice(deviceId);
      return result;
    },
    [publishDevice, runtime],
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
      await publishDevice(deviceId);
      return result;
    },
    [publishDevice, runtime],
  );

  const assignDeviceToNetworkProfile = React.useCallback(
    async (input: AssignDeviceToNetworkProfileInput) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const result =
        await runtime.commissioning.assignDeviceToNetworkProfile(input);
      if (result.device) await publishDevice(result.device.id, result.device);
      else await publishDevice(input.deviceId);
      if (result.network) {
        persistedStore.upsertNetwork(result.network);
        setNetworks((current) => upsertRecord(current, result.network!));
      }
      return result;
    },
    [persistedStore, publishDevice, runtime],
  );

  const migrateNetworkProfilePan = React.useCallback(
    async (input: MigrateNetworkProfilePanInput) => {
      if (!runtime) throw new Error("Manager is not ready.");
      const result =
        await runtime.commissioning.migrateNetworkProfilePan(input);
      if (result.network) {
        persistedStore.upsertNetwork(result.network);
        setNetworks((current) => upsertRecord(current, result.network!));
      }
      await Promise.all(
        result.deviceResults.map((item) => publishDevice(item.deviceId)),
      );
      return result;
    },
    [persistedStore, publishDevice, runtime],
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
      const saved = await runtime.repository.saveSettings(settings);
      persistedStore.upsertSettings(saved);
      setManagerSettings(saved);
    },
    [persistedStore, runtime],
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

  const ingestPositionSample = React.useCallback(
    (
      sessionId: string,
      position: PansPosition,
      options: AppendPositionSampleOptions,
    ) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return runtime.logs.ingestSample(sessionId, position, options);
    },
    [runtime],
  );

  const getPositionLogCounters = React.useCallback(
    (sessionId: string) => {
      if (!runtime) throw new Error("Manager is not ready.");
      return runtime.logs.getIngestionCounters(sessionId);
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
      updateNetworkMapSettings,
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
      ingestPositionSample,
      getPositionLogCounters,
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
      updateNetworkMapSettings,
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
      ingestPositionSample,
      getPositionLogCounters,
      stopPositionLog,
      listPositionLogs,
      listPositionSamples,
      exportPositionLog,
    ],
  );

  const actionImplementationsRef = React.useRef(value);
  React.useEffect(() => {
    actionImplementationsRef.current = value;
  }, [value]);
  const [actions] = React.useState<PansActions>(
    () =>
      Object.fromEntries(
        actionKeys.map((key) => [
          key,
          (...args: unknown[]) =>
            (
              actionImplementationsRef.current[key] as (
                ...values: unknown[]
              ) => unknown
            )(...args),
        ]),
      ) as PansActions,
  );
  const readiness = React.useMemo<ReadinessValue>(
    () => ({
      initialization,
      moduleStatus,
      storageStatus,
      permission,
      error: initializationError,
      retry: actions.retryInitialization,
    }),
    [
      actions.retryInitialization,
      initialization,
      initializationError,
      moduleStatus,
      permission,
      storageStatus,
    ],
  );
  const selection = React.useMemo<DiscoverySelectionValue>(
    () => ({
      selectedIds: selectedDiscoveryIds,
      toggle: actions.toggleDiscoverySelection,
      clear: actions.clearDiscoverySelection,
    }),
    [
      actions.clearDiscoverySelection,
      actions.toggleDiscoverySelection,
      selectedDiscoveryIds,
    ],
  );

  return (
    <ReadinessContext.Provider value={readiness}>
      <PersistedStoreContext.Provider value={persistedStore}>
        <DiscoveryStoreContext.Provider value={discoveryStore}>
          <DiscoveryDiagnosticsContext.Provider value={discoveryDiagnostics}>
            <DiscoverySelectionContext.Provider value={selection}>
              <ActionsContext.Provider value={actions}>
                <PansManagerContext.Provider value={value}>
                  {children}
                </PansManagerContext.Provider>
              </ActionsContext.Provider>
            </DiscoverySelectionContext.Provider>
          </DiscoveryDiagnosticsContext.Provider>
        </DiscoveryStoreContext.Provider>
      </PersistedStoreContext.Provider>
    </ReadinessContext.Provider>
  );
}

/** @deprecated Compatibility facade for legacy tests. Production consumers should use focused selectors and usePansActions. */
export function usePansManager(): PansManagerContextValue {
  const value = React.useContext(PansManagerContext);
  if (!value)
    throw new Error("usePansManager must be used inside PansManagerProvider.");
  return value;
}

export function usePansActions(): PansActions {
  const actions = React.useContext(ActionsContext);
  if (!actions)
    throw new Error("usePansActions must be used inside PansManagerProvider.");
  return actions;
}

export function useManagerReadiness() {
  const readiness = React.useContext(ReadinessContext);
  if (!readiness)
    throw new Error(
      "useManagerReadiness must be used inside PansManagerProvider.",
    );
  return readiness;
}

/** Native discovery diagnostics without subscribing to discovery devices. */
export function useManagerDiagnostics() {
  return React.useContext(DiscoveryDiagnosticsContext);
}

/** Discovery selection state, kept separate from discovery list updates. */
export function useDiscoverySelection() {
  const selection = React.useContext(DiscoverySelectionContext);
  if (!selection)
    throw new Error(
      "useDiscoverySelection must be used inside PansManagerProvider.",
    );
  return selection;
}

/** Stable discovery lifecycle and persistence controls. */
export function useDiscoveryActions() {
  const actions = usePansActions();
  return React.useMemo(
    () => ({
      start: actions.startDiscovery,
      stop: actions.stopDiscovery,
      clear: actions.clearDiscovery,
      persist: actions.persistDiscovery,
      assign: actions.assignDiscoveries,
    }),
    [actions],
  );
}

export function usePansDiscovery() {
  const discoveries = usePansDiscoveryList();
  const status = useDiscoveryStatus();
  const diagnostics = React.useContext(DiscoveryDiagnosticsContext);
  const selection = React.useContext(DiscoverySelectionContext);
  const actions = usePansActions();
  if (!selection)
    throw new Error(
      "usePansDiscovery must be used inside PansManagerProvider.",
    );
  return {
    discoveries,
    isScanning: status.isScanning,
    state: status.state,
    desiredScanning: status.desiredScanning,
    error: status.error,
    diagnostics,
    selectedIds: selection.selectedIds,
    toggleSelection: selection.toggle,
    clearSelection: selection.clear,
    start: actions.startDiscovery,
    stop: actions.stopDiscovery,
    clear: actions.clearDiscovery,
    persist: actions.persistDiscovery,
    assign: actions.assignDiscoveries,
  };
}

export {
  usePansDiscoveryList,
  useDiscoveredDevice,
  useDiscoveryStatus,
  useManagedNetworks,
  useManagedDevices,
  useManagerSettings,
  useManagedNetwork,
  useManagedDevice,
  useManagedDeviceSnapshots,
  useManagedDeviceSnapshot,
};

export function usePansBatchAndLogs() {
  const actions = usePansActions();
  return React.useMemo(
    () => ({
      runBatch: actions.runBatch,
      startLog: actions.startPositionLog,
      appendSample: actions.appendPositionSample,
      ingestSample: actions.ingestPositionSample,
      getCounters: actions.getPositionLogCounters,
      stopLog: actions.stopPositionLog,
      listLogs: actions.listPositionLogs,
      listSamples: actions.listPositionSamples,
      exportLog: actions.exportPositionLog,
      refresh: actions.refreshPersisted,
    }),
    [actions],
  );
}

export function usePansLiveNetwork() {
  const actions = usePansActions();
  return React.useMemo(
    () => ({
      refreshTopology: actions.refreshTopology,
      createPositionStream: actions.createPositionStream,
    }),
    [actions],
  );
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
  const snapshots = await repository.getLatestDeviceSnapshots(
    devices.map((device) => device.id),
  );
  return Object.fromEntries(
    Object.entries(snapshots).filter(
      (entry): entry is [string, DeviceConfigurationSnapshot] =>
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
  const reconciled = await Promise.all(
    devices.map(async (device) => {
      const next = reconcileDeviceCachedProfileMatch(
        device,
        networks,
        updatedAt,
      );
      if (next === device) return device;
      if (next.networkId) {
        return await repository.associateDevice({
          networkId: next.networkId,
          deviceId: device.id,
          associatedAt: updatedAt,
        });
      } else if (device.networkId) {
        return await repository.dissociateDevice(
          device.networkId,
          device.id,
          updatedAt,
        );
      }
      return next;
    }),
  );
  return reconciled;
}

function upsertRecord<T extends { id: string }>(records: T[], record: T): T[] {
  const index = records.findIndex((item) => item.id === record.id);
  return index < 0
    ? [...records, record]
    : records.map((item, itemIndex) => (itemIndex === index ? record : item));
}

function mergeRecords<T extends { id: string }>(
  records: T[],
  incoming: T[],
): T[] {
  return incoming.reduce(upsertRecord, records);
}

function removeRecordKey<T>(record: Record<string, T>, id: string) {
  if (!(id in record)) return record;
  const next = { ...record };
  delete next[id];
  return next;
}
