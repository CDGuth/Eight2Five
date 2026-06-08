# expo-pans-ble-api

Expo native module for DWM1001/PANS BLE GATT integration.

This module is BLE-only. It does **not** expose the DWM1001 SPI/UART TLV host API over BLE. Normal reads, writes, notifications, and indications map directly to documented PANS GATT characteristics.

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
