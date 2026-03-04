## Eight2Five Monorepo

This repo hosts the production mobile app, the optimization testbed, a shared localization/ble package, and the custom Expo module for KBeaconPro scanning.

- Apps
	- [apps/mobile](apps/mobile) – production client
	- [apps/testbed](apps/testbed) – various feature testing applications
- Shared logic: [packages/shared](packages/shared)
- Native module: [modules/expo-kbeaconpro](modules/expo-kbeaconpro)
- Swift LSP stubs for linting: [Package.swift](Package.swift) and [Sources](Sources)

### Getting started
```bash
npm ci
npm run start:mobile          # metro/devclient for production app
npm run start:testbed         # metro/devclient for testbed
```

### Quality gates
- Lint all workspaces: `npm run lint`
- Type-check all workspaces: `npm run type-check`
- Jest (skips empty suites): `npm run test`

### GitHub Actions
- test.yml – install once, run expo-doctor on both apps, then lint/type-check/test across workspaces
- test+build+deploy.yml – same tests, plus optional Android builds via EAS for a chosen app (`target_app` input)

### Swift stubs for linting
SwiftLint/SourceKit on non-macOS relies on [Sources](Sources) and [Package.swift](Package.swift) for dummy CoreBluetooth/ExpoModulesCore/kbeaconlib2 APIs. Keep these paths intact; they are not used in production builds.

### Notes
- Workspaces are hoisted; shared code is consumed via `@eight2five/shared` and the Expo module via `expo-kbeaconpro` file links.
- Assets are referenced relative to each app config in `assets/`.