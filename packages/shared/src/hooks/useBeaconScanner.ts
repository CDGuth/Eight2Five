import { useEffect, useRef, useState } from "react";
import {
  BeaconState,
  PacketType,
  RawBeaconData,
} from "../types/BeaconProtocol";
import { parseBeaconData } from "../utils/beaconParser";
import { LocalizationEngine } from "../localization/LocalizationEngine";
import {
  BeaconSource,
  BeaconSourceEvent,
  BeaconSourceKind,
  createBeaconSource,
} from "../providers";
import {
  BeaconMeasurement,
  EnvironmentMode,
  FieldConfiguration,
  FieldConfigurationStore,
  FieldDimensions,
  PositionEstimate,
  PropagationConstants,
} from "../localization/types";

const SNAPSHOT_POLL_INTERVAL_MS = 500;

export interface UseBeaconScannerOptions {
  environment?: EnvironmentMode;
  fieldDimensions?: FieldDimensions;
  fieldConfiguration?: FieldConfiguration;
  fieldId?: string;
  fieldConfigurationStore?: FieldConfigurationStore;
  propagationConstants?: Partial<PropagationConstants>;
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

  const [beacons, setBeacons] = useState<Map<string, BeaconState>>(new Map());
  const [filteredBeacons, setFilteredBeacons] = useState<BeaconMeasurement[]>(
    [],
  );
  const [position, setPosition] = useState<PositionEstimate | undefined>();
  const beaconsRef = useRef<Map<string, BeaconState>>(new Map());
  const engineRef = useRef<LocalizationEngine | null>(null);
  const sourceRef = useRef<BeaconSource | null>(null);

  if (!engineRef.current) {
    engineRef.current = new LocalizationEngine({
      environment: options.environment,
      fieldDimensions: options.fieldDimensions,
      fieldConfiguration: resolvedFieldConfiguration,
      propagationConstants: options.propagationConstants,
      solverThrottleMs: options.snapshotIntervalMs ?? SNAPSHOT_POLL_INTERVAL_MS,
    });
  }

  if (!sourceRef.current) {
    sourceRef.current =
      options.source ??
      createBeaconSource(options.sourceKind ?? "auto", {
        pans: {
          useInternalLocationSolver: options.usePansInternalLocationSolver,
        },
      });
  }

  useEffect(() => {
    engineRef.current?.setEnvironment({
      environment: options.environment,
      fieldDimensions: options.fieldDimensions,
      propagationConstants: options.propagationConstants,
    });
    engineRef.current?.setFieldConfiguration(resolvedFieldConfiguration);
  }, [
    options.environment,
    options.fieldDimensions,
    options.propagationConstants,
    resolvedFieldConfiguration,
  ]);

  useEffect(() => {
    const pollInterval =
      options.snapshotIntervalMs ?? SNAPSHOT_POLL_INTERVAL_MS;
    const interval = setInterval(() => {
      const snapshot = engineRef.current?.getSnapshot();
      if (!snapshot) return;

      setPosition(snapshot.position);
      setFilteredBeacons(snapshot.beacons);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [options.snapshotIntervalMs]);

  useEffect(() => {
    let subscription: { remove(): void } | null = null;
    const source = sourceRef.current;

    if (!source) return;

    const start = async () => {
      try {
        source.start();

        subscription = source.subscribe((event: BeaconSourceEvent) => {
          let hasUpdates = false;

          const discoveredBeacons: RawBeaconData[] = event.rawBeacons ?? [];

          discoveredBeacons.forEach((rawBeacon: RawBeaconData) => {
            const mac = rawBeacon.mac;
            const currentState = beaconsRef.current.get(mac);

            // Parse the raw data
            const newState = parseBeaconData(rawBeacon, currentState);

            // Only update if we have meaningful data changes or new beacon
            // For now, we update on every packet to keep RSSI fresh, but in a real app
            // you might throttle state updates to React.
            beaconsRef.current.set(mac, newState);
            engineRef.current?.ingest(newState);
            hasUpdates = true;
          });

          const observations = event.observations ?? [];
          observations.forEach((observation) => {
            const currentState = beaconsRef.current.get(observation.mac);
            const currentForState = currentState
              ? {
                  ...currentState,
                  lastSeen: observation.observedAtMs,
                }
              : {
                  mac: observation.mac,
                  lastSeen: observation.observedAtMs,
                  rssi: observation.rssiDbm ?? Number.NaN,
                };

            if (observation.measurementKind === "rssi") {
              currentForState.rssi =
                observation.rssiDbm ?? currentForState.rssi;
            }

            if (
              observation.xPercent !== undefined &&
              observation.yPercent !== undefined
            ) {
              currentForState.position = {
                type: PacketType.Position,
                xPercent: observation.xPercent,
                yPercent: observation.yPercent,
                zCm: observation.zCm ?? 0,
              };
            }

            beaconsRef.current.set(observation.mac, currentForState);
            engineRef.current?.ingestObservation(observation);
            hasUpdates = true;
          });

          if (hasUpdates) {
            // Create a new Map to trigger React re-render
            setBeacons(new Map(beaconsRef.current));
          }
        });
      } catch (e) {
        console.error("Failed to start scanning:", e);
      }
    };

    start();

    return () => {
      subscription?.remove();
      source.stop();
      source.destroy?.();
      engineRef.current?.destroy();
    };
  }, []);

  return { beacons, filteredBeacons, position };
}
