# @eight2five/mobile

Shared DWM1001/PANS manager logic and mobile dependencies for the Expo apps in this monorepo.

## Key areas

- `src/pans-manager`: discovery, sessions, configuration, commissioning,
  persistence, topology, diagnostics, position streaming/logging, and map
  rendering

## PANS manager architecture

The manager package separates UI-independent workflows from native PANS BLE GATT access:

```text
map, logging, and manager UI
        ↓
pans-manager repositories and services
        ↓
PANS manager sessions and services
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

## Position data flow

```text
PANS BLE discovery/configuration
  → PANS location notifications
  → DWM1001 internal UWB position/ranges
  → PansPositionStreamService
  → map/logging UI
```

BLE is the discovery, configuration, and location-frame transport. Position and anchor-range values originate from the DWM1001/PANS network's internal UWB processing, not from BLE discovery signal strength. `PansPositionStreamService` owns the live session, decodes initial reads and notifications, and emits samples for display or logging.

`deviceId` is local manager identity. `transportDeviceId` is the canonical BLE
transport identity; a MAC address is optional and must not be assumed on iOS.

Firmware execution is disabled by
`ENABLE_DWM1001_FIRMWARE_UPDATE = false`. Tag update-rate writes, bridge mode,
reset, encryption, and auto-positioning are not exposed until their BLE
behavior is documented and hardware-qualified.

The public package surface is intentionally limited to `@eight2five/mobile` and
`@eight2five/mobile/pans-manager`; internal service files are not exported as
deep-import targets.

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
