# PANS Manager UX and Reliability Implementation Record

Branch: `feature/testbed-pans-manager-ux-reliability`

## Phase status

| Phase | Status | Notes |
| --- | --- | --- |
| 0 — Baseline, fixtures, observability | Complete (environment-limited) | Canonical location packets and deterministic 1/10 Hz notification source added. Device screenshots and a real tag capture are deferred because no device is available. |
| 1 — App shell and navigation | Not started | |
| 2 — Continuous discovery | Not started | |
| 3 — Hardware-derived state | Not started | |
| 4 — Hierarchy and deletion | Not started | |
| 5 — Form controls | Not started | |
| 6 — Map behavior | Not started | |
| 7 — Packet and live updates | Not started | |
| 8 — Integration | Not started | |

## Phase 0 baseline — 2026-07-22

- Base commit: `03d0608` on `feature/dwm1001-network-manager`.
- JavaScript/TypeScript baseline: type checking, linting, Syncpack, and all Jest suites passed (`18` testbed suites / `79` tests, `21` shared-mobile suites / `94` tests, and `3` Expo PANS BLE API suites / `55` tests).
- Full `npm run validate` reached native tests and stopped because the local Swift toolchain cannot load `libncurses.so.6`.
- The Android native test command cannot run because this environment has no Java runtime or `JAVA_HOME`.
- No Android/iOS device or simulator is available through the mobile test service. Baseline screen captures, scan interaction captures, Android smoke testing, and a real tag packet capture therefore require a user-provided device/build.
- The documented 18-byte position packet is represented by both four-zero-byte and nonzero-extension fixtures. The current decoder reproduces the trailing-byte diagnostic while preserving the canonical position prefix.
- Post-change targeted codec/parser/synthetic-source tests pass. The repository-wide TypeScript, lint, Syncpack, and Jest portions of `npm run validate` pass (`18` testbed suites / `79` tests, `22` shared-mobile suites / `97` tests, and `3` Expo PANS BLE API suites / `58` tests). Native validation remains blocked by the environment issues above.

## Evidence locations

- Packet fixtures: `modules/expo-pans-ble-api/src/testing/PansLocationDataFixtures.ts`
- Synthetic notification source: `packages/mobile/src/pans-manager/testing/SyntheticPansPositionNotificationSource.ts`
- Stream-order regression: `packages/mobile/src/pans-manager/__tests__/synthetic-position-notifications.test.ts`
