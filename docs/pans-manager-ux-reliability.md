# PANS Manager UX and Reliability Implementation Record

Branch: `feature/testbed-pans-manager-ux-reliability`

## Phase status

| Phase | Status | Notes |
| --- | --- | --- |
| 0 — Baseline, fixtures, observability | Complete (environment-limited) | Canonical location packets and deterministic 1/10 Hz notification source added. Device screenshots and a real tag capture are deferred because no device is available. |
| 1 — App shell and navigation | Complete (device review pending) | Added a black safe-area scrim and toolbar for subapp routes, Gluestack Drawer navigation, focused toolbar action registration, home copy, PANS naming, and explicit map-label typography. |
| 2 — Continuous discovery | Complete (device review pending) | Discovery now auto-starts after one permission flow, runs continuously, serializes rapid intent changes, and resumes after foregrounding. Obsolete duration settings were migrated out. |
| 3 — Hardware-derived state | Complete (device review pending) | Device identity and cached profile membership now come from hardware label/PAN reads. Duplicate-PAN profiles surface as conflicts. Device-local nickname, notes, and profile selection were removed from UI and v2 exports. |
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

## Phase 1 implementation notes

- `apps/testbed/app/(subapps)/_layout.tsx` keeps the home route outside the toolbar while applying `TestbedSubappShell` to every nested subapp route.
- `apps/testbed/src/components/testbed-toolbar.tsx` scopes actions to focused routes and removes them on blur/unmount. Networks registers Scan and Map registers Settings.
- `apps/testbed/src/components/TestbedSubappShell.tsx` uses the generated Gluestack Drawer with Home, a divider, and registered subapps only. Drawer rows expose labels, selected state, and 44-point minimum targets.
- `apps/testbed/app/_layout.tsx` renders a visible light `StatusBar`; both home and subapp layouts draw black content behind transparent system-bar icons.
- Source Sans 3 is loaded before routing and is now explicitly applied to `PansNetworkGrid` labels.
- Official implementation references: <https://github.com/expo/expo/blob/main/docs/pages/tutorial/configuration.mdx> and <https://github.com/gluestack/gluestack-ui/blob/main/apps/website/app/ui/docs/components/drawer/index.mdx>.
- Screenshots and no-flash status-bar verification remain device tasks because no simulator or physical device is attached to this environment.

## Phase 2 implementation notes

- `PansDiscoveryService` now uses `idle → starting → scanning → stopping → idle` reconciliation with a retained desired state. Duplicate starts/stops coalesce, stop during a pending start is honored after native start resolves, and stale work cannot reactivate a stopped scan.
- The no-result watchdog remains diagnostic-only. The 25-second stop timer, restart cooldown, and `SCAN_THROTTLED` error were removed.
- `PansManagerProvider` auto-starts after permission is granted, requests permission at most once per provider lifetime, preserves scan intent through backgrounding, and restarts on foreground after re-reading permission state.
- Database schema version 2 removes legacy `scanDurationMs` and `discoveryScanDurationMs` JSON properties. Runtime normalizers also strip both properties so old databases and imports remain readable without writing the fields back.
- The toolbar action now has no scan/stop glyph: idle displays white `Scan`; starting/scanning/stopping display a white spinner over the always-black toolbar.
- React Native AppState implementation reference: <https://github.com/react/react-native-website/blob/main/docs/appstate.md>.

## Phase 3 implementation notes

- Device display names now prefer `lastKnownConfig.label`, then the legacy hardware-label cache, then a stable node/transport identifier. Deprecated app nickname and notes columns remain readable for database compatibility but are no longer written or shown.
- `resolveCachedProfileMatch` distinguishes unverified hardware PAN, no saved match, one exact match, and duplicate-PAN conflict. Provider refreshes reconcile the cached `networkId` from that result; stale local selections are cleared.
- Available saved devices are inspected automatically once per discovery-presence window. Concurrent automatic and explicit inspections share one in-flight request.
- Device settings now use Identity, Network, Node role and UWB, role-specific configuration, and Firmware and diagnostics categories. Network and map settings were reorganized and reuse `SettingHelp` / `SettingInfoCard` for hardware limits, coordinate semantics, update modes, timeouts, and firmware behavior.
- Network export schema version 2 excludes device `networkId`, nickname, and notes. Export membership is recomputed from a unique hardware PAN match. Version 1 imports remain accepted, have deprecated local fields stripped, and derive membership after import.
- Phase verification: all TypeScript and lint workspaces, Syncpack, and Jest passed (`19` testbed suites / `86` tests, `24` shared-mobile suites / `108` tests, and `3` Expo PANS BLE API suites / `58` tests). Expo Doctor passed `21/21` for both apps and Expo dependency checks are current.
- Full `npm run validate` remains environment-limited at the unchanged iOS native test failure (`libncurses.so.6` missing). Android native tests remain blocked by missing Java/`JAVA_HOME`; `adb devices` reports no attached target, so Android UI smoke tests and screenshots are deferred.
