# GitHub Copilot Instructions

**ALWAYS** use your tools to implement user requests, **IF AND ONLY IF** the user requests you to make a change. **DO NOT** tell the user to make manual changes unless that is necessary. **ALWAYS PLAN YOUR CHANGES WITH A LIST OF ACTIONABLE STEPS BEFORE MAKING THEM.**

When requirements are ambiguous or underspecified, use the `vscode_askQuestions` tool to ask concise clarifying questions instead of making assumptions, including while operating in agent mode.

You are an expert in TypeScript, React Native, Expo, and Mobile UI development.

## Project Description

This repository contains an Expo-based React Native application (iOS and Android) for tracking marching band performers on a rectangular practice field. The platform is evolving from a BLE-only ingestion path toward a source-agnostic localization architecture where location measurements can come from multiple providers.

Today, BLE advertisements from fixed KBeaconPro beacons are ingested through `modules/expo-kbeaconpro`. The repository now also includes `modules/expo-pans-ble-api`, a new Expo module surface for BLE-accessible DWM1001/PANS workflows. In this phase, PANS support is BLE-only and intentionally excludes UART/SPI transports.

The app parses BLE packets into higher-level beacon state using shared utilities (for example `beaconParser`). A shared hook, `useBeaconScanner`, now supports source injection through provider abstractions, allowing side-by-side migration between KBeacon and PANS BLE sources without forcing downstream UI rewrites.

The localization subsystem in `src/localization` smooths RSSI values with a 1D Kalman filter and uses propagation models to compare measured and predicted signal values. Indoors it applies a log-normal path-loss model; outdoors it uses a two-ray ground-reflection model derived from `.github/docs/BLE-Based Outdoor Localization With Two-Ray Ground-Reflection Model Using Optimization Algorithms/`. The optimizer searches for a 2D position that minimizes RMSE across active anchors.

To solve this optimization problem, the project currently implements a memetic Firefly Algorithm with Simulated Annealing (MFASA) in `src/localization/algorithms/MFASA.ts`. MFASA maintains a population of candidate positions ("fireflies"), moves them toward better solutions based on relative brightness (lower RMSE), and applies simulated annealing-style random perturbations with a cooling schedule to escape local minima. The optimizer is time-sliced (using small per-step time budgets) so that iterative computation does not block the React Native UI thread. Future algorithms (e.g., GA, PSO, or simpler multilateration) can be added behind the same optimizer interface.

## Commit Format (Conventional Commits)

All commits in this repository **MUST** follow Conventional Commits.

- **Required format**: `<type>(<optional-scope>): <subject>`
- **Allowed types**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`, `ci`, `revert`
- **Subject rules**:
    - use imperative mood (e.g., "add", "refactor", "migrate")
    - start lowercase
    - no trailing period
    - keep concise and specific
- **Breaking changes**:
    - append `!` after type/scope (`feat(testbed)!: ...`) **or**
    - include `BREAKING CHANGE:` footer with migration details

### Scope conventions for this monorepo

- `mobile` for `apps/mobile`
- `testbed` for `apps/testbed`
- `shared` for `packages/shared`
- `kbeacon` for `modules/expo-kbeaconpro`
- `pans-ble` for `modules/expo-pans-ble-api`
- `repo` for root tooling/config changes

### Examples

- `feat(testbed): migrate subapp navigation to expo-router grouped routes`
- `fix(shared): stabilize distance observation weighting in localization engine`
- `refactor(mobile): move home flow into file-based router layout`
- `docs(repo): add testbed style skill usage guidelines`
- `feat(testbed)!: replace legacy state navigator with route-driven navigation`

### Multi-scope and mixed changes

- Prefer splitting unrelated changes into separate commits per scope.
- If a single change legitimately spans multiple areas, use the dominant scope and explain secondary impacts in the commit body.

### Required commit body structure

Every commit **MUST** include a detailed body with bulleted items describing each change. Do not use a one-line or unstructured body for non-trivial commits.

Use this required structure for **every** commit message body:

```text
<type>(<scope>): <subject>

- <imperative verb> <specific details about a change, reference files if necessary>
- <imperative verb> <specific details about another change, reference files if necessary>

Impact:
- <user-visible or developer-visible outcome>
- <risk, migration note, or compatibility note>
- <etc.>

Validation:
- <description of tests run or manual validation>
```

### Example Commit Body

```text
feat(shared): stabilize distance observation weighting in localization engine

- normalize distance weights in `src/localization/optimizer.ts` to prevent outlier dominance
- increase Kalman filter process noise in `src/localization/filters/Kalman.ts` for faster responsiveness
- add unit tests for weighted RMSE calculation in `src/localization/__tests__/RMSE.test.ts`

Impact:
- more robust position estimates in high-interference environments
- reduced "ghosting" effects when performers change direction rapidly

Validation:
- ran `npm run test` in `packages/shared` - all tests passing
- manual verification in `apps/testbed` using the `Simulation` mini-app with 10% noise injection
```

Formatting rules for commit bodies:

- Use a bulleted list of changes starting with imperative verbs.
- Include specific details and file references where helpful for context.
- Add `Impact:` and `Validation:` sections for all commits except trivial docs-only typo fixes.
- If no tests are run, explicitly state that in `Validation:` with a short justification.
- Keep language concise, factual, and traceable to the actual diff.

## Agent Commit Script Workflow

Use script-based entry points for agent-driven commits.

- Working local notes file (local-only, ignored): `.github/.commit-notes.local.md`
- Validation cache used for commit body inference (local-only, ignored): `.github/.agent-validation-last.json`
- Repository archive file (tracked): `.github/commit-notes-archive.md`

Required script entry points:

- `npm run agent:commit:note -- --type <type> --scope <scope> --subject "<subject>" --change "<item>" --impact "<item>" --validation "<item>"`
    - Append one pending commit-note entry.
- `npm run agent:commit:from-note`
    - Read the next pending note entry, generate commit message in required Conventional Commit format, run `git commit`, and archive/reset consumed note entry.
- `npm run agent:commit:archive -- --id <entry-id> --commit <hash>`
    - Manually archive/reset a specific entry when needed.

Recommended end-to-end sequence:

1. Add a pending note entry with `agent:commit:note`.
2. Run validation (`npm run agent:validate -- --mode core` at minimum; use full mode when Expo checks are required).
3. Run `npm run agent:commit:from-note` to generate the Conventional Commit message and execute `git commit`.
4. Confirm the consumed entry is removed from `.github/.commit-notes.local.md` and archived in `.github/commit-notes-archive.md`.

Script behavior details:

- `agent:commit:note`
    - Creates one pending entry with metadata and bullet content for changes/impact/validation.
    - `--change`, `--impact`, and `--validation` can be repeated to form multi-bullet sections.
- `agent:commit:from-note`
    - Uses the next pending entry (or a specific one via `--id`).
    - Builds the commit message in the required format.
    - Incorporates validation bullets inferred from `.github/.agent-validation-last.json` when available.
    - Performs archive/reset automatically after successful commit unless `--no-archive` is used.
- `agent:commit:archive`
    - Manual archive/reconciliation command for edge cases; not part of normal flow.

Agent behavior requirements:

- Always append a commit-note entry while implementing changes.
- Always run validation before `agent:commit:from-note` unless explicitly waived.
- Before committing, read from `.github/.commit-notes.local.md` via `agent:commit:from-note`.
- After successful commit, ensure entry is archived to `.github/commit-notes-archive.md` and removed from the local pending file.
- On commit failure, do not remove pending note entries.

## Validation Command Policy

Do not use `precommit-check`; it has been removed.

Use `.github/skills/validation-guide/SKILL.md` as the source of truth for validation command selection and agent-oriented script flow.

Primary root entry points:

- `npm run validate:core`
    - Runs `npm run type-check`, `npm run lint`, and `npm run test`.
- `npm run validate`
    - Runs `validate:core` plus Expo checks for mobile and testbed (`npx expo-doctor`, `npx expo install --check`).
- `npm run agent:validate`
    - Agent-oriented validation entry point that records executed checks for commit Validation section inference.

Agent validation behavior notes:

- `npm run agent:validate -- --mode core`
    - Runs only type-check, lint (or lint:fix), and tests.
    - Use as the default minimum for non-Expo-impacting changes.
- `npm run agent:validate`
    - Runs core checks plus Expo doctor/install checks for mobile and testbed.
    - Use when Expo config/plugins/native settings/dependencies are affected.
- `npm run agent:validate -- --fix`
    - Uses `lint:fix` during the scripted run.
- Validation report output:
    - `.github/.agent-validation-last.json` stores executed commands and pass/fail state for commit message inference.

Detailed command usage rules:

- `npm run type-check`
    - Required when changing TypeScript source, interfaces/contracts, exports, parser/model logic, shared hooks/types, or TypeScript config.
- `npm run lint`
    - Required for all code/config/script changes before commit and pull request.
- `npm run lint:fix`
    - Use first when lint issues are auto-fixable; rerun `npm run lint` after fixes.
- `npm run test`
    - Required for behavior changes, bug fixes, refactors, localization algorithm updates, parser/filter adjustments, and module API changes.
- `npx expo-doctor`
    - Required after Expo SDK/plugin/config/native project changes, and after dependency changes affecting Expo apps.
- `npx expo install --check`
    - Required after `package.json`/lockfile dependency updates in Expo apps to verify Expo compatibility.

## Validation Guide Skill

Use the validation guide skill for validation and script workflow decisions:

- `.github/skills/validation-guide/SKILL.md`

Keep guidance in this file and the skill synchronized when validation workflow standards change.

## Testbed Style Guide Skill

When working inside `apps/testbed`, use the dedicated testbed style guide skill at `.github/skills/testbed-style-guide/SKILL.md`.

- Treat that skill as the first source of truth for testbed route conventions, mini-app architecture, simulation UX, and test patterns.
- Keep guidance in this file and the skill synchronized when standards change.

## Monorepo Structure

This project is organized as a monorepo to unify logic across mobile applications and native modules.

-   **`apps/`**: Contains the primary user-facing applications.
    -   **`apps/mobile/`**: The main Expo-based React Native application used by performers on the field. Handles real-time scanning, UI, and state management.
    -   **`apps/testbed/`**: A sandbox application for developers to validate localization algorithms (like MFASA), visualize simulated runs, and tweak propagation constants without running the full field app.
-   **`packages/`**: Contains shared logic and reusable components.
    -   **`packages/shared/`**: The core logic provider for the entire repository.
        -   `src/localization/`: Implementation of Kalman filters, path-loss models (log-normal, two-ray ground reflection), and optimization algorithms (MFASA).
        -   `src/hooks/`: React hooks for shared functionality, such as beacon scanning subscriptions.
        -   `src/types/`: Centralized TypeScript interfaces used by both apps and shared logic.
        -   `src/utils/`: Generic helpers for identity parsing, coordinates, and math.
-   **`modules/`**: Contains custom Expo modules.
    -   **`modules/expo-kbeaconpro/`**: A native module wrapping the KBeaconPro SDKs (Android/Swift) to provide a unified BLE scanning interface to the JavaScript layer.
    -   **`modules/expo-pans-ble-api/`**: A native module exposing BLE-accessible DWM1001/PANS interactions through a unified TypeScript API contract.

## Monorepo Dependency Policy

To maintain stability and prevent version conflicts (e.g., duplicate React instances or conflicting native modules):

-   **Shared Installation**: If a dependency is used by more than one application or exists in `packages/shared`, it **MUST** be installed in `packages/shared`'s `package.json`.
-   **Justification**: Centralizing dependencies in `packages/shared` ensures all sub-apps use the same versions, reducing bundle size and preventing hard-to-debug "multiple versions of X" runtime errors.
-   **Command**: Use `npm install <package-name> --workspace @eight2five/shared` to add a new shared dependency.

Downstream consumers (screens or components) should treat `useBeaconScanner` as the source-agnostic integration point. The hook returns the raw per-MAC map for diagnostics, filtered measurements consumed by localization, and the latest estimated position. Copilot suggestions should preserve this flow (provider source → parser/adapter → filter + model → MFASA optimizer → UI), avoid transport-specific coupling in UI code, and keep side-by-side migration support unless explicitly removed.

  Code Style and Structure
  - Write concise, technical TypeScript code with accurate examples.
  - Use functional and declarative programming patterns; avoid classes.
  - Prefer iteration and modularization over code duplication.
  - Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
  - Structure files: exported component, subcomponents, helpers, static content, types.
  - Follow Expo's official documentation for setting up and configuring your projects: https://docs.expo.dev/

  Naming Conventions
  - Use lowercase with dashes for directories (e.g., components/auth-wizard).
  - Favor named exports for components.

  Documentation
  - Create detailed comments for all logic, especially complex sections.
  - Use JSDoc style for function and component documentation.

  TypeScript Usage
  - Use TypeScript for all code; prefer interfaces over types.
  - Avoid enums; use maps instead.
  - Use functional components with TypeScript interfaces.
  - Use strict mode in TypeScript for better type safety.

  Vector Icons
  - ALWAYS use `@expo/vector-icons` for icons.
  - Use MaterialIcons for a consistent, professional design language.
  - Centralizing icons in `packages/shared` ensures all sub-apps and modules use the same versions and icon set, reducing bundle overhead and maintenance.

  Syntax and Formatting
  - Use the "function" keyword for pure functions.
  - Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements.
  - Use declarative JSX.
  - Use Prettier for consistent code formatting.

  UI and Styling
  - Most UI and styling will come from generated locofy components, so follow patterns found in those components.
  - Use Expo's built-in components for common UI patterns and layouts.
  - Implement responsive design with Flexbox and Expo's useWindowDimensions for screen size adjustments.
  - Use styled-components or Tailwind CSS for component styling.
  - Implement dark mode support using Expo's useColorScheme.
  - Ensure high accessibility (a11y) standards using ARIA roles and native accessibility props.
  - Leverage react-native-reanimated and react-native-gesture-handler for performant animations and gestures.

  Safe Area Management
  - Use SafeAreaProvider from react-native-safe-area-context to manage safe areas globally in your app.
  - Wrap top-level components with SafeAreaView to handle notches, status bars, and other screen insets on both iOS and Android.
  - Use SafeAreaScrollView for scrollable content to ensure it respects safe area boundaries.
  - Avoid hardcoding padding or margins for safe areas; rely on SafeAreaView and context hooks.

  Performance Optimization
  - Minimize the use of useState and useEffect; prefer context and reducers for state management.
  - Use Expo's AppLoading and SplashScreen for optimized app startup experience.
  - Optimize images: use WebP format where supported, include size data, implement lazy loading with expo-image.
  - Implement code splitting and lazy loading for non-critical components with React's Suspense and dynamic imports.
  - Profile and monitor performance using React Native's built-in tools and Expo's debugging features.
  - Avoid unnecessary re-renders by memoizing components and using useMemo and useCallback hooks appropriately.

  Navigation
  - Use react-navigation for routing and navigation; follow its best practices for stack, tab, and drawer navigators.
  - Leverage deep linking and universal links for better user engagement and navigation flow.
  - Use dynamic routes with expo-router for better navigation handling.

  State Management
  - Use React Context and useReducer for managing global state.
  - Leverage react-query for data fetching and caching; avoid excessive API calls.
  - For complex state management, consider using Zustand or Redux Toolkit.
  - Handle URL search parameters using libraries like expo-linking.

  Error Handling and Validation
  - Use Zod for runtime validation and error handling.
  - Implement proper error logging using Sentry or a similar service.
  - Prioritize error handling and edge cases:
    - Handle errors at the beginning of functions.
    - Use early returns for error conditions to avoid deeply nested if statements.
    - Avoid unnecessary else statements; use if-return pattern instead.
    - Implement global error boundaries to catch and handle unexpected errors.
  - Use expo-error-reporter for logging and reporting errors in production.

  Testing
  - Write unit tests using Jest and React Native Testing Library.
  - Implement integration tests for critical user flows using Detox.
  - Use Expo's testing tools for running tests in different environments.
  - Consider snapshot testing for components to ensure UI consistency.

  Security
  - Sanitize user inputs to prevent XSS attacks.
  - Use react-native-encrypted-storage for secure storage of sensitive data.
  - Ensure secure communication with APIs using HTTPS and proper authentication.
  - Use Expo's Security guidelines to protect your app: https://docs.expo.dev/guides/security/

  Internationalization (i18n)
  - Use react-native-i18n or expo-localization for internationalization and localization.
  - Support multiple languages and RTL layouts.
  - Ensure text scaling and font adjustments for accessibility.

  Key Conventions
  1. Rely on Expo's managed workflow for streamlined development and deployment.
  2. Prioritize Mobile Web Vitals (Load Time, Jank, and Responsiveness).
  3. Use expo-constants for managing environment variables and configuration.
  4. Use expo-permissions to handle device permissions gracefully.
  5. Implement expo-updates for over-the-air (OTA) updates.
  6. Follow Expo's best practices for app deployment and publishing: https://docs.expo.dev/distribution/introduction/
  7. Ensure compatibility with iOS and Android by testing extensively on both platforms.

  API Documentation
  - Use Expo's official documentation for setting up and configuring your projects: https://docs.expo.dev/

  Refer to Expo's documentation for detailed information on Views, Blueprints, and Extensions for best practices.
    

# Overview

This file provides guidance for GitHub Copilot on how to effectively use the documentation within this project to generate accurate and relevant code suggestions.

## Documentation Interaction Protocol

Your primary role is to act as an intelligent interface to the project's documentation. The primary sources of truth are Context7 and the documentation located in the `.github/docs/` directory. This instruction file is **not** the documentation itself; it is a guide on how to find and use the documentation.

### Core Rule: Consult the Source of Truth

Always prioritize the content within Context7 and the documentation files in `.github/docs/` over any summary in this file. These are the "sources of truth." If information is still missing, you should then search the web.

### Step-by-Step Protocol for Using Documentation

1.  **Identify the Relevant Technology:** Based on the user's request, determine which framework or SDK is needed (e.g., Expo, KBeacon Android, KBeacon iOS).

2.  **Locate the Documentation File:** Use the "File Location" specified in the relevant section below to identify the correct documentation file.

3.  **Attempt a Targeted Search First:**
    *   Formulate a precise search query based on the user's request (e.g., a specific class name like `KBeaconsMgr`, a method like `startScanning()`, or a concept like `push notifications`).
    *   Use your search tools to find occurrences of this query within the relevant documentation file. The "Key Topics" listed for each section can help you identify relevant keywords for your search.

4.  **Analyze Search Results:**
    *   If the search yields specific, relevant sections, use that information directly to fulfill the user's request.

5.  **Fallback to a Full Read if Necessary:**
    *   If the targeted search is inconclusive, does not provide enough context, or fails to find the required information, you **must** read the entire content of the relevant documentation file. This ensures you have the complete context.

6.  **Synthesize and Apply:** Use the information gathered from the documentation to generate code, answer questions, or perform the requested task.

7.  **Search the Web:** If the documentation and Context7 do not provide the necessary information, use your web search tools to find up-to-date information from official sources.

## Agent Usage Protocol

Use the `runSubagent` tool to delegate complex, multi-step tasks. This ensures the main agent remains focused on user interaction and high-level orchestration. **Subagents must only be used for well-defined sub-tasks with clear objectives and boundaries, not for open-ended or ambiguous requests.**

### Roles and Responsibilities

-   **Main Agent:**
    -   Handles all direct user communication.
    -   Defines specific, actionable tasks for subagents.
    -   Performs targeted file edits (e.g., `replace_string_in_file`, `create_file`) for specific, well-defined changes.
    -   Coordinates the overall workflow and applies final fixes.
    -   Manages the `todo` list and project state.
-   **Subagent (`runSubagent`):**
    -   **Research:** Performs deep, multi-step research across the workspace or documentation for a specific, well-defined query.
    -   **Implementation:** Drafts complex logic or multi-file changes for a specific feature or refactor defined by the main agent.

### Examples of When to Use a Subagent

-   **Research:** Use when you need to "find all usages of X and determine how they handle Y" or "understand the interaction between module A and B across 10+ files."
-   **Implementation:** Use for "implementing a new localization algorithm based on a research paper" or "refactoring the entire state management layer." The subagent should return a detailed report or code snippets for the main agent to apply.

---

## 1. Expo Documentation

**File Location:** `.github/docs/expo/llms-txt-documentation.md`

### Overview

This document contains a comprehensive guide to the Expo framework. It is the primary source of truth for any Expo-related tasks. You are to access the links (as in access the page contents of the documentation links) listed within the documentation file for any questions or code generation requests related to Expo.

### Key Topics for Search

Use these keywords as a starting point for searching within the documentation file:

-   **Project Lifecycle:** `Create a project`, `Development builds`, `EAS Build`, `EAS Submit`, `EAS Update`
-   **Core APIs & SDK Modules:** `expo-router`, `expo-av`, `expo-sensors`, `expo-camera`, `expo-file-system`, `expo-image-picker`, `expo-notifications`, `expo-auth-session`
-   **Configuration:** `app.json`, `app.config.js`, `eas.json`

### How to Find Information

-   **For new features:** Search the doc for relevant modules like `Camera`, `Location`, or `Notifications`.
-   **For routing:** Search for `Expo Router`, `routes`, `layouts`, or `navigation`.
-   **For building/deployment:** Search for `EAS Build`, `EAS Submit`, or `EAS Update`.

---

## 2. KBeaconPro Android SDK
**Location:** `.github/docs/KBeaconPro Android SDK/github-kkmhogen-kbeaconprodemo_android-an-android-based-demo-for-connecting-kbeaconpro-devices.md`
**Description:** Instructions for scanning, connecting, and configuring KBeaconPro devices on Android.

---

## 3. KBeaconPro iOS SDK
**Location:** `.github/docs/KBeaconPro iOS SDK/github-kkmhogen-kbeaconprodemo_ios.md`
**Description:** Instructions for scanning, connecting, and configuring KBeaconPro devices on iOS using Swift.

---

## 4. Outdoor Localization (Two-Ray Model)
**Location:** `.github/docs/BLE-Based Outdoor Localization With Two-Ray Ground-Reflection Model Using Optimization Algorithms/llms-txt-documentation.md`
**Description:** Technical documentation for outdoor localization using the Two-Ray Ground-Reflection model and optimization algorithms.
