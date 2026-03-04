## Eight2Five Testbed

Interactive playground for the MFASA optimizer, propagation models, and visualization.

### Run
```bash
npm run start:testbed      # from repo root
npm run android:testbed
npm run ios:testbed
```

### Quality
```bash
npm run lint --workspace apps/testbed
npm run type-check --workspace apps/testbed
npm run test --workspace apps/testbed
```

### Key files
- Screen: [src/screens/OptimizationTest/index.tsx](src/screens/OptimizationTest/index.tsx)
- Hooks: [src/screens/OptimizationTest/hooks/useOptimizationRunner.ts](src/screens/OptimizationTest/hooks/useOptimizationRunner.ts)
- Visualization components: [src/screens/OptimizationTest/components](src/screens/OptimizationTest/components)
- Shared localization + models: [../../packages/shared](../../packages/shared)

### Environment
- `USE_NATIVE_BEACONING=true` enables native beaconing flag (read via `extra.isNativeBeaconingEnabled`).

### Build
Use EAS from this directory when exporting builds for experiments:
```bash
cd apps/testbed
npm ci
npm install -g eas-cli
EAS_NO_VCS=1 eas build --platform android --profile development
```
