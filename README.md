# Eight2Five Monorepo

This repository contains the production mobile client, feature testbed, shared localization engine, and custom Expo native modules used for BLE/UWB-oriented positioning workflows.

## Repository Structure

- Apps
	- [apps/mobile](apps/mobile): production app used on-field.
	- [apps/testbed](apps/testbed): sandbox for algorithm and model experiments.
- Shared package
	- [packages/shared](packages/shared): scanner hook, provider abstraction layer, localization engine, parsers, and provisioning helpers.
- Native modules
	- [modules/expo-kbeaconpro](modules/expo-kbeaconpro): KBeaconPro scan/connect/configure module.
	- [modules/expo-pans-ble-api](modules/expo-pans-ble-api): BLE TLV command/event interface for DWM1001/PANS.
- Native stubs for Swift tooling
	- [Package.swift](Package.swift), [Sources](Sources)

## Quick Start

```bash
npm ci
npm run start:mobile
npm run start:testbed
```

## Validation Commands

Prefer the root validation entry points for most work:

```bash
npm run validate:core
npm run validate
```

- `npm run validate:core` runs type-check, lint, and test across workspaces.
- `npm run validate` adds Expo doctor and Expo install checks for the Expo app workspaces.

Use the lower-level commands directly when you only need a specific check:

```bash
npm run type-check
npm run lint
npm run test
npx expo-doctor
npx expo install --check
```

## High-Level Architecture

```mermaid
flowchart LR
	subgraph Apps
		Mobile[apps/mobile]
		Testbed[apps/testbed]
	end

	subgraph Shared
		Hook[useBeaconScanner]
		Providers[Provider Layer]
		Engine[LocalizationEngine]
		Provisioning[PANS Provisioning Helpers]
	end

	subgraph NativeModules
		KBeacon[expo-kbeaconpro]
		PANS[expo-pans-ble-api]
	end

	Mobile --> Hook
	Testbed --> Hook
	Hook --> Providers
	Providers --> KBeacon
	Providers --> PANS
	Hook --> Engine
	Provisioning --> PANS
```

## End-to-End Data Flow

### 1) Data Collection

- `expo-kbeaconpro` emits scanned beacon advertisements.
- `expo-pans-ble-api` emits discovered BLE devices and notification payloads for PANS location frames.
- `@eight2five/shared` providers normalize both into source-agnostic events.

### 2) Normalization and Ingestion

- KBeacon packets are parsed by `parseBeaconData` into beacon state.
- PANS location data is parsed by `parsePansLocationDataPayload` and converted by `locationFrameToObservations`.
- `useBeaconScanner` ingests both raw beacons and normalized observations.

### 3) Measurement Processing

- RSSI observations are smoothed with a 1D Kalman filter.
- For RSSI-driven positioning, distance is estimated from propagation models.
- For PANS distance observations, direct distance measurements are used.
- For PANS direct position observations, position can be used directly (freshness-gated).
- PANS discovery RSSI is treated as device telemetry and is not used for localization estimation.

### 4) Position Solve

- `LocalizationEngine` builds optimization input with fresh measurements + configured anchor geometry.
- `MFASAOptimizer` searches candidate positions minimizing model error.
- Snapshot exposes:
	- current position estimate
	- filtered measurements
	- beacon/observation state

```mermaid
flowchart TD
	A[BLE Scan/Notify Events] --> B[Provider Layer]
	B --> C[Normalization]
	C --> D[LocalizationEngine.ingest/ingestObservation]
	D --> E[Kalman + Distance Estimation]
	E --> F[Optimization Input Builder]
	F --> G[MFASA Solver]
	G --> H[Snapshot Position + Measurements]
```

## Calculation Pipeline Details

- Indoor path loss: log-normal model.
- Outdoor path loss: two-ray ground-reflection model.
- Optimizer: memetic Firefly Algorithm + simulated annealing behavior (`MFASA`).
- Time slicing: optimization runs in throttled slices to avoid UI-thread blocking.
- Source preference in auto mode:
	- Fresh PANS UWB distance/position observations are preferred.
	- RSSI fallback remains available when fresh PANS ranging is absent, using KBeacon beacon RSSI only.

## Position Estimation Modes

The localization stack supports three practical paths to a position output.

```mermaid
flowchart LR
	subgraph ModeA["Mode A: BLE RSSI to MFASA"]
		A1[BLE RSSI observation<br/>KBeacon beacons only] --> A2[Kalman filter]
		A2 --> A3{Environment mode}
		A3 -->|Indoor| A4[Log-normal path-loss model]
		A3 -->|Outdoor| A5[Two-ray ground-reflection model]
		A4 --> A6[Distance estimator]
		A5 --> A6
		A6 --> A7[Optimization input<br/>distances + anchor geometry]
		A7 --> A8[MFASA optimizer]
		A8 --> A9[Position estimate]
	end

	subgraph ModeB["Mode B: PANS distance to MFASA"]
		B1[PANS location frame<br/>distance samples] --> B2[Frame parser]
		B2 --> B3[Optimization input<br/>direct ranges + anchor geometry]
		B3 --> B4[MFASA optimizer]
		B4 --> B5[Position estimate]
	end

	subgraph ModeC["Mode C: PANS direct position"]
		C1[PANS location frame<br/>x, y, z, quality] --> C2[Freshness + quality gate]
		C2 --> C3[Direct position output]
	end
```

Mode behavior summary:

- Mode A is the RSSI-based path, sourced from KBeacon beacon advertisements only, and uses the selected propagation model before optimization.
- Mode B uses direct UWB distance observations from PANS and still solves via MFASA.
- Mode C bypasses optimization and uses direct PANS position data when fresh.

## Anchor Geometry Freshness Strategy

Anchor geometry is static configuration, but anchor presence is dynamic. To prevent operational staleness:

1. Periodically observe anchors from a connected tag.
2. Reconcile observed anchor keys/node IDs against stored field configuration.
3. Flag unresolved observed anchors and stale configured anchors.

Use shared helpers from [packages/shared/src/providers/PansProvisioning.ts](packages/shared/src/providers/PansProvisioning.ts):

- `observeTagAnchors`
- `reconcileFieldAnchorsFromTag`
- `startAnchorReconciliationLoop`

Example:

```ts
import {
	startAnchorReconciliationLoop,
} from "@eight2five/shared";

const loop = startAnchorReconciliationLoop({
	fieldId: "practice-field-a",
	tagAddress: "AA:BB:CC:DD:EE:FF",
	store: fieldConfigurationStore,
	intervalMs: 10_000,
	onReconciled: (result) => {
		if (result.unresolvedObservedAnchorKeys.length > 0) {
			console.warn("Observed anchors missing geometry", result.unresolvedObservedAnchorKeys);
		}
		if (result.staleConfiguredAnchorKeys.length > 0) {
			console.warn("Configured anchors not recently observed", result.staleConfiguredAnchorKeys);
		}
	},
});

// later
loop.stop();
```

## Helper Function Map

### Shared Hook / Engine

- `useBeaconScanner`: high-level app integration point.
- `LocalizationEngine`: ingestion, filtering, and solve orchestration.

### Shared Provider Factories

- `createKBeaconSource`
- `createPansBleSource`
- `createAutoBeaconSource`
- `createBeaconSource`

### Shared PANS Provisioning Helpers

- `setupTag`
- `setupAnchorNode`
- `configureTag`
- `configureAnchorNode`
- `readTagOperationMode`
- `readAnchorOperationMode`
- `observeTagAnchors`
- `reconcileFieldAnchorsFromTag`
- `startAnchorReconciliationLoop`
- `commissionFieldFromTag`

### Parsing Helpers

- `parseBeaconData`
- `parsePansLocationDataPayload`
- `locationFrameToObservations`
- `toAnchorKey`

## Module API Documentation

- KBeacon module API: [modules/expo-kbeaconpro/README.md](modules/expo-kbeaconpro/README.md)
- PANS BLE module API: [modules/expo-pans-ble-api/README.md](modules/expo-pans-ble-api/README.md)

## CI and Workflow Notes

- Workspace-wide checks run via root scripts.
- Validation command policy lives in [.github/skills/validation-guide/SKILL.md](.github/skills/validation-guide/SKILL.md).
- Expo app configs include module config plugins for Bluetooth/location permission setup.
- Swift stubs under [Sources](Sources) support linting/tooling on non-macOS environments and are not runtime production code.
