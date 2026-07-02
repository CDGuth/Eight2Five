## Eight2Five App

Primary production client for performer localization.

### Routing
- Uses Expo Router for file-based navigation.
- Root layout: `app/_layout.tsx`
- Home route: `app/index.tsx`

### Run
```bash
pnpm start:mobile      # from repo root
pnpm android:mobile    # run on Android device/emulator
pnpm ios:mobile        # run on iOS simulator/device
```

### Quality

Preferred from repo root:

```bash
pnpm validate:core
pnpm validate
```

Workspace-scoped checks:

```bash
pnpm --filter eight2five-mobile lint
pnpm --filter eight2five-mobile type-check
pnpm --filter eight2five-mobile test
```

### Expo config
- Config: [app.config.ts](app.config.ts)
- Router entry: [index.tsx](index.tsx)
- Assets resolved from [../../assets](../../assets)
- Native KBeaconPro plugin: [../../modules/expo-kbeaconpro](../../modules/expo-kbeaconpro)
- Native PANS BLE plugin: [../../modules/expo-pans-ble-api](../../modules/expo-pans-ble-api)
- Shared mobile localization stack: [../../packages/mobile](../../packages/mobile)

### Provider model
- The shared scanner hook now supports source injection through provider abstractions.
- Default behavior is now automatic dual-source mode (`kbeacon` + `pans-ble`) without app-config setup.
- You can still override in code using `useBeaconScanner({ sourceKind: "kbeacon" | "pans-ble" | "auto" })`.

### Build
Use EAS (local or cloud) from this directory:
```bash
cd apps/mobile
pnpm install
pnpm add --global eas-cli
EAS_NO_VCS=1 eas build --platform android --profile development
```
Adjust profile as needed (see root `eas.json`).
