# expo-pans-ble-api

Expo native module for DWM1001/PANS BLE GATT integration.

This module is BLE-only. It does **not** expose the DWM1001 SPI/UART TLV host API over BLE. Normal reads, writes, notifications, and indications map directly to documented PANS GATT characteristics.

Do not issue BLE configuration writes concurrently with SPI/UART control operations against the same node. Keep one configuration/control path active at a time so PANS firmware state changes remain ordered and observable.

## Firmware and protocol assumptions

- Implemented against **DWM1001 Firmware API Guide v2.3** and the **DWM1001 PANS Library v1.3.0 BLE GATT interface**.
- This is a BLE GATT bridge, not a BLE transport for SPI/UART TLV commands.
- Target hardware must have compatible PANS firmware flashed before the BLE bridge can operate. DWM1001-DEV and MDEK1001 hardware may contain PANS-flashed modules; bare DWM1001C modules can be blank.
- Documented decoder and encoder limits enforced by this package:
  - proxy positions: maximum 5 entries
  - anchor list: maximum 16 entries
  - distance-only location frame: maximum 15 entries
  - combined position-plus-distance frame: maximum 4 distance entries
  - firmware-update chunk data: maximum 32 bytes
  - node label: maximum 16 UTF-8 bytes
- BLE configuration writes must not be mixed concurrently with SPI/UART configuration operations against the same node.
- Android firmware-update write-without-response pacing still requires hardware qualification.
- Physical-device testing remains deferred; see the deferred validation checklist below.

## Native platforms

- Android: platform BLE GATT APIs (`BluetoothGatt`, `BluetoothLeScanner`)
- iOS: CoreBluetooth (`CBCentralManager`, `CBPeripheral`)

Development builds are required; Expo Go cannot load this custom native module.

## Config plugin

Both app configs already invoke the plugin. It adds:

- Android `<uses-permission>` entries for Android 12+: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`
- Android `<uses-permission>` entries for Android 11 and lower: legacy Bluetooth permissions with `maxSdkVersion=30`
- Android `<uses-permission>` entry for Android 11 and lower: `ACCESS_FINE_LOCATION` for BLE scanning/location behavior with `maxSdkVersion=30`
- BLE hardware feature with `required=false`
- iOS Bluetooth usage descriptions only

The plugin does not inject `NSLocationWhenInUseUsageDescription`. It preserves pre-existing host-owned plist values, including host-owned location usage text and unrelated usage descriptions.

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
- Configuring a tag explicitly clears anchor-only `initiatorEnabled` and writes deterministic responsive-mode and stationary-detection flags.

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

  console.log(await readLocationData(tag.deviceId));
  await subscribeLocationData(tag.deviceId);
});

addLocationDataListener((event) => {
  console.log(event.deviceId, event.payload);
});

await startScanning();
```

## Validation

From the repository root:

```bash
pnpm --filter expo-pans-ble-api type-check
pnpm --filter expo-pans-ble-api lint
pnpm --filter expo-pans-ble-api test
pnpm validate:expo:doctor
pnpm validate:expo:install-check
```

Do not treat source-level tests as hardware qualification. The following checks are deferred until native builds and physical DWM1001/PANS hardware are available:

- verify target DWM1001-DEV or MDEK1001 units are flashed with compatible PANS firmware
- verify discovery after wake-up
- verify tag and anchor role transitions
- verify network ID read and write
- verify persisted anchor position
- verify location-data mode
- verify initial location read and notifications
- verify reconnect after disconnect
- verify Android MTU negotiation
- verify firmware-update offer and poll flow
- verify Android write-without-response chunk pacing
- verify iOS maximum-write-length sizing
- verify label write behavior on hardware
