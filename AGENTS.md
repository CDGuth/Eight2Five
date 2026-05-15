# Eight2Five Monorepo

Expo-based React Native monorepo for tracking marching band performers via BLE beacons.

## Architecture & Boundaries
- **`apps/mobile`**: Main React Native application used on the field.
- **`apps/testbed`**: Sandbox app to validate localization algorithms (MFASA, path-loss models) independent of the main app.
- **`packages/shared`** (`@eight2five/shared`): Core logic provider. Includes localization (Kalman filter, MFASA optimizer), hooks, and utils. 
- **`modules/expo-kbeaconpro`**: Native Expo module wrapping KBeaconPro SDKs (BLE).
- **`modules/expo-pans-ble-api`**: Native Expo module for DWM1001/PANS workflows (BLE only).

## Core Concepts
- **`useBeaconScanner`**: The source-agnostic integration hook. **UI components must consume this**, not transport-specific providers.
- Data Flow: `Provider Source → Parser/Adapter → Filter & Model → MFASA Optimizer → UI`. Keep side-by-side KBeacon and PANS BLE support unless told otherwise.

## Dependency Management
- **Shared Dependency Policy**: If a package is used by >1 app, or belongs in shared logic, it **MUST** be installed in `packages/shared` to prevent duplicate React instances.
- Command: `npm install <package> --workspace @eight2five/shared`

## Development & Verification
Run from the root of the repository:
- **`npm run validate`**: Runs linting, type-checking, testing, and Expo checks across all workspaces. Use this as your primary verification gate.
- **`npm run validate:expo:doctor`**: Required after changing Expo config, SDKs, or native plugins.
- **`npm run validate:expo:install-check`**: Required after any dependency updates to verify Expo compatibility.

## Documentation
- Detailed outdoor BLE localization math (Two-Ray Model) paper is at `.github/docs/BLE-Based Outdoor Localization With Two-Ray Ground-Reflection Model Using Optimization Algorithms/llms-txt-documentation.md`.
