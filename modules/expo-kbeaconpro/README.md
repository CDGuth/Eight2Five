# expo-kbeaconpro

Expo native module wrapper for KKM KBeaconPro BLE devices used by Eight2Five field localization.

## Platform and build requirements

- Supported platforms: Android and iOS.
- Requires a development build or production native build. Expo Go cannot load this native module.
- Android SDK dependency: `com.kkmcn.kbeaconlib2:kbeaconlib2:1.3.3`.
- iOS CocoaPods dependency: `kbeaconlib2 1.2.1`.

## Config plugin behavior

The config plugin injects foreground BLE permissions only and is non-destructive: it adds KBeaconPro requirements but does not remove host-app permissions or usage descriptions owned by other features.

Android:

- `android.permission.BLUETOOTH_SCAN`
- `android.permission.BLUETOOTH_CONNECT`
- `android.permission.BLUETOOTH` with `maxSdkVersion=30`
- `android.permission.BLUETOOTH_ADMIN` with `maxSdkVersion=30`
- `android.permission.ACCESS_FINE_LOCATION` with `maxSdkVersion=30`
- BLE feature declaration: `android.hardware.bluetooth_le` with `required=false`

These are written as `<uses-permission>` entries (`manifest["uses-permission"]` in Expo config-plugin XML form), not `<permission>` declarations.

iOS:

- `NSBluetoothAlwaysUsageDescription`
- `NSBluetoothPeripheralUsageDescription`

The plugin does not inject iOS location usage text. CoreBluetooth scanning does not require iOS location permission, and any existing `NSLocationWhenInUseUsageDescription` is preserved.

## Implementation status

Implemented:

- Foreground scanning and cached rotating advertisement packet emission.
- Normalized uppercase MAC output.
- Eddystone UID `nid`/`sid` parity across Android and iOS.
- Connection, enhanced connection, and disconnect cleanup.
- Typed config writes with strict invalid-config rejection.
- Capability and permission APIs.
- Bluetooth state and error events.
- Typed provider integration for the shared mobile scanner.

Partially implemented / requires native validation:

- `readDeviceSnapshot` maps SDK-cached common, slot, trigger, and sensor configuration sections when those sections were loaded by enhanced connect. Missing sections remain omitted rather than fabricated.
- Sensor history uses the shared fields that are supported by the bridged SDK calls: `sensorType`, optional non-negative `readPosition`, and positive `maxRecords`. `readOption` and `nextReadPosition` are not part of the cross-platform contract.
- Notification subscription accepts an optional `eventType`; Android forwards it to the vendor SDK and iOS now forwards it to `subscribeSensorDataNotify(_:notifyDelegate:callback:)` / `removeSubscribeSensorDataNotify(_:callback:)`.

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

After enhanced connect, `readDeviceSnapshot(mac)` returns values available in the vendor SDK cache:

- `common`: name, model/version metadata, slot/trigger limits, tx-power limits, and capability booleans when common parameters were loaded. Omitted when common parameters were not loaded.
- `slots`: advertisement slot configs when slot parameters were loaded. **Optional** — omitted when slot configuration was not loaded or the SDK returns no cached slot list. Loaded empty lists remain representable as empty arrays and are distinguishable from omitted metadata.
- `triggers`: trigger configs when trigger parameters were loaded. Omitted when not loaded.
- `sensors`: sensor configs when sensor parameters were loaded. Omitted when not loaded.

All snapshot sections may be omitted when not loaded or unavailable. The bridge never fabricates missing sections.

Eight2Five provisioning uses enhanced connect with `readCommPara: true` and `readSlotPara: true`; provisioning rejects snapshots missing required `supportsEddyUid`, `maxSlots`, or slot configuration metadata instead of assuming the beacon is compatible.

## Sensor records and notifications

Use `readSensorRecords(mac, request)` with an explicit `sensorType`, optional non-negative `readPosition`, and positive `maxRecords`. When `readPosition` is omitted, the bridge reads forward starting from position 0. Negative `readPosition` values are rejected by both the TypeScript wrapper and the native iOS bridge. `readOption` is intentionally not accepted because the previous bridge contract did not honor it consistently. `nextReadPosition` is also not exposed by the cross-platform response; callers that need richer cursor semantics should add a platform-specific API after native validation.

`readSensorDataInfo(mac, sensorType)` returns `totalRecordNum` and `unreadRecordNum` on both platforms. The `readIndex` field is **optional and platform-dependent**: Android may provide an SDK-derived `readIndex`; iOS omits `readIndex` when the SDK does not expose it. Callers must not assume `readIndex` is always present.

`clearSensorHistory(mac, sensorType)` forwards the requested sensor type on both platforms. Android uses its native sensor-type values directly; iOS maps the JavaScript enum values to the CocoaPods SDK constants before forwarding.

Unknown or partially modeled sensor payloads preserve `raw` bytes when available. Known fields may include `utcTime`, `sensorType`, `temperature`, `humidity`, `luxValue`, `pirIndication`, and `alarmStatus`.

Use `subscribeNotify` and `unsubscribeNotify` for live notifications. Notification events preserve byte arrays in `raw`, map known sensor record fields into `data`, and emit `data: null` for unsupported payload objects.

## Editor-only iOS stub

`Sources/kbeaconlib2/Stub.swift` exists only to help SourceKit-LSP on development machines that do not have the CocoaPods SDK available. The stub mirrors only real APIs used by production Swift code and must not be used as the source of truth for production API signatures. TypeScript and Jest tests do not prove CocoaPods API compatibility. Real iOS builds use the CocoaPods `kbeaconlib2` SDK, and a native iOS CocoaPods build **must** be run before release to verify that all protocol conformances, callback signatures, and SDK method calls compile against the real pod.

## Deferred scope

DFU is intentionally not implemented in this pass. The vendor SDK ecosystem includes Nordic-based update support, but this module currently reports `supportsDfu: false`.

Not included here: DFU UI, firmware hosting, background BLE scanning architecture, cloud sync, hardware validation, or PANS BLE changes.

## Validation

From the repository root:

```bash
npm run lint --workspace modules/expo-kbeaconpro
npm run type-check --workspace modules/expo-kbeaconpro
npm run test --workspace modules/expo-kbeaconpro
```
