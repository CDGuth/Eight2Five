# @eight2five/shared

Shared logic for localization, hooks, providers, and utilities used by apps in this monorepo.

## Key areas

- localization: filters, propagation models, optimizer interfaces
- hooks: scanner and shared app hooks
- providers: source abstractions for beacon ingestion
- utils: packet parsing and helper logic

## Quality

Preferred from repo root:

```bash
npm run validate:core
```

Workspace-scoped checks:

```bash
npm run lint --workspace @eight2five/shared
npm run type-check --workspace @eight2five/shared
npm run test --workspace @eight2five/shared
```

## Provider abstractions

Provider contracts live in:
- src/providers/types.ts

Built-in provider factories:
- createKBeaconSource()
- createPansBleSource()
- createAutoBeaconSource()
- createBeaconSource(kind)

Provisioning helpers:
- setupTag()
- setupAnchorNode()
- configureTag()
- configureAnchorNode()
- readTagOperationMode()
- readAnchorOperationMode()
- observeTagAnchors()
- reconcileFieldAnchorsFromTag()
- startAnchorReconciliationLoop()
- commissionFieldFromTag()

Scanner hook options now support provider injection and provider kind selection:
- source
- sourceKind

Default scanner behavior:
- `useBeaconScanner()` uses auto source mode by default, running both kbeacon and pans-ble providers without requiring app config flags.

Preference model:
- When a PANS tag is available, PANS becomes the exclusive positioning source in auto mode.
- RSSI-based positioning is sourced from KBeacon beacon advertisements only and is used only when no fresh PANS distance/position observations are available.
- By default, PANS internal location solver is enabled for simplicity and direct x/y is used as fact.
- You can disable PANS internal solver in code with `useBeaconScanner({ usePansInternalLocationSolver: false })` to force custom app-side optimization with PANS distances.
- Field configuration rules:
	- PANS internal solver enabled: field type not required.
	- PANS internal solver disabled: anchor geometry must be provided.
	- BLE-only fallback: field type and anchor geometry are required.
- The optimization engine is distance-first:
	- PANS UWB anchor distances are consumed directly.
	- RSSI measurements are converted to distances via an injected distance estimator before optimization.

## Migration direction

The shared package is moving toward source-agnostic localization ingestion so BLE RSSI and future UWB-oriented sources can coexist without transport-specific UI coupling.

## Source-agnostic architecture

Current provider paths:
- kbeacon source: raw advertisement packets parsed through existing beacon parser
- pans-ble source: normalized observation events emitted directly by provider

Pipeline layers:
1. Native provider modules
2. Shared source providers
3. Parsing and normalization boundary
4. Localization engine ingestion and optimization

Security and reliability goals:
- typed module APIs without shell passthrough
- strict input validation at TS/native boundaries
- deterministic error mapping for unsupported/timeouts/permission failures
- provider coexistence during migration to reduce rollout risk

Migration strategy:
1. keep auto source as default with PANS-first preference
2. use runtime hook options for provider and solver behavior overrides
3. validate parity in beacon map, filtered measurements, and position estimates
4. incrementally migrate screens to source-agnostic options
