import {
  addBeaconDiscoveredListener,
  startScanning,
  stopScanning,
} from "expo-kbeaconpro";
import { RawBeaconData } from "../types/BeaconProtocol";
import { BeaconSource } from "./types";

export function createKBeaconSource(): BeaconSource {
  return {
    start() {
      startScanning();
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
