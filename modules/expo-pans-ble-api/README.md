# expo-pans-ble-api

Expo native module for DWM1001/PANS BLE GATT integration.

This module is BLE-only. It does **not** expose the DWM1001 SPI/UART TLV host API over BLE. Normal reads, writes, notifications, and indications map directly to documented PANS GATT characteristics.

Do not issue BLE configuration writes concurrently with SPI/UART control operations against the same node. Keep one configuration/control path active at a time so PANS firmware state changes remain ordered and observable.

## Firmware and protocol assumptions

- Supported firmware revision: **TBD before hardware qualification**. Development is currently targeting DWM1001/PANS firmware behavior represented by the checked-in UUID registry and codec tests, but the exact DWM1001-DEV/MDEK1001 PANS firmware version still needs confirmation on hardware.
- Documentation source: **TBD before hardware qualification**. The UUID registry and packet assumptions in `src/ExpoPansBleApi.types.ts` and `src/ExpoPansBleApiModule.ts` should be verified against the exact PANS BLE documentation revision used with the target firmware.
- Current decoder guardrails assume proxy positions contain at most 5 entries, anchor lists contain at most 16 entries, distance-only location frames contain at most 15 entries, and combined position-plus-distance frames contain at most 4 distance entries. These limits are based on the checked-in implementation and tests and must be confirmed against the target firmware revision.
- Label writes UTF-8 encode the JavaScript string before writing the GAP Device Name characteristic. The exact firmware-compatible byte limit has not been verified from local documentation, so no hard-coded label byte limit is enforced yet. TODO: verify the maximum label byte length against the target PANS BLE documentation/firmware and add byte-length validation.

## Native platforms

- Android: platform BLE GATT APIs (`BluetoothGatt`, `BluetoothLeScanner`)
- iOS: CoreBluetooth (`CBCentralManager`, `CBPeripheral`)

Development builds are required; Expo Go cannot load this custom native module.

## Config plugin

Both app configs already invoke the plugin. It adds:

- Android 12+: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`
- Android 11 and lower: legacy Bluetooth permissions with `maxSdkVersion=30`
- `ACCESS_FINE_LOCATION` for BLE scanning/location behavior
- BLE hardware feature with `required=false`
- iOS Bluetooth usage descriptions

## Event model

- `onDeviceDiscovered`
- `onConnectionStateChanged`
- `onCharacteristicNotification`
- `onError`

Discovery uses cross-platform `deviceId`:

- Android: normalized MAC address, also exposed as `macAddress`
- iOS: `CBPeripheral.identifier.uuidString`; no fake MAC address is produced

## Public API shape

Low-level bridge:

- `startScanning()`, `stopScanning()`, `clearDevices()`
- `getCapabilities()`, `getPermissionStatus()`, `requestPermissions()`
- `connect(deviceId, timeoutMs?)`, `disconnect(deviceId)`
- `readCharacteristic(deviceId, characteristicUuid)`
- `writeCharacteristic(deviceId, characteristicUuid, payload, writeType?)`
- `setCharacteristicNotifications(deviceId, characteristicUuid, enabled)`
- `requestMtu(deviceId, mtu)` on Android
- `getMaximumWriteValueLength(deviceId, writeType)` on iOS

Typed helpers include label, operation mode, PAN ID, location-data mode, location data, proxy positions, device info, statistics, persisted position, anchor MAC stats, cluster info, anchor list, tag update rate, explicit disconnect, and raw firmware-update packet primitives.

Codec helpers live in TypeScript and are covered by Jest tests.

`requestMtu(deviceId, mtu)` is Android-only. Platforms without explicit MTU negotiation support reject direct calls with `UNSUPPORTED`; iOS firmware-update transport sizing uses `getMaximumWriteValueLength(deviceId, writeType)` instead.

## Provisioning role transitions

Shared provisioning helpers make role changes deterministic while preserving reserved operation-mode bits in the lower-level codec:

- Configuring an anchor explicitly clears tag-only `lowPowerModeEnabled` and `locationEngineEnabled` flags.
- Configuring a tag explicitly clears anchor-only `initiatorEnabled` while preserving intentional tag low-power behavior unless a future explicit option changes it.

## Example

```ts
import {
  addDeviceDiscoveredListener,
  addLocationDataListener,
  connect,
  readLocationData,
  startScanning,
  subscribeLocationData,
} from "expo-pans-ble-api";

addDeviceDiscoveredListener(async ({ devices }) => {
  const tag = devices.find((device) => device.presence?.role === "tag");
  if (!tag) return;

  const connected = await connect(tag.deviceId, 10_000);
  if (!connected) return;

  await subscribeLocationData(tag.deviceId);
  console.log(await readLocationData(tag.deviceId));
});

addLocationDataListener((event) => {
  console.log(event.deviceId, event.payload);
});

await startScanning();
```

## Validation

From the repository root:

```bash
npm run type-check --workspace modules/expo-pans-ble-api
npm run lint --workspace modules/expo-pans-ble-api
npm run test --workspace modules/expo-pans-ble-api
npm run validate:expo:doctor
npm run validate:expo:install-check
```

Hardware verification still requires recently woken DWM1001-DEV/MDEK1001 nodes running PANS firmware.

Manual hardware verification plan for the target firmware:

1. BLE discovery on Android.
2. BLE discovery on iOS.
3. Connection and service discovery.
4. Operation-mode read and write.
5. Tag conversion and anchor conversion.
6. PAN ID read and write.
7. Location-data mode write.
8. Location-data notifications.
9. Initial location-data read after subscription.
10. Disconnect and reconnect.
11. Bluetooth power-off while connected.
12. Android permission denial and retry behavior.
13. iOS delayed startup while CoreBluetooth is initializing.
14. Firmware-update transport sizing.
15. Android firmware-chunk pacing if no-response writes are exercised.
16. Brief advertisement-window behavior after waking a node.
