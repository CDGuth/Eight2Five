## Eight2Five Testbed

Interactive playground for the MFASA optimizer, propagation models, and visualization.

### Routing
- Uses Expo Router with grouped mini-app routes.
- Home route: `app/index.tsx`
- Mini-app routes: `app/(subapps)/*`
- Current optimization route: `app/(subapps)/optimization.tsx`

### Adding a Mini-App
1. Add route metadata entry in `src/subapps/index.ts` (id, title, description, routeName, href).
2. Add a route file under `app/(subapps)/` for the mini-app screen.
3. Wrap the route with `SubappRouteLayout` so titles/descriptions stay registry-driven.
4. Keep simulation/business logic in `src/screens/<MiniApp>/hooks` and reusable controls in `src/screens/<MiniApp>/components`.
5. Use `contentMode="static"` for canvas, Skia, map, or other gesture-heavy mini-apps that manage their own scrolling.

### Run
```bash
npm run start:testbed      # from repo root
npm run android:testbed
npm run ios:testbed
```

### Quality

Preferred from repo root:

```bash
npm run validate
```

Workspace-scoped checks:

```bash
npm run lint --workspace apps/testbed
npm run type-check --workspace apps/testbed
npm run test --workspace apps/testbed
```

### Key files
- Screen: [src/screens/OptimizationTest/index.tsx](src/screens/OptimizationTest/index.tsx)
- Hooks: [src/screens/OptimizationTest/hooks/useOptimizationRunner.ts](src/screens/OptimizationTest/hooks/useOptimizationRunner.ts)
- Visualization components: [src/screens/OptimizationTest/components](src/screens/OptimizationTest/components)
- Router root layout: [app/_layout.tsx](app/_layout.tsx)
- Router home route: [app/index.tsx](app/index.tsx)
- Router subapp route: [app/(subapps)/optimization.tsx](app/(subapps)/optimization.tsx)
- Shared mobile localization + models: [../../packages/mobile](../../packages/mobile)
- PANS BLE module: [../../modules/expo-pans-ble-api](../../modules/expo-pans-ble-api)

### Optimization Source Modes
- `BLE RSSI`: Simulates RSSI-only measurements.
- `UWB Distance`: Simulates UWB distance observations for trilateration-style solving.
- `Hybrid`: Feeds both RSSI and distance observations into the optimizer.

### Multi-source direction
- Shared localization now includes provider abstractions for source-agnostic ingestion.
- Default behavior is now automatic dual-source mode (`kbeacon` + `pans-ble`) without app-config setup.
- Optional runtime override in code: `useBeaconScanner({ sourceKind: "kbeacon" | "pans-ble" | "auto" })`.

### Build
Use EAS from this directory when exporting builds for experiments:
```bash
cd apps/testbed
npm ci
npm install -g eas-cli
EAS_NO_VCS=1 eas build --platform android --profile development
```
