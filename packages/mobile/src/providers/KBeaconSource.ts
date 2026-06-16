import {
  addBeaconDiscoveredListener,
  startScanning,
  stopScanning,
} from "expo-kbeaconpro";
import { RawBeaconData } from "../types/BeaconProtocol";
import { BeaconSource } from "./types";

export interface KBeaconSourceOptions {
  onError?: (error: unknown) => void;
}

export function createKBeaconSource(
  options: KBeaconSourceOptions = {},
): BeaconSource {
  return {
    async start() {
      try {
        await startScanning();
      } catch (error) {
        options.onError?.(error);
        throw error;
      }
    },
    stop() {
      stopScanning();
    },
    subscribe(listener) {
      const subscription = addBeaconDiscoveredListener((event) => {
        const beacons = Array.isArray(event.beacons)
          ? (event.beacons as RawBeaconData[])
          : [];
        listener({ rawBeacons: beacons });
      });

      return {
        remove() {
          subscription.remove();
        },
      };
    },
  };
}
