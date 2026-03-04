import { useEffect, useRef, useState } from "react";
import {
  startScanning,
  stopScanning,
  addBeaconDiscoveredListener,
} from "../../../../modules/expo-kbeaconpro/src/ExpoKBeaconProModule";
import { BeaconState, RawBeaconData } from "../types/BeaconProtocol";
import { parseBeaconData } from "../utils/beaconParser";
import { LocalizationEngine } from "../localization/LocalizationEngine";
import {
  BeaconMeasurement,
  EnvironmentMode,
  FieldDimensions,
  PositionEstimate,
  PropagationConstants,
} from "../localization/types";

const SNAPSHOT_POLL_INTERVAL_MS = 500;

export interface UseBeaconScannerOptions {
  environment?: EnvironmentMode;
  fieldDimensions?: FieldDimensions;
  propagationConstants?: Partial<PropagationConstants>;
  snapshotIntervalMs?: number;
}

export function useBeaconScanner(options: UseBeaconScannerOptions = {}) {
  const [beacons, setBeacons] = useState<Map<string, BeaconState>>(new Map());
  const [filteredBeacons, setFilteredBeacons] = useState<BeaconMeasurement[]>(
    [],
  );
  const [position, setPosition] = useState<PositionEstimate | undefined>();
  const beaconsRef = useRef<Map<string, BeaconState>>(new Map());
  const engineRef = useRef<LocalizationEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new LocalizationEngine({
      environment: options.environment,
      fieldDimensions: options.fieldDimensions,
      propagationConstants: options.propagationConstants,
      solverThrottleMs: options.snapshotIntervalMs ?? SNAPSHOT_POLL_INTERVAL_MS,
    });
  }

  useEffect(() => {
    engineRef.current?.setEnvironment({
      environment: options.environment,
      fieldDimensions: options.fieldDimensions,
      propagationConstants: options.propagationConstants,
    });
  }, [
    options.environment,
    options.fieldDimensions,
    options.propagationConstants,
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
    let subscription: any;

    const start = async () => {
      try {
        // Note: Permissions should be handled by the app before calling this hook
        startScanning();

        subscription = addBeaconDiscoveredListener((event) => {
          const discoveredBeacons = event.beacons;
          let hasUpdates = false;

          discoveredBeacons.forEach((rawBeacon: any) => {
            const mac = rawBeacon.mac;
            const currentState = beaconsRef.current.get(mac);

            // Parse the raw data
            const newState = parseBeaconData(
              rawBeacon as RawBeaconData,
              currentState,
            );

            // Only update if we have meaningful data changes or new beacon
            // For now, we update on every packet to keep RSSI fresh, but in a real app
            // you might throttle state updates to React.
            beaconsRef.current.set(mac, newState);
            engineRef.current?.ingest(newState);
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
      if (subscription) subscription.remove();
      stopScanning();
      engineRef.current?.destroy();
    };
  }, []);

  return { beacons, filteredBeacons, position };
}
