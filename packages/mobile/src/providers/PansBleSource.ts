import {
  addConnectionStateChangedListener,
  addDeviceDiscoveredListener,
  addNotificationReceivedListener,
  connect,
  readLocationData,
  setTagLocationEngineEnabled,
  writeLocationDataMode,
  startScanning,
  stopScanning,
} from "expo-pans-ble-api";
import { BeaconSource } from "./types";
import {
  locationFrameToObservations,
  parsePansLocationDataPayload,
} from "./PansLocationDataParser";

export interface PansBleSourceOptions {
  useInternalLocationSolver?: boolean;
}

export function createPansBleSource(
  options: PansBleSourceOptions = {},
): BeaconSource {
  const useInternalLocationSolver = options.useInternalLocationSolver ?? true;

  const connectingDevices = new Set<string>();
  const connectedDevices = new Set<string>();
  const configuredDevices = new Set<string>();

  return {
    start() {
      startScanning();
    },
    stop() {
      stopScanning();
    },
    subscribe(listener) {
      async function ensureUwbSession(macAddress: string) {
        if (
          connectedDevices.has(macAddress) ||
          connectingDevices.has(macAddress)
        )
          return;

        connectingDevices.add(macAddress);
        try {
          const isConnected = await connect(macAddress, 10_000);
          if (!isConnected) return;

          connectedDevices.add(macAddress);
          if (!configuredDevices.has(macAddress)) {
            await setTagLocationEngineEnabled(
              macAddress,
              useInternalLocationSolver,
            );
            await writeLocationDataMode(
              macAddress,
              useInternalLocationSolver ? 0 : 1,
            );
            configuredDevices.add(macAddress);
          }

          const readResult = await readLocationData(macAddress);
          if (readResult.ok && readResult.response?.value) {
            const frame = parsePansLocationDataPayload(
              readResult.response.value,
            );
            const observations = locationFrameToObservations(macAddress, frame);
            if (observations.length) {
              try {
                listener({ observations });
              } catch {
                // Ignore listener errors from host app.
              }
            }
          }
        } catch {
          // Best effort connection path.
        } finally {
          connectingDevices.delete(macAddress);
        }
      }

      const discoverySubscription = addDeviceDiscoveredListener((event) => {
        event.devices.forEach((device) => {
          void ensureUwbSession(device.mac);
        });
      });

      const connectionSubscription = addConnectionStateChangedListener(
        (event) => {
          if (event.state === "connected") {
            connectedDevices.add(event.macAddress);
            return;
          }

          if (event.state === "disconnected") {
            connectedDevices.delete(event.macAddress);
            configuredDevices.delete(event.macAddress);
          }
        },
      );

      const notifySubscription = addNotificationReceivedListener((event) => {
        const frame = parsePansLocationDataPayload(event.payload);
        const observations = locationFrameToObservations(
          event.macAddress,
          frame,
        );
        if (observations.length) {
          listener({ observations });
        }
      });

      return {
        remove() {
          discoverySubscription.remove();
          connectionSubscription.remove();
          notifySubscription.remove();
        },
      };
    },
  };
}
