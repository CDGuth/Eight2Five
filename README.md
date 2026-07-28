# Eight2Five Monorepo

This repository contains the field app, a DWM1001/PANS network-manager testbed, shared mobile services, and the native PANS BLE GATT module.

## Repository Structure

- [apps/mobile](apps/mobile): production Expo app used on-field.
- [apps/testbed](apps/testbed): PANS network-manager and hardware-validation app.
- [packages/mobile](packages/mobile): shared PANS manager services, persistence, map components, position streaming/logging, and mobile dependencies.
- [packages/ui](packages/ui): shared gluestack-ui v5 presentation components.
- [modules/expo-pans-ble-api](modules/expo-pans-ble-api): native DWM1001/PANS BLE GATT integration.

## Position Data Flow

```text
PANS BLE discovery/configuration
  → PANS location notifications
  → DWM1001 internal UWB position/ranges
  → PansPositionStreamService
  → map/logging UI
```

BLE is used to discover and configure PANS nodes and to transport location frames to the app. It does not derive positions from discovery signal strength. UWB ranging and position calculation happen inside the DWM1001/PANS network; location frames carry those calculated positions and anchor ranges to the app.

## Quick Start

```bash
npm ci
npm run start:mobile
npm run start:testbed
```

## Validation Commands

The complete root verification gate is:

```bash
npm run validate
```

- `npm run validate` runs type-check, lint, Syncpack validation, Jest and native PANS tests, Expo Doctor, and Expo dependency checks.
- The complete command requires both the Swift and Android/Gradle native-test toolchains. On unsupported hosts, run every supported command separately and report the omitted native target.

Use the lower-level commands directly when you only need a specific check:

```bash
npm run type-check
npm run lint
npm run syncpack:lint
npm run test:jest
npm run test:native:expo-pans-ble-api:ios
npm run test:native:expo-pans-ble-api:android
npm run expo:doctor
npm run expo:install-check
```

The native module requires a development build; Expo Go cannot load it. See [modules/expo-pans-ble-api/README.md](modules/expo-pans-ble-api/README.md) for its API and hardware-validation status.
