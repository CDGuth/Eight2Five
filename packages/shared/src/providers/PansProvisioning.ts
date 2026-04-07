import {
  connect,
  disconnect,
  readAnchorList,
  readLocationData,
  readOperationMode as readDeviceOperationMode,
  setTagLocationEngineEnabled,
  writeLocationDataMode,
  writeOperationMode,
  writePersistedPosition,
} from "expo-pans-ble-api";
import type { PansApiError, PansCommandResult } from "expo-pans-ble-api";
import {
  AnchorGeometry,
  EnvironmentMode,
  FieldConfiguration,
  FieldConfigurationStore,
  FieldDimensions,
} from "../localization/types";
import {
  parsePansLocationDataPayload,
  toAnchorKey,
} from "./PansLocationDataParser";

export type UwbMode = "off" | "passive" | "active";

const UWB_MODE_BITS: Record<UwbMode, number> = {
  off: 0,
  passive: 1,
  active: 2,
};

export interface SetupTagOptions {
  connectTimeoutMs?: number;
  useInternalLocationSolver?: boolean;
  locationDataMode?: 0 | 1 | 2;
  disconnectAfterSetup?: boolean;
}

export interface SetupAnchorOptions {
  connectTimeoutMs?: number;
  initiator?: boolean;
  uwbMode?: UwbMode;
  ledEnabled?: boolean;
  firmwareUpdateEnabled?: boolean;
  persistedPosition?: {
    xMeters: number;
    yMeters: number;
    zMeters?: number;
    quality?: number;
  };
  disconnectAfterSetup?: boolean;
}

export interface CommissionFieldFromTagOptions {
  fieldId: string;
  fieldName?: string;
  tagAddress: string;
  environment?: EnvironmentMode;
  fieldDimensions?: FieldDimensions;
  store?: FieldConfigurationStore;
  knownAnchors?: AnchorGeometry[];
  resolveAnchorGeometry?: ResolveAnchorGeometry;
  sampleReads?: number;
  readIntervalMs?: number;
}

export interface CommissionFieldFromTagResult {
  fieldConfiguration?: FieldConfiguration;
  observedAnchorKeys: string[];
  resolvedAnchors: AnchorGeometry[];
  unresolvedAnchorKeys: string[];
  isSolverReady: boolean;
}

export interface DeviceCommandOptions {
  connectTimeoutMs?: number;
  disconnectAfterCommand?: boolean;
}

export interface ObserveTagAnchorsOptions extends DeviceCommandOptions {
  sampleReads?: number;
  readIntervalMs?: number;
  assumeConnected?: boolean;
}

export interface ObserveTagAnchorsResult {
  ok: boolean;
  nodeIds: number[];
  anchorKeys: string[];
  error?: PansApiError;
}

export interface ResolveAnchorGeometryParams {
  fieldId: string;
  anchorKey: string;
  nodeId: number;
}

export type ResolveAnchorGeometry = (
  params: ResolveAnchorGeometryParams,
) => AnchorGeometry | undefined | Promise<AnchorGeometry | undefined>;

export interface ReconcileFieldAnchorsFromTagOptions extends ObserveTagAnchorsOptions {
  fieldId: string;
  tagAddress: string;
  store: FieldConfigurationStore;
  knownAnchors?: AnchorGeometry[];
  resolveAnchorGeometry?: ResolveAnchorGeometry;
}

export interface ReconcileFieldAnchorsFromTagResult {
  fieldConfiguration?: FieldConfiguration;
  observedAtMs: number;
  observedNodeIds: number[];
  observedAnchorKeys: string[];
  configuredAnchorKeys: string[];
  resolvedAnchors: AnchorGeometry[];
  unresolvedObservedAnchorKeys: string[];
  staleConfiguredAnchorKeys: string[];
  isSolverReady: boolean;
  observationError?: PansApiError;
}

export interface AnchorReconciliationLoopOptions extends ReconcileFieldAnchorsFromTagOptions {
  intervalMs?: number;
  runImmediately?: boolean;
  onReconciled?: (
    result: ReconcileFieldAnchorsFromTagResult,
  ) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export interface AnchorReconciliationLoopHandle {
  stop(): void;
  runNow(): Promise<ReconcileFieldAnchorsFromTagResult>;
}

export async function readTagOperationMode(
  tagAddress: string,
  options: DeviceCommandOptions = {},
): Promise<PansCommandResult> {
  return await readOperationModeWithConnection(
    tagAddress,
    options,
    "Failed to connect to tag while reading operation mode.",
  );
}

export async function readAnchorOperationMode(
  anchorAddress: string,
  options: DeviceCommandOptions = {},
): Promise<PansCommandResult> {
  return await readOperationModeWithConnection(
    anchorAddress,
    options,
    "Failed to connect to anchor while reading operation mode.",
  );
}

export async function setupTag(
  tagAddress: string,
  options: SetupTagOptions = {},
): Promise<PansCommandResult> {
  return await configureTag(tagAddress, options);
}

export async function configureTag(
  tagAddress: string,
  options: SetupTagOptions = {},
): Promise<PansCommandResult> {
  const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
  const useInternalLocationSolver = options.useInternalLocationSolver ?? true;
  const locationDataMode =
    options.locationDataMode ?? (useInternalLocationSolver ? 0 : 1);

  const connected = await connect(tagAddress, connectTimeoutMs);
  if (!connected) {
    return buildOperationFailed("Failed to connect to tag for setup.");
  }

  try {
    const modeResult = await readDeviceOperationMode(tagAddress);
    if (!modeResult.ok) return modeResult;

    const modeBytes = modeResult.response?.value ?? [];
    if (modeBytes.length < 2)
      return buildOperationFailed(
        "Invalid operation mode payload while configuring tag.",
      );

    const [byte0, byte1] = modeBytes;
    const nextByte0 = (byte0 & ~0x80) | (UWB_MODE_BITS.active << 5);
    const nextByte1 = byte1 & ~0x80;

    const writeModeResult = await writeOperationMode(tagAddress, [
      nextByte0,
      nextByte1,
    ]);
    if (!writeModeResult.ok) return writeModeResult;

    const solverResult = await setTagLocationEngineEnabled(
      tagAddress,
      useInternalLocationSolver,
    );
    if (!solverResult.ok) return solverResult;

    return await writeLocationDataMode(tagAddress, locationDataMode);
  } finally {
    if (options.disconnectAfterSetup) {
      await disconnect(tagAddress);
    }
  }
}

export async function setupAnchorNode(
  anchorAddress: string,
  options: SetupAnchorOptions = {},
): Promise<PansCommandResult> {
  return await configureAnchorNode(anchorAddress, options);
}

export async function configureAnchorNode(
  anchorAddress: string,
  options: SetupAnchorOptions = {},
): Promise<PansCommandResult> {
  const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
  const uwbMode = options.uwbMode ?? "active";

  const connected = await connect(anchorAddress, connectTimeoutMs);
  if (!connected) {
    return buildOperationFailed("Failed to connect to anchor for setup.");
  }

  try {
    const modeResult = await readDeviceOperationMode(anchorAddress);
    if (!modeResult.ok) return modeResult;

    const modeBytes = modeResult.response?.value ?? [];
    if (modeBytes.length < 2)
      return buildOperationFailed(
        "Invalid operation mode payload while configuring anchor.",
      );

    const [byte0, byte1] = modeBytes;

    let nextByte0 = byte0 | 0x80;
    nextByte0 &= ~(0b11 << 5);
    nextByte0 |= UWB_MODE_BITS[uwbMode] << 5;

    if (options.ledEnabled !== undefined)
      nextByte0 = options.ledEnabled ? nextByte0 | 0x04 : nextByte0 & ~0x04;

    if (options.firmwareUpdateEnabled !== undefined)
      nextByte0 = options.firmwareUpdateEnabled
        ? nextByte0 | 0x02
        : nextByte0 & ~0x02;

    const nextByte1 =
      options.initiator === undefined
        ? byte1
        : options.initiator
          ? byte1 | 0x80
          : byte1 & ~0x80;

    const writeModeResult = await writeOperationMode(anchorAddress, [
      nextByte0,
      nextByte1,
    ]);
    if (!writeModeResult.ok) return writeModeResult;

    if (!options.persistedPosition) {
      return writeModeResult;
    }

    return await writePersistedPosition(
      anchorAddress,
      options.persistedPosition,
    );
  } finally {
    if (options.disconnectAfterSetup) {
      await disconnect(anchorAddress);
    }
  }
}

export async function observeTagAnchors(
  tagAddress: string,
  options: ObserveTagAnchorsOptions = {},
): Promise<ObserveTagAnchorsResult> {
  const sampleReads = Math.max(1, options.sampleReads ?? 5);
  const readIntervalMs = Math.max(0, options.readIntervalMs ?? 300);
  const disconnectAfterCommand = options.disconnectAfterCommand ?? true;

  if (!options.assumeConnected) {
    const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    const connected = await connect(tagAddress, connectTimeoutMs);
    if (!connected) {
      return {
        ok: false,
        nodeIds: [],
        anchorKeys: [],
        error: {
          code: "OPERATION_FAILED",
          message: "Failed to connect to tag while observing anchors.",
        },
      };
    }
  }

  const observedNodeIds = new Set<number>();

  try {
    for (let i = 0; i < sampleReads; i += 1) {
      const readResult = await readLocationData(tagAddress);
      if (readResult.ok && readResult.response?.value) {
        const frame = parsePansLocationDataPayload(readResult.response.value);
        frame.distances.forEach((distance) => {
          observedNodeIds.add(distance.nodeId);
        });
      }

      if (i < sampleReads - 1) {
        await sleep(readIntervalMs);
      }
    }

    const anchorListResult = await readAnchorList(tagAddress);
    if (anchorListResult.ok && anchorListResult.response?.value) {
      parseAnchorListLowNodeIds(anchorListResult.response.value).forEach(
        (nodeId) => {
          observedNodeIds.add(nodeId);
        },
      );
    }
  } finally {
    if (disconnectAfterCommand) {
      await disconnect(tagAddress);
    }
  }

  const nodeIds = Array.from(observedNodeIds).sort((a, b) => a - b);

  return {
    ok: true,
    nodeIds,
    anchorKeys: nodeIds.map((nodeId) => toAnchorKey(nodeId)),
  };
}

export async function reconcileFieldAnchorsFromTag(
  options: ReconcileFieldAnchorsFromTagOptions,
): Promise<ReconcileFieldAnchorsFromTagResult> {
  const observedAtMs = Date.now();
  const existingField = options.store.getFieldConfiguration(options.fieldId);

  const observedAnchorsResult = await observeTagAnchors(options.tagAddress, {
    connectTimeoutMs: options.connectTimeoutMs,
    disconnectAfterCommand: options.disconnectAfterCommand,
    sampleReads: options.sampleReads,
    readIntervalMs: options.readIntervalMs,
    assumeConnected: options.assumeConnected,
  });

  const geometryMap = new Map<string, AnchorGeometry>();
  existingField?.anchors.forEach((anchor) => {
    geometryMap.set(anchor.mac, anchor);
  });

  let geometryChanged = false;

  options.knownAnchors?.forEach((anchor) => {
    const previous = geometryMap.get(anchor.mac);
    if (!previous || !isSameAnchorGeometry(previous, anchor)) {
      geometryChanged = true;
    }
    geometryMap.set(anchor.mac, anchor);
  });

  if (!observedAnchorsResult.ok) {
    const configuredAnchorKeys = Array.from(geometryMap.keys()).sort();
    return {
      fieldConfiguration: existingField,
      observedAtMs,
      observedNodeIds: [],
      observedAnchorKeys: [],
      configuredAnchorKeys,
      resolvedAnchors: [],
      unresolvedObservedAnchorKeys: [],
      staleConfiguredAnchorKeys: [],
      isSolverReady: false,
      observationError: observedAnchorsResult.error,
    };
  }

  for (const nodeId of observedAnchorsResult.nodeIds) {
    const anchorKey = toAnchorKey(nodeId);
    if (geometryMap.has(anchorKey)) {
      continue;
    }

    const resolved = await options.resolveAnchorGeometry?.({
      fieldId: options.fieldId,
      anchorKey,
      nodeId,
    });

    if (resolved) {
      geometryMap.set(anchorKey, resolved);
      geometryChanged = true;
    }
  }

  const configuredAnchorKeys = Array.from(geometryMap.keys()).sort();
  const observedAnchorSet = new Set(observedAnchorsResult.anchorKeys);

  const resolvedAnchors = observedAnchorsResult.anchorKeys
    .map((anchorKey) => geometryMap.get(anchorKey))
    .filter((anchor): anchor is AnchorGeometry => !!anchor)
    .filter((anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y));

  const unresolvedObservedAnchorKeys = observedAnchorsResult.anchorKeys.filter(
    (anchorKey) => !geometryMap.has(anchorKey),
  );

  const staleConfiguredAnchorKeys = configuredAnchorKeys.filter(
    (anchorKey) => !observedAnchorSet.has(anchorKey),
  );

  let fieldConfiguration = existingField;
  if (existingField && geometryChanged) {
    fieldConfiguration = {
      ...existingField,
      anchors: Array.from(geometryMap.values()),
    };
    options.store.setFieldConfiguration(fieldConfiguration);
  }

  const isSolverReady =
    !!fieldConfiguration?.environment &&
    !!fieldConfiguration.fieldDimensions &&
    resolvedAnchors.length >= 3 &&
    unresolvedObservedAnchorKeys.length === 0;

  return {
    fieldConfiguration,
    observedAtMs,
    observedNodeIds: observedAnchorsResult.nodeIds,
    observedAnchorKeys: observedAnchorsResult.anchorKeys,
    configuredAnchorKeys,
    resolvedAnchors,
    unresolvedObservedAnchorKeys,
    staleConfiguredAnchorKeys,
    isSolverReady,
  };
}

export function startAnchorReconciliationLoop(
  options: AnchorReconciliationLoopOptions,
): AnchorReconciliationLoopHandle {
  const intervalMs = Math.max(1_000, options.intervalMs ?? 10_000);
  const runImmediately = options.runImmediately ?? true;

  let isStopped = false;
  let isRunning = false;

  async function runCycle(): Promise<ReconcileFieldAnchorsFromTagResult> {
    const result = await reconcileFieldAnchorsFromTag(options);
    await options.onReconciled?.(result);
    return result;
  }

  function runBackgroundCycle() {
    if (isStopped || isRunning) {
      return;
    }

    isRunning = true;
    void runCycle()
      .catch((error) => {
        options.onError?.(error);
      })
      .finally(() => {
        isRunning = false;
      });
  }

  if (runImmediately) {
    runBackgroundCycle();
  }

  const interval = setInterval(() => {
    runBackgroundCycle();
  }, intervalMs);

  return {
    stop() {
      isStopped = true;
      clearInterval(interval);
    },
    async runNow() {
      try {
        return await runCycle();
      } catch (error) {
        options.onError?.(error);
        throw error;
      }
    },
  };
}

export async function commissionFieldFromTag(
  options: CommissionFieldFromTagOptions,
): Promise<CommissionFieldFromTagResult> {
  const setupResult = await setupTag(options.tagAddress, {
    useInternalLocationSolver: false,
    locationDataMode: 1,
    disconnectAfterSetup: false,
  });

  if (!setupResult.ok) {
    return {
      observedAnchorKeys: [],
      resolvedAnchors: [],
      unresolvedAnchorKeys: [],
      isSolverReady: false,
    };
  }

  const observedAnchorsResult = await observeTagAnchors(options.tagAddress, {
    sampleReads: options.sampleReads,
    readIntervalMs: options.readIntervalMs,
    assumeConnected: true,
    disconnectAfterCommand: true,
  });

  const observedNodeIds = new Set<number>(observedAnchorsResult.nodeIds);
  const observedAnchorKeys = observedAnchorsResult.anchorKeys;

  const existingField = options.store?.getFieldConfiguration(options.fieldId);
  const environment = options.environment ?? existingField?.environment;
  const fieldDimensions =
    options.fieldDimensions ?? existingField?.fieldDimensions;

  const geometryMap = new Map<string, AnchorGeometry>();
  existingField?.anchors.forEach((anchor) =>
    geometryMap.set(anchor.mac, anchor),
  );
  options.knownAnchors?.forEach((anchor) =>
    geometryMap.set(anchor.mac, anchor),
  );

  for (const nodeId of observedNodeIds) {
    const anchorKey = toAnchorKey(nodeId);
    if (geometryMap.has(anchorKey)) {
      continue;
    }

    const resolved = await options.resolveAnchorGeometry?.({
      fieldId: options.fieldId,
      anchorKey,
      nodeId,
    });

    if (resolved) {
      geometryMap.set(anchorKey, resolved);
    }
  }

  const resolvedAnchors = observedAnchorKeys
    .map((anchorKey) => geometryMap.get(anchorKey))
    .filter((anchor): anchor is AnchorGeometry => !!anchor)
    .filter((anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y));

  const unresolvedAnchorKeys = observedAnchorKeys.filter(
    (anchorKey) => !geometryMap.has(anchorKey),
  );

  const isSolverReady =
    !!environment &&
    !!fieldDimensions &&
    resolvedAnchors.length >= 3 &&
    unresolvedAnchorKeys.length === 0;

  const fieldConfiguration =
    environment && fieldDimensions
      ? {
          id: options.fieldId,
          name: options.fieldName,
          environment,
          fieldDimensions,
          anchors: Array.from(geometryMap.values()),
        }
      : undefined;

  if (fieldConfiguration) {
    options.store?.setFieldConfiguration(fieldConfiguration);
  }

  return {
    fieldConfiguration,
    observedAnchorKeys,
    resolvedAnchors,
    unresolvedAnchorKeys,
    isSolverReady,
  };
}

function parseAnchorListLowNodeIds(payload: number[]): number[] {
  if (!payload.length) {
    return [];
  }

  const count = payload[0] ?? 0;
  const bytes = Uint8Array.from(payload);
  const view = new DataView(bytes.buffer);
  const nodeIds: number[] = [];

  let index = 1;
  for (let i = 0; i < count; i += 1) {
    if (index + 8 > payload.length) {
      break;
    }

    const fullId = view.getBigUint64(index, true);
    nodeIds.push(Number(fullId & 0xffffn));
    index += 8;
  }

  return nodeIds;
}

function buildOperationFailed(message: string): PansCommandResult {
  return {
    ok: false,
    error: {
      code: "OPERATION_FAILED",
      message,
    },
  };
}

async function readOperationModeWithConnection(
  macAddress: string,
  options: DeviceCommandOptions,
  connectErrorMessage: string,
): Promise<PansCommandResult> {
  const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
  const disconnectAfterCommand = options.disconnectAfterCommand ?? true;

  const connected = await connect(macAddress, connectTimeoutMs);
  if (!connected) {
    return buildOperationFailed(connectErrorMessage);
  }

  try {
    return await readDeviceOperationMode(macAddress);
  } finally {
    if (disconnectAfterCommand) {
      await disconnect(macAddress);
    }
  }
}

function isSameAnchorGeometry(
  left: AnchorGeometry,
  right: AnchorGeometry,
): boolean {
  return (
    left.mac === right.mac &&
    left.x === right.x &&
    left.y === right.y &&
    left.z === right.z
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
