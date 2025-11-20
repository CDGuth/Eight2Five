import { useEffect, useState, useCallback, useRef } from "react";
import {
  startScanning,
  stopScanning,
  addBeaconDiscoveredListener,
} from "../../modules/expo-kbeaconpro/src/ExpoKBeaconProModule";
import { BeaconState, RawBeaconData } from "../types/BeaconProtocol";
import { parseBeaconData } from "../utils/beaconParser";

export function useBeaconScanner() {
  const [beacons, setBeacons] = useState<Map<string, BeaconState>>(new Map());
  const beaconsRef = useRef<Map<string, BeaconState>>(new Map());

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
    };
  }, []);

  return { beacons };
}
