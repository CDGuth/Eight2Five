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
  onError?: (error: unknown) => void;
}

export function createPansBleSource(
  options: PansBleSourceOptions = {},
): BeaconSource {
  const useInternalLocationSolver = options.useInternalLocationSolver ?? true;
  let activeTagDeviceId: string | undefined;
  let connectingDeviceId: string | undefined;
  const configuredDevices = new Set<string>();
  const subscribedDevices = new Set<string>();

  return {
    start() {
      void startScanning();
    },
    stop() {
      stopScanning();
    },
    subscribe(listener) {
      let isRemoved = false;

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
          if (isRemoved) return;
          if (!isConnected) return;
          activeTagDeviceId = device.deviceId;

          if (!configuredDevices.has(device.deviceId)) {
            await patchOperationMode(device.deviceId, {
              role: "tag",
              uwbMode: "active",
              locationEngineEnabled: useInternalLocationSolver,
            });
            if (isRemoved) return;
            await writeLocationDataMode(
              device.deviceId,
              useInternalLocationSolver ? 0 : 1,
            );
            if (isRemoved) return;
            configuredDevices.add(device.deviceId);
          }

          await subscribeLocationData(device.deviceId);
          if (isRemoved) {
            await unsubscribeLocationData(device.deviceId);
            return;
          }
          subscribedDevices.add(device.deviceId);

          const frame = await readLocationData(device.deviceId);
          if (isRemoved) return;
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
            void unsubscribeLocationData(deviceId).finally(() => {
              subscribedDevices.delete(deviceId);
              if (options.disconnectOnTeardown ?? true)
                void disconnect(deviceId);
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
