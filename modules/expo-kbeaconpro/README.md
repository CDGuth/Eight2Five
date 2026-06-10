# expo-kbeaconpro

Expo native module wrapper for KKM KBeaconPro BLE devices used by Eight2Five field localization.

## Platform and build requirements

- Supported platforms: Android and iOS.
- Requires a development build or production native build. Expo Go cannot load this native module.
- Android SDK dependency: `com.kkmcn.kbeaconlib2:kbeaconlib2:1.3.3`.
- iOS CocoaPods dependency: `kbeaconlib2 1.2.1`.

## Config plugin behavior

The config plugin injects foreground BLE permissions only.

Android:

- `android.permission.BLUETOOTH_SCAN`
- `android.permission.BLUETOOTH_CONNECT`
- `android.permission.BLUETOOTH` with `maxSdkVersion=30`
- `android.permission.BLUETOOTH_ADMIN` with `maxSdkVersion=30`
- `android.permission.ACCESS_FINE_LOCATION` with `maxSdkVersion=30`
- BLE feature declaration: `android.hardware.bluetooth_le` with `required=false`

iOS:

- `NSBluetoothAlwaysUsageDescription`
- `NSBluetoothPeripheralUsageDescription`

The plugin does not inject iOS location usage text. CoreBluetooth scanning does not require iOS location permission.

## Public API summary

- Scanning: `startScanning(): Promise<void>`, `stopScanning()`, `clearBeacons()`.
- Capabilities: `getCapabilities()`.
- Permissions: `getPermissionStatus()`, `requestPermissions()`.
- Connection: `connect(mac, password?, timeoutMs?)`, `connectEnhanced(mac, password?, timeoutMs?, connPara?)`, `disconnect(mac)`.
- Configuration: `modifyConfig(mac, configs, options?)`.
- Snapshot: `readDeviceSnapshot(mac)`.
- Sensor records: `readSensorDataInfo(mac, sensorType)`, `readSensorRecords(mac, request)`, `clearSensorHistory(mac, sensorType)`.
- Notifications: `subscribeNotify(mac, eventType?)`, `unsubscribeNotify(mac, eventType?)`.
- Compatibility notification wrappers are retained: `subscribeSensorDataNotify`, `unsubscribeSensorDataNotify`.

Timeout values are always milliseconds. The default is `15000` ms.

## Events

- `onBeaconDiscovered`
- `onConnectionStateChanged`
- `onNotifyDataReceived`
- `onBluetoothStateChanged`
- `onError`

## Canonical beacon packet schema

Native platforms emit normalized uppercase MAC addresses as both `deviceId` and `mac`:

```ts
{
  deviceId: "AA:BB:CC:DD:EE:FF",
  mac: "AA:BB:CC:DD:EE:FF",
  name?: string,
  rssi: number,
  isConnectable?: boolean,
  connectionState?: KBConnState,
  advPackets: KBAdvPacket[],
}
```

Both platforms emit all cached advertisement packets where the vendor SDK exposes them. Eddystone UID packets use canonical lowercase `0x`-prefixed hex strings:

```ts
{
  advType: KBAdvType.EddyUID,
  nid: "0x45696768743246697665",
  sid: "0x010000000000",
}
```

The legacy iOS `bid` field is not part of the public schema.

Normalized packet variants include iBeacon, Eddystone UID/URL/TLM, sensor, system, EBeacon, and unknown packets. Unknown packets preserve safe raw metadata instead of crashing.

## Eight2Five Eddystone-UID localization format

Eight2Five uses two rotating Eddystone-UID advertisement slots and merges packets by MAC address.

Slot 0 identity:

- NID: ASCII `Eight2Five` encoded as 10 bytes.
- SID byte 0: packet type `0x01`.
- SID byte 1 flags:
  - bit 0: configured
  - bit 1: password protected
  - bit 2: password derived from serial hash
- SID byte 2: signed reference tx power.
- SID bytes 3..5: zero padding.

Slot 1 position:

- NID bytes 0..3: X position as uint32 percentage.
- NID bytes 4..7: Y position as uint32 percentage.
- NID bytes 8..9: Z height as signed int16 centimeters.
- SID byte 0: packet type `0x02`.
- SID bytes 1..5: zero padding.

## Configuration support

The TypeScript schema uses discriminated unions with `configType`.

Implemented mappings:

- Common configuration.
- Advertisement slots: iBeacon, Eddystone UID, Eddystone URL, Eddystone TLM, sensor advertisement, EBeacon, disabled/null slot where the vendor SDK exposes a class.
- Triggers: base trigger, motion trigger, angle trigger.
- Sensors: humidity/temperature, light, GEO, scanner, PIR.

Config writes are strict: if any element is unsupported or malformed, the entire write is rejected and no partial config list is submitted. By default, `modifyConfig` refuses updates that explicitly set every included advertisement slot to `advConnectable: false`; pass `allowDisableAllConnectableSlots: true` only when deliberately disabling all updated connectable slots.

## Enhanced connect and snapshot

`connectEnhanced` supports vendor automatic read flags:

```ts
{
  syncUtcTime?: boolean;
  readCommPara?: boolean;
  readSlotPara?: boolean;
  readTriggerPara?: boolean;
  readSensorPara?: boolean;
}
```

After enhanced connect, `readDeviceSnapshot(mac)` returns values available in the vendor SDK cache, including common metadata and available slot/trigger/sensor information when exposed by the SDK.

## Sensor records and notifications

Use `readSensorRecords(mac, request)` with an explicit sensor type, read option, optional read position, and maximum record count. Unknown or partially modeled payloads preserve `raw` bytes when available.

Use `subscribeNotify` and `unsubscribeNotify` for live notifications. Notification events preserve byte arrays in `raw`, map known sensor record fields into `data`, and emit `data: null` for unsupported payload objects.

## Deferred scope

DFU is intentionally not implemented in this pass. The vendor SDK ecosystem includes Nordic-based update support, but this module currently reports `supportsDfu: false`.

Not included here: DFU UI, firmware hosting, background BLE scanning architecture, cloud sync, or PANS BLE changes.

## Validation

From the repository root:

```bash
npm run lint --workspace modules/expo-kbeaconpro
npm run type-check --workspace modules/expo-kbeaconpro
npm run test --workspace modules/expo-kbeaconpro
```
