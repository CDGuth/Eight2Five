# PANS Manager UX and Reliability Implementation Record

Branch: `feature/testbed-pans-manager-ux-reliability`

## Phase status

| Phase | Status | Notes |
| --- | --- | --- |
| 0 — Baseline, fixtures, observability | Complete (environment-limited) | Canonical location packets and deterministic 1/10 Hz notification source added. Device screenshots and a real tag capture are deferred because no device is available. |
| 1 — App shell and navigation | Complete (device review pending) | Added a black safe-area scrim and toolbar for subapp routes, Gluestack Drawer navigation, focused toolbar action registration, home copy, PANS naming, and explicit map-label typography. |
| 2 — Continuous discovery | Complete (device review pending) | Discovery now auto-starts after one permission flow, runs continuously, serializes rapid intent changes, and resumes after foregrounding. Obsolete duration settings were migrated out. |
| 3 — Hardware-derived state | Complete (device review pending) | Device identity and cached profile membership now come from hardware label/PAN reads. Duplicate-PAN profiles surface as conflicts. Failed automatic inspections retry with bounded backoff. Device-local nickname, notes, and profile selection were removed from UI and v2 exports. |
| 4 — Hierarchy and deletion | Complete (device review pending) | Unassigned/Networks hierarchy with child rails, shared card insets, offline BluetoothOff styling, vertically constrained drag, swipe-to-delete with confirmation, and guarded unassignment using the PANS default PAN ID 0. |
| 5 — Form controls | Complete (device review pending) | Manager selects now use an anchored popover rather than an action sheet. Anchor quality is optional and defaults to 100, with field-level validation and help text. |
| 6 — Map behavior | Complete (device review pending) | Added persisted metric/imperial display units, infinite/bounded map modes, bounded-area rendering and camera constraints, origin axes and labels, scale readout, unit-aware editors/details, exact origin reset, and guarded two-pointer pinch focal handling. |
| 7 — Packet and live updates | Complete (native/device verification deferred) | Added extension-tolerant decoding with structured diagnostics, normalized notification device IDs, native sequence/timing metadata, Android MTU preparation, read-before-subscribe startup, stage counters through map updates, and a deterministic five-minute 10 Hz pipeline test. |
| 8 — Integration | Not started | |

## Phase 0 baseline — 2026-07-22

- Base commit: `03d0608` on `feature/dwm1001-network-manager`.
- JavaScript/TypeScript baseline: type checking, linting, Syncpack, and all Jest suites passed (`18` testbed suites / `79` tests, `21` shared-mobile suites / `94` tests, and `3` Expo PANS BLE API suites / `55` tests).
- Full `npm run validate` reached native tests and stopped because the local Swift toolchain cannot load `libncurses.so.6`.
- The Android native test command cannot run because this environment has no Java runtime or `JAVA_HOME`.
- No Android/iOS device or simulator is available through the mobile test service. Baseline screen captures, scan interaction captures, Android smoke testing, and a real tag packet capture therefore require a user-provided device/build.
- The observed 18-byte position packet is represented by both four-zero-byte and nonzero-extension fixtures. The official PANS BLE layout documents a 14-byte position frame; the additional four bytes remain an undocumented extension or padding. The current decoder reproduces the trailing-byte diagnostic while preserving the canonical position prefix.
- Post-change targeted codec/parser/synthetic-source tests pass. The repository-wide TypeScript, lint, Syncpack, and Jest portions of `npm run validate` pass (`18` testbed suites / `79` tests, `22` shared-mobile suites / `97` tests, and `3` Expo PANS BLE API suites / `58` tests). Native validation remains blocked by the environment issues above.

## Evidence locations

- Packet fixtures: `modules/expo-pans-ble-api/src/testing/PansLocationDataFixtures.ts`
- Synthetic notification source: `packages/mobile/src/pans-manager/testing/SyntheticPansPositionNotificationSource.ts`
- Stream-order regression: `packages/mobile/src/pans-manager/__tests__/synthetic-position-notifications.test.ts`

## Phase 1 implementation notes

- `apps/testbed/app/(subapps)/_layout.tsx` keeps the home route outside the toolbar while applying `TestbedSubappShell` to every nested subapp route.
- `apps/testbed/src/components/testbed-toolbar.tsx` scopes actions to focused routes and removes them on blur/unmount. Networks registers Scan and Map registers Settings.
- `apps/testbed/src/components/TestbedSubappShell.tsx` uses the generated Gluestack Drawer with Home, a divider, and registered subapps only. Drawer rows expose labels, selected state, and 44-point minimum targets. Top-level drawer destinations use route replacement so repeated selections do not accumulate duplicate history entries.
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
- Available saved devices are inspected automatically once per discovery-presence window. Concurrent automatic and explicit inspections share one in-flight request. A transient inspection failure clears the attempted marker and retries after exponential backoff from 1 to 30 seconds while the device remains available; retry state is cleared when the device disappears or the runtime changes.
- Device settings now use Identity, Network, Node role and UWB, role-specific configuration, and Firmware and diagnostics categories. Network and map settings were reorganized and reuse `SettingHelp` / `SettingInfoCard` for hardware limits, coordinate semantics, update modes, timeouts, and firmware behavior.
- Network export schema version 2 excludes device `networkId`, nickname, and notes. Export membership is recomputed from a unique hardware PAN match. Version 1 imports remain accepted, have deprecated local fields stripped, and derive membership after import.
- Phase verification at the time of the phase-3 commit: all TypeScript and lint workspaces, Syncpack, and Jest passed (`19` testbed suites / `86` tests, `24` shared-mobile suites / `108` tests, and `3` Expo PANS BLE API suites / `58` tests). Current repository-wide verification is recorded below because Expo patch recommendations have since changed.
- Full `npm run validate` remains environment-limited at the unchanged iOS native test failure (`libncurses.so.6` missing). Android native tests remain blocked by missing Java/`JAVA_HOME`; `adb devices` reports no attached target, so Android UI smoke tests and screenshots are deferred.

## Phase 4 implementation notes

- Networks and Devices now renders Unassigned Devices first, a divider, a Networks heading, then one-level network cards with a rail/elbow child connector. A shared `MANAGER_CARD_CONTENT_INSET` is applied to cards, rows, empty states, and the outer list so content never touches horizontal edges.
- Offline rows use muted but accessible colors (`theme.textMuted` minimum) and the Lucide `BluetoothOff` icon; `SignalZero` is no longer used for offline state.
- Dragging is vertically constrained: the preview keeps the measured source X and width, only Y follows the pointer, drop targets resolve from the preview midpoint, and invalid/cancelled drops animate back to the source. The measured-start callback now uses the latest pointer Y and ignores a measurement that completes after the gesture has finalized, preventing a jump or ghost preview. Only available, non-malformed Unassigned devices can be dragged.
- Swipe-left deletion uses RNGH `ReanimatedSwipeable` with a one-open-row registry and `Trash2`; every swipe action and every settings destructive action requires an explicit confirmation step.
- Deleting a network removes the saved profile and its position logs (transactionally in SQLite) without touching hardware; devices re-derive to Unassigned from cached PAN data. Legacy PAN 0 profiles are repair-only because PAN 0 is the PANS default used for unassigned devices; they cannot accept assignments.
- Source qualification: MDEK1001 System User Manual 1.3 section 6.4.2 documents that removing a device returns it to the Unassigned Devices list, the Firmware API Guide documents PAN IDs as unsigned 16-bit values, and Qorvo support identifies 0 as the PANS default PAN ID (<https://forum.qorvo.com/t/dwm1001-pans-custom-shell-output/6094/5>). The public manuals do not explicitly state which PAN value the DRTLS Manager writes during removal, so the implementation describes PAN 0 as the PANS default/unassigned value, not as a protocol-reserved identifier.
- Offline device deletion removes the saved record, snapshots, and position logs with no BLE call. Online unassignment first verifies that the current hardware PAN uniquely matches the saved association, then verifies passive UWB before writing and reading back the PANS default PAN ID 0 unassigned state. If the association no longer matches, no hardware write is attempted. Exact readback is persisted for retry and diagnostics before cached membership is reconciled.
- RNGH reference: <https://docs.swmansion.com/react-native-gesture-handler/docs/components/reanimated_swipeable>.
- Phase verification at the time of the phase-4 commit: all TypeScript and lint workspaces, Syncpack, and Jest passed (`20` testbed suites / `93` tests, `24` shared-mobile suites / `115` tests, and `3` Expo PANS BLE API suites / `58` tests). Current repository-wide verification is recorded below.
- Android UI smoke tests, screenshots, and hardware unassignment verification on real devices remain deferred until a compatible development environment and attached device are available.

## Phase 5 implementation notes

- All PANS manager select fields now use one `SelectField` implementation backed by the Gluestack popover primitive. The manager no longer imports the generated Select action-sheet components, so choices open next to their trigger instead of as bottom sheets.
- The shared select exposes a consistent unavailable state, placeholder, helper/error text, selected-state check mark, radio semantics, and 44-point minimum choice targets. Device and map settings reuse it instead of maintaining separate select implementations.
- Anchor position quality is optional in both device settings and map placement. A blank value resolves to quality 100; explicit values must be integers from 1 through 100.
- Anchor coordinates and quality surface field-specific validation and explanatory help. Invalid fields disable the relevant save/write action rather than relying only on a generic submission error.
- Phase verification: all TypeScript and lint workspaces, Syncpack, and Jest passed (`20` testbed suites / `96` tests, `24` shared-mobile suites / `116` tests, and `3` Expo PANS BLE API suites / `58` tests).
- Popover placement, keyboard interaction, screen-reader focus, and nested-modal behavior still require physical Android/iOS review.

## Phase 6 implementation notes

- Network settings now persist `mapUnits` (`metric` or `imperial`) and `mapAreaMode` (`infinite` or `bounded`). Existing records and exports normalize to metric/infinite without changing canonical coordinate storage.
- Coordinates, bounds, anchor editors, node details, log samples, ranging readouts, grid labels, and the scale indicator convert only at the display/input boundary. Stored positions and PANS writes remain meters.
- Bounded networks draw their saved X/Y rectangles. When every selected network is bounded, pan and pinch camera movement is constrained to the union of the selected rectangles; mixed or infinite selections retain an infinite camera while still showing bounded-network outlines.
- Origin axes are rendered separately from ordinary grid lines, so disabling the grid does not hide the X/Y origin. Axis tick labels use the selected units.
- Reset camera continues to write the exact default viewport centered at `(0, 0)`, independent of bounded-area clamping applied only to user gestures.
- Pinch handling no longer reads focal coordinates during gesture start. Updates with fewer than two pointers are ignored; the first valid two-pointer update establishes the focal world coordinate without a camera jump.
- Phase verification: all TypeScript and lint workspaces and Jest passed (`20` testbed suites / `98` tests, `25` shared-mobile suites / `120` tests, and `3` Expo PANS BLE API suites / `58` tests).
- Gesture feel, boundary behavior on unusually small rectangles, text density at extreme zoom, and physical-device accessibility remain deferred to Android/iOS review.

## Phase 7 implementation notes

- Location decoding now preserves both compatibility strings and structured diagnostics with stable codes, byte offsets, byte counts, and copies of extension bytes. Canonical position data is retained when extra bytes follow type-0 or type-2 frames.
- Type-2 parsing prefers the exact documented distance-only fallback before accepting an extended position-plus-distances layout, avoiding false position decoding when a fallback packet's byte 14 happens to be zero. Unrecognized type-2 extensions still preserve a valid 13-byte position prefix rather than discarding it.
- Benign trailing-byte diagnostics remain available in counters and decoded samples but no longer become the map's user-facing tracking warning when the position itself is valid.
- Android and iOS notification callbacks now attach a process-wide sequence, monotonic receipt timestamp, and native payload length. The JavaScript stream exposes these fields and counts callbacks, device-ID matches, decoded frames, positions, distance frames, diagnostic frames, decode failures, emitted samples, and sequence discontinuities.
- Transport device IDs are normalized across colon-separated, hyphen-separated, compact hexadecimal, UUID case, and ordinary textual forms before filtering. This removes silent drops caused only by platform formatting differences.
- Android-capable live sessions request MTU 247 before starting location traffic. Unsupported platforms skip the request without failing the stream. The initial location read now happens before notifications are enabled, preventing CoreBluetooth's shared read/notification callback from consuming a live notification as the read response.
- Map settings expose live pipeline counters through the final SharedValue position update stage. Native sequence discontinuities are explicitly described as diagnostic evidence rather than definitive loss because the sequence is process-wide.
- A timer-free five-minute 10 Hz test sends 3,000 ordered position packets through device-ID filtering, decoding, sample emission, and counter tracking with no sequence discontinuity or JavaScript-stage loss.
- Phase verification: all TypeScript and lint workspaces and Jest passed (`20` testbed suites / `98` tests, `25` shared-mobile suites / `122` tests, and `3` Expo PANS BLE API suites / `61` tests).
- The native event additions require rebuilding the Android and iOS development clients. Native compilation, a physical five-minute 10 Hz soak, BLE trace comparison, and screenshots remain deferred because they require the user's repaired Swift/Java environment and attached DWM1001 hardware.

## Post-review verification — 2026-07-23

- Type checking, linting, Syncpack, and all JavaScript/TypeScript Jest suites pass.
- Current Jest totals are `20` testbed suites / `94` tests, `24` shared-mobile suites / `116` tests, and `3` Expo PANS BLE API suites / `58` tests.
- Full `npm run validate` reaches native testing and stops at the iOS module test because the `swift` executable is unavailable on this Ubuntu 26 environment. Android native tests and the later Expo checks are therefore not reached by that command.
- Direct Expo Doctor and Expo install checks currently report only three SDK 56 patch-version recommendations in both apps: `expo` `56.0.16` → `~56.0.17`, `expo-dev-client` `56.0.23` → `~56.0.24`, and `expo-router` `56.2.15` → `~56.2.16`.
- Java/`JAVA_HOME` availability and Android native tests remain unverified in this review run.
