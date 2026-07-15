import { useEffect, useRef, useState } from "react";
import { LocalizationEngine } from "../localization/LocalizationEngine";
import {
  BeaconMeasurement,
  EnvironmentMode,
  FieldConfiguration,
  FieldConfigurationStore,
  FieldDimensions,
  PositionEstimate,
} from "../localization/types";
import {
  BeaconSource,
  BeaconSourceEvent,
  BeaconSourceKind,
  createBeaconSource,
} from "../providers";

const SNAPSHOT_POLL_INTERVAL_MS = 500;

export interface UseBeaconScannerOptions {
  environment?: EnvironmentMode;
  fieldDimensions?: FieldDimensions;
  fieldConfiguration?: FieldConfiguration;
  fieldId?: string;
  fieldConfigurationStore?: FieldConfigurationStore;
  snapshotIntervalMs?: number;
  source?: BeaconSource;
  sourceKind?: BeaconSourceKind;
  usePansInternalLocationSolver?: boolean;
}

export function useBeaconScanner(options: UseBeaconScannerOptions = {}) {
  const resolvedFieldConfiguration =
    options.fieldConfiguration ??
    (options.fieldId && options.fieldConfigurationStore
      ? options.fieldConfigurationStore.getFieldConfiguration(options.fieldId)
      : undefined);

  const [beacons, setBeacons] = useState<BeaconMeasurement[]>([]);
  const [position, setPosition] = useState<PositionEstimate | undefined>();
  const [startupError, setStartupError] = useState<unknown>();
  const engineRef = useRef<LocalizationEngine | null>(null);
  const sourceRef = useRef<BeaconSource | null>(null);

  if (engineRef.current === null) {
    engineRef.current = new LocalizationEngine({
      environment: options.environment,
      fieldDimensions: options.fieldDimensions,
      fieldConfiguration: resolvedFieldConfiguration,
      solverThrottleMs: options.snapshotIntervalMs ?? SNAPSHOT_POLL_INTERVAL_MS,
    });
  }

  if (sourceRef.current === null) {
    sourceRef.current =
      options.source ??
      createBeaconSource(options.sourceKind ?? "pans-ble", {
        pans: {
          useInternalLocationSolver: options.usePansInternalLocationSolver,
        },
      });
  }

  useEffect(() => {
    engineRef.current?.setEnvironment({
      environment: options.environment,
      fieldDimensions: options.fieldDimensions,
    });
    engineRef.current?.setFieldConfiguration(resolvedFieldConfiguration);
  }, [
    options.environment,
    options.fieldDimensions,
    resolvedFieldConfiguration,
  ]);

  useEffect(() => {
    const pollInterval =
      options.snapshotIntervalMs ?? SNAPSHOT_POLL_INTERVAL_MS;
    const interval = setInterval(() => {
      const snapshot = engineRef.current?.getSnapshot();
      if (!snapshot) return;

      setPosition(snapshot.position);
      setBeacons(snapshot.beacons);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [options.snapshotIntervalMs]);

  useEffect(() => {
    let active = true;
    let subscription: { remove(): void } | null = null;
    const source = sourceRef.current;

    if (!source) return;

    const start = async () => {
      try {
        subscription = source.subscribe((event: BeaconSourceEvent) => {
          const observations = event.observations ?? [];
          if (!observations.length) return;

          observations.forEach((observation) => {
            engineRef.current?.ingestObservation(observation);
          });
        });
        await source.start();
        if (!active) return;
        setStartupError(undefined);
      } catch (e) {
        subscription?.remove();
        subscription = null;
        if (active) {
          setStartupError(e);
          console.error("Failed to start scanning:", e);
        }
      }
    };

    start();

    return () => {
      active = false;
      subscription?.remove();
      source.stop();
      source.destroy?.();
      engineRef.current?.destroy();
    };
  }, []);

  return { beacons, position, startupError };
}
