---
name: testbed-style-guide
description: Architecture, routing, simulation UX, and quality standards for apps/testbed mini-app development.
---

# Eight2Five Testbed Style Guide

This skill defines the implementation standards for files under `apps/testbed`.
Use this skill as the primary reference for:
- Adding or refactoring mini test applications
- Updating route structure in Expo Router
- Evolving simulation controls and result analysis UI
- Writing and maintaining tests for testbed behavior

## 1. Route and Mini-App Architecture

### 1.1 Use grouped routes for mini-apps
- Place mini-app routes under grouped segments (for example `app/(subapps)/...`).
- Keep home/discovery at `app/index.tsx`.
- Give each mini-app its own route file and optional nested layout for complex flows.

### 1.2 Keep route metadata centralized
- Maintain a metadata registry in `src/subapps/index.ts`.
- Registry entries should describe the route (`href`), title, description, and optional badge.
- Do not store React component references in the registry for navigation.

### 1.3 Navigation rules
- Use `router.push` / `router.replace` / `router.back` from `expo-router`.
- Avoid custom in-memory route switching with `useState` for top-level navigation.
- Avoid callback-prop back button orchestration (`onSetSubBack` style patterns).
- Use stack headers for primary navigation; in-screen buttons can be used for workflow actions.

## 2. Screen Composition

### 2.1 Preferred file layout
- Keep each mini-app screen focused and small.
- Move orchestration/state into hooks under `hooks/`.
- Keep reusable UI controls in `components/`.

### 2.2 View-state boundaries
- Use route state for navigation state (which page/view is open).
- Use component state only for local interaction state (expanded sections, selection index, etc.).
- For long-running simulations, keep execution state in dedicated hooks.

### 2.3 Backward compatibility
- Preserve existing behavior of controls and analytics when refactoring structure.
- If a metric changes, update labels and documentation in the same change.

## 3. Simulation UX Standards

### 3.1 Source mode support
- Simulation features must support explicit source mode selection:
  - `BLE RSSI`
  - `UWB Distance`
  - `Hybrid`
- Show source mode in results and exports.

### 3.2 Parameter controls
- Group controls by concern:
  - Field/anchors
  - Algorithm/optimizer
  - Noise model
  - Source-specific settings
- Use concise labels with units (`m`, `ms`, `Hz`, `dBm`).
- Disable controls while runs are active when changing them could invalidate the run.

### 3.3 Readability and feedback
- Every long-running action must expose progress.
- Every run mode must provide clear success/failure feedback.
- Keep logs copyable and structured for post-run analysis.

## 4. Data and Typing Standards

### 4.1 Use explicit interfaces
- Define UI and run result contracts in `types.ts` files.
- Favor discriminated unions for source-specific result payloads.
- Avoid `any` for public interfaces and hook return values.

### 4.2 Source-aware result schema
- Include source mode and measurement kind metadata in run results.
- Keep analyzer outputs source-comparable (same metrics where possible).

### 4.3 Shared model integration
- Reuse shared localization/provider types from `@eight2five/shared`.
- Add adapters in testbed when needed instead of mutating shared production interfaces unless broadly useful.

## 5. Performance and Responsiveness

### 5.1 UI responsiveness
- Avoid blocking the UI thread in test execution loops.
- Yield between runs in batch/sweep mode.
- Keep visualization updates bounded during active simulation.

### 5.2 Render behavior
- Memoize expensive derived values.
- Keep re-renders localized to changed panels or visual layers.

## 6. Testing Standards

### 6.1 Required tests for behavior changes
- Add/adjust tests for:
  - Route accessibility for new/updated mini-app pages
  - Source mode switching behavior
  - Run result schema updates
  - Regression-prone controls (sweep parameters, cancellation, back navigation)

### 6.2 Test style
- Prefer deterministic tests (seed random behavior where feasible).
- Test user-visible outcomes, not implementation details.
- Keep fixtures small and readable.

## 7. Documentation and PR Hygiene

### 7.1 README updates
- Update `apps/testbed/README.md` when route structure or developer workflows change.
- Document new mini-app addition steps when introducing route conventions.

### 7.2 Commit hygiene
- Use Conventional Commits with `testbed` scope for testbed-only changes.
- Split router migration, simulation logic changes, and docs updates into separate commits when practical.

## 8. Do / Don’t

### Do
- Do route mini-apps using Expo Router grouped routes.
- Do keep mini-app metadata in one registry.
- Do expose source mode clearly in UI and results.
- Do keep hooks focused and typed.

### Don’t
- Don’t reintroduce app-level custom navigation state machines.
- Don’t bury source mode in hidden settings.
- Don’t couple visualization rendering to transport-specific logic.
- Don’t ship simulation model changes without tests and updated docs.
