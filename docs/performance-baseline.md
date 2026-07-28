# PANS Manager Performance Baseline

Baseline date: 2026-07-27

Baseline branch: `feature/dwm1001-network-manager`

Baseline starting commit: `e9acf6b`

## Collection status

Measured device baselines were intentionally deferred at the user's direction. No
Android emulator, iOS simulator, physical phone, or DWM1001 target was available
through the mobile test service during this phase. Values that require a real UI
or BLE/UWB hardware are therefore recorded as **not collected**, rather than
replacing them with misleading Jest timings.

| Scenario | Modal latency | JS/UI frame drops | React commits | Discovery rate | Repository queries | Inspections/open | Cold start |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cold launch, no saved devices | not collected | not collected | not collected | not collected | not collected | n/a | not collected |
| Cold launch, about 20 saved devices | not collected | not collected | not collected | not collected | not collected | n/a | not collected |
| Cold launch, large populated data set | not collected | not collected | not collected | not collected | not collected | n/a | not collected |
| Network settings while scanning | not collected | not collected | not collected | not collected | not collected | n/a | n/a |
| Offline device settings | not collected | not collected | not collected | not collected | not collected | not collected | n/a |
| Online device settings | not collected | not collected | not collected | not collected | not collected | not collected | n/a |
| Discovery-only device settings | not collected | not collected | not collected | not collected | not collected | not collected | n/a |
| Continuous settings typing | not collected | not collected | not collected | not collected | not collected | n/a | n/a |
| Map settings during tracking | not collected | not collected | not collected | not collected | not collected | n/a | n/a |
| Multi-network units/area update | not collected | not collected | not collected | not collected | not collected | n/a | n/a |
| Accordion changes during discovery | not collected | not collected | not collected | not collected | not collected | n/a | n/a |

## Reproducible collection protocol

Use one release-mode development client and the same device, OS build, and PANS
firmware before and after a phase. Seed deterministic repositories with 0, 20,
and the agreed large device count. For each scenario:

1. Restart the app and discard the first warm-up run.
2. Record five runs with React Native DevTools profiling enabled only for commit
   counts; use platform frame metrics for JS/UI frame drops.
3. Record median tap-to-first-visible-frame latency and cold-start duration.
4. Capture repository method counters, inspection calls, native scan callbacks,
   and discovery-store publications from the same interval.
5. Record the device model, OS, app build, git commit, PANS firmware, saved-data
   counts, and whether scanning/tracking was active.

The deterministic five-minute stream workload remains
`packages/mobile/src/pans-manager/__tests__/synthetic-position-notifications.test.ts`:
it emits 3,000 ordered packets at a modeled 10 Hz and verifies exact pipeline
counters without treating host-dependent wall-clock time as a correctness gate.

## Phase 0 safeguards

- Manager settings are disabled until persisted settings hydrate.
- A pristine settings form hydrates from asynchronously arriving values.
- A dirty settings form retains user edits when a later refresh arrives.
- Automatic and manual inspection share one device-scoped in-flight operation.
- Device modal opening, inspection, saving, and closing are covered for offline,
  online, and discovery-only records.
- Multi-network map setting commands retain all selected network IDs.
- The pre-optimization accordion behavior is characterized explicitly: collapsed
  network device rows are still mounted. A later phase intentionally changes this
  expectation to lazy mounting.

## Legacy-consumer audit at baseline

No application under `apps/mobile` or `apps/testbed` imports or invokes the
generic localization stack. Its references are confined to its own shared-package
implementation, tests, barrel exports, and stale documentation/tooling:

- `LocalizationEngine`, `MFASAOptimizer`, `useBeaconScanner`, `BeaconSource`,
  `PansBleSource`, `PansProvisioning`, and field configuration types have no app
  call sites.
- Legacy `PansProvisioning` configuration, inspection, topology, and live-frame
  operations are covered by active services under `packages/mobile/src/pans-manager`.
  Field-anchor reconciliation exists only to support the dead generic field model.
- KBeacon, Kalman, path-loss, and RSSI-distance references are documentation,
  Swift editor stubs, Syncpack/gitignore entries, or archived research.
- RSSI in `PansDiscoveryService`, native `expo-pans-ble-api`, and testbed signal
  indicators is active discovery telemetry and is deliberately retained.
