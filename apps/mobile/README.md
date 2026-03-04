## Eight2Five Mobile App

Primary production client for performer localization.

### Run
```bash
npm run start:mobile      # from repo root
npm run android:mobile    # run on Android device/emulator
npm run ios:mobile        # run on iOS simulator/device
```

### Quality
```bash
npm run lint --workspace apps/mobile
npm run type-check --workspace apps/mobile
npm run test --workspace apps/mobile
```

### Expo config
- Config: [app.config.ts](app.config.ts)
- Assets resolved from [../../assets](../../assets)
- Native KBeaconPro plugin: [../../modules/expo-kbeaconpro](../../modules/expo-kbeaconpro)
- Shared localization stack: [../../packages/shared](../../packages/shared)

### Environment
- `USE_NATIVE_BEACONING=true` enables native beaconing flag (read via `extra.isNativeBeaconingEnabled`).

### Build
Use EAS (local or cloud) from this directory:
```bash
cd apps/mobile
npm ci
npm install -g eas-cli
EAS_NO_VCS=1 eas build --platform android --profile development
```
Adjust profile as needed (see root `eas.json`).
