# Eight2Five Testbed

Expo Router host for isolated hardware and localization experiments.

## DWM1001 Network Manager

The registered `DWM1001 Network Manager` subapp can:

- explicitly discover compatible PANS advertisements;
- persist local network profiles and device metadata in SQLite;
- assign PAN IDs and configure anchor/tag roles with read-back verification;
- run sequential, cancellable batch operations and PAN migrations;
- display anchor/tag positions on a pan-and-zoom Skia grid;
- inspect observed topology and structured diagnostics; and
- stream, persist, and export tag position logs.

Firmware update, bridge configuration, BLE disable, reset/factory reset,
encryption-key management, and auto-positioning remain unavailable pending
documented BLE support and physical hardware qualification.

The manager requires a custom development build because Expo Go cannot load
`expo-pans-ble-api`. Opening the manager does not request Bluetooth permission,
start scanning, connect, or write hardware. Those operations require explicit
user actions.

## Routing

- Home route: `app/index.tsx`
- Subapp registry: `src/subapps/index.ts`
- Manager routes: `app/(subapps)/dwm1001-manager/`
- Manager UI/provider: `src/subapps/dwm1001-manager/`

Subapps use nested Expo Router stacks. Add new subapps to the registry rather
than replacing the testbed home.

## Run

From the repository root:

```bash
npm run start:testbed
npm run android:testbed
npm run ios:testbed
```

## Verification

```bash
npm run validate
```

Workspace-scoped checks:

```bash
npm run lint --workspace eight2five-testbed
npm run type-check --workspace eight2five-testbed
npm run test --workspace eight2five-testbed
```
