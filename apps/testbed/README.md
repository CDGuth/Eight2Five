# Eight2Five Testbed

Expo Router hardware test application for the DWM1001 PANS network manager.
The testbed opens directly into the manager; it no longer has a subapp registry,
selection screen, or sidebar.

## PANS Network Manager

The testbed can:

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
`expo-pans-ble-api`. Hardware operations require explicit user actions.

## Routing

- Entry redirect: `app/index.tsx`
- Native tabs: `app/(tabs)/`
- Device routes: `app/devices/[deviceId]/`
- Network routes: `app/networks/`
- Root manager provider and toolbar shell: `app/_layout.tsx`
- Manager public entrypoint: `src/pans-manager/`

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
