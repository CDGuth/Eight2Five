## Eight2Five App

Primary production client for displaying performer positions supplied by a DWM1001/PANS network.

### Routing
- Uses Expo Router for file-based navigation.
- Root layout: `app/_layout.tsx`
- Home route: `app/index.tsx`

### Run
```bash
npm run start:mobile      # from repo root
npm run android:mobile    # run on Android device/emulator
npm run ios:mobile        # run on iOS simulator/device
```

### Quality

Preferred from repo root:

```bash
npm run validate
```

The root command includes JavaScript and native PANS tests and therefore requires the documented Swift and Android/Gradle toolchains. Run supported checks separately when a native toolchain is unavailable.

Workspace-scoped checks:

```bash
npm run lint --workspace apps/mobile
npm run type-check --workspace apps/mobile
npm run test --workspace apps/mobile
```

### Expo config
- Config: [app.config.ts](app.config.ts)
- Router entry: [index.tsx](index.tsx)
- Assets resolved from [../../assets](../../assets)
- Native PANS BLE plugin: [../../modules/expo-pans-ble-api](../../modules/expo-pans-ble-api)
- Shared PANS manager and position-stream services: [../../packages/mobile](../../packages/mobile)

### Position data

```text
PANS BLE discovery/configuration
  → PANS location notifications
  → DWM1001 internal UWB position/ranges
  → PansPositionStreamService
  → map/logging UI
```

BLE handles discovery, configuration, and location-frame transport. The DWM1001/PANS network calculates positions and anchor ranges from UWB measurements; BLE discovery signal strength is not used to position performers.

### Build
The custom PANS module requires a development build; Expo Go is not supported. Use EAS (local or cloud) from this directory:
```bash
cd apps/mobile
npm ci
npm install -g eas-cli
EAS_NO_VCS=1 eas build --platform android --profile development
```
Adjust profile as needed (see root `eas.json`).
