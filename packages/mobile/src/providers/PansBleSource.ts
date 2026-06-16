import {
  addConnectionStateChangedListener,
  addDeviceDiscoveredListener,
  addLocationDataListener,
  connect,
  disconnect,
  PANS_BLE_UUIDS,
  patchOperationMode,
  readLocationData,
  subscribeLocationData,
  unsubscribeLocationData,
  writeLocationDataMode,
  startScanning,
  stopScanning,
} from "expo-pans-ble-api";
import type { PansBleDevice } from "expo-pans-ble-api";
import { BeaconSource } from "./types";
import {
  locationFrameToObservations,
  parsePansLocationDataPayload,
} from "./PansLocationDataParser";

export interface PansBleSourceOptions {
  useInternalLocationSolver?: boolean;
  tagDeviceId?: string;
  selectTag?: (device: PansBleDevice) => boolean;
  disconnectOnTeardown?: boolean;
  responsiveMode?: boolean;
  stationaryDetectionEnabled?: boolean;
  onError?: (error: unknown) => void;
}

export function createPansBleSource(
  options: PansBleSourceOptions = {},
): BeaconSource {
  const useInternalLocationSolver = options.useInternalLocationSolver ?? true;
  const responsiveMode = options.responsiveMode ?? true;
  const stationaryDetectionEnabled = options.stationaryDetectionEnabled ?? true;
  let activeTagDeviceId: string | undefined;
  let connectingDeviceId: string | undefined;
  const configuredDevices = new Set<string>();
  const subscribedDevices = new Set<string>();

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
      let isRemoved = false;
      const teardownDevices = new Set<string>();

      async function disconnectAfterRemoval(deviceId: string): Promise<void> {
        const teardownAlreadyStarted = teardownDevices.has(deviceId);
        if (teardownAlreadyStarted && !subscribedDevices.has(deviceId)) return;
        if (!teardownAlreadyStarted) teardownDevices.add(deviceId);
        const shouldDisconnect = options.disconnectOnTeardown ?? true;

        try {
          if (subscribedDevices.has(deviceId)) {
            await unsubscribeLocationData(deviceId);
            subscribedDevices.delete(deviceId);
          }
        } finally {
          if (activeTagDeviceId === deviceId) activeTagDeviceId = undefined;
          configuredDevices.delete(deviceId);
          if (shouldDisconnect && !teardownAlreadyStarted) {
            await disconnect(deviceId);
          }
        }
      }

      async function ensureUwbSession(device: PansBleDevice) {
        if (isRemoved) return;
        if (!isSelectableTag(device, options)) return;
        if (activeTagDeviceId && activeTagDeviceId !== device.deviceId) return;
        if (connectingDeviceId && connectingDeviceId !== device.deviceId)
          return;
        if (
          activeTagDeviceId === device.deviceId &&
          subscribedDevices.has(device.deviceId)
        ) {
          return;
        }

        connectingDeviceId = device.deviceId;
        try {
          const isConnected = await connect(device.deviceId, 10_000);
          if (isRemoved) {
            if (isConnected) await disconnectAfterRemoval(device.deviceId);
            return;
          }
          if (!isConnected) return;
          activeTagDeviceId = device.deviceId;

          if (!configuredDevices.has(device.deviceId)) {
            await patchOperationMode(device.deviceId, {
              role: "tag",
              uwbMode: "active",
              initiatorEnabled: false,
              locationEngineEnabled: useInternalLocationSolver,
              lowPowerModeEnabled: !responsiveMode,
              accelerometerEnabled: stationaryDetectionEnabled,
            });
            if (isRemoved) {
              await disconnectAfterRemoval(device.deviceId);
              return;
            }
            await writeLocationDataMode(
              device.deviceId,
              useInternalLocationSolver ? 0 : 1,
            );
            if (isRemoved) {
              await disconnectAfterRemoval(device.deviceId);
              return;
            }
            configuredDevices.add(device.deviceId);
          }

          const frame = await readLocationData(device.deviceId);
          if (isRemoved) {
            await disconnectAfterRemoval(device.deviceId);
            return;
          }
          const observations = locationFrameToObservations(
            device.deviceId,
            frame,
          );
          if (observations.length) {
            try {
              listener({ observations });
            } catch (error) {
              options.onError?.(error);
            }
          }

          await subscribeLocationData(device.deviceId);
          subscribedDevices.add(device.deviceId);
          if (isRemoved) {
            await disconnectAfterRemoval(device.deviceId);
            return;
          }
        } catch (error) {
          options.onError?.(error);
        } finally {
          if (connectingDeviceId === device.deviceId)
            connectingDeviceId = undefined;
        }
      }

      const discoverySubscription = addDeviceDiscoveredListener((event) => {
        event.devices.forEach((device) => {
          void ensureUwbSession(device);
        });
      });

      const connectionSubscription = addConnectionStateChangedListener(
        (event) => {
          if (event.state === "disconnected") {
            if (activeTagDeviceId === event.deviceId)
              activeTagDeviceId = undefined;
            if (connectingDeviceId === event.deviceId)
              connectingDeviceId = undefined;
            configuredDevices.delete(event.deviceId);
            subscribedDevices.delete(event.deviceId);
          }
        },
      );

      const notifySubscription = addLocationDataListener((event) => {
        if (isRemoved) return;
        if (activeTagDeviceId !== event.deviceId) return;
        if (
          !sameUuid(
            event.characteristicUuid,
            PANS_BLE_UUIDS.characteristics.locationData,
          )
        )
          return;

        try {
          const frame = parsePansLocationDataPayload(event.payload);
          const observations = locationFrameToObservations(
            event.deviceId,
            frame,
          );
          if (observations.length) listener({ observations });
        } catch (error) {
          options.onError?.(error);
        }
      });

      return {
        remove() {
          if (isRemoved) return;
          isRemoved = true;
          discoverySubscription.remove();
          connectionSubscription.remove();
          notifySubscription.remove();
          const deviceId = activeTagDeviceId;
          if (deviceId) {
            void disconnectAfterRemoval(deviceId).catch((error) => {
              options.onError?.(error);
            });
          }
        },
      };
    },
  };
}

function isSelectableTag(
  device: PansBleDevice,
  options: PansBleSourceOptions,
): boolean {
  if (options.tagDeviceId && options.tagDeviceId !== device.deviceId)
    return false;
  if (device.presence?.role && device.presence.role !== "tag") return false;
  if (options.selectTag) return options.selectTag(device);
  return device.presence?.role === "tag";
}

function sameUuid(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
