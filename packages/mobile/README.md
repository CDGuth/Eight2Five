# @eight2five/mobile

Shared mobile logic for the Expo apps in this monorepo.

## Key areas

- `src/localization`: filters, field models, and MFASA localization
- `src/hooks`: source-agnostic scanner integration
- `src/providers`: PANS BLE observation and provisioning helpers
- `src/pans-manager`: persistent DWM1001 manager domain services

## PANS manager architecture

The manager package separates UI-independent workflows from the native BLE
transport:

```text
testbed routes and components
        ↓
pans-manager repositories and services
        ↓
PANS session/provisioning boundaries
        ↓
expo-pans-ble-api
```

It provides:

- in-memory and Expo SQLite repositories with schema migrations;
- explicit discovery and compatibility classification;
- exclusive BLE session ownership and serialized mutations;
- verified tag, anchor, label, and PAN configuration;
- persisted batch operations and network import/export;
- observed topology and structured diagnostic reads;
- live position streaming and buffered CSV/JSON logs; and
- Skia grid rendering and coordinate transforms.

`deviceId` is local manager identity. `transportDeviceId` is the canonical BLE
transport identity; a MAC address is optional and must not be assumed on iOS.

Firmware execution is disabled by
`ENABLE_DWM1001_FIRMWARE_UPDATE = false`. Tag update-rate writes, bridge mode,
reset, encryption, and auto-positioning are not exposed until their BLE
behavior is documented and hardware-qualified.

## Existing provisioning helpers

- `configureTag()` / `setupTag()`
- `configureAnchorNode()` / `setupAnchorNode()`
- `readTagOperationMode()` / `readAnchorOperationMode()`
- `observeTagAnchors()` / `readAnchorNeighbors()`
- field commissioning and anchor reconciliation helpers

## Verification

From the repository root:

```bash
npm run validate
```

Workspace-scoped checks:

```bash
npm run lint --workspace @eight2five/mobile
npm run type-check --workspace @eight2five/mobile
npm run test --workspace @eight2five/mobile
```
