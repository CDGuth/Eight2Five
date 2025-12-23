# GitHub Copilot Instructions

**ALWAYS** use your tools to implement user requests, **IF AND ONLY IF** the user requests you to make a change. **DO NOT** tell the user to make manual changes unless that is necessary. **ALWAYS PLAN YOUR CHANGES WITH A LIST OF ACTIONABLE STEPS BEFORE MAKING THEM.**

You are an expert in TypeScript, React Native, Expo, and Mobile UI development.

## Project Description

This repository contains an Expo-based React Native application (iOS and Android) for tracking marching band performers on a rectangular practice field. Each performer carries a mobile device that receives Bluetooth Low Energy (BLE) advertisements from fixed KBeaconPro beacons positioned around or within the field. The native module in `modules/expo-kbeaconpro` exposes scanning APIs and delivers raw advertisement payloads (MAC address, RSSI, and manufacturer data) into the JavaScript layer.

The app parses those advertisements into higher-level beacon state using utilities in `src/utils` (for example `beaconParser`), extracting identity information (including Tx power) and field-relative anchor coordinates (encoded as X/Y percentages and Z height in centimeters). A custom hook, `useBeaconScanner`, subscribes to the native scanner, maintains an in-memory map of visible beacons, and feeds each update into a localization pipeline.

The localization subsystem in `src/localization` smooths noisy RSSI values with a 1D Kalman filter, then uses a propagation model to relate distance and received power. Indoors it applies a standard log-normal path-loss model; outdoors it uses the two-ray ground-reflection model derived from the BLE-based outdoor localization paper in `.github/docs/BLE-Based Outdoor Localization With Two-Ray Ground-Reflection Model Using Optimization Algorithms/`. Rather than converting RSSI to distance directly, the system formulates localization as an optimization problem: it searches for the 2D position that minimizes the root-mean-square error between measured RSSI at each anchor and the RSSI predicted by the chosen propagation model.

To solve this optimization problem, the project currently implements a memetic Firefly Algorithm with Simulated Annealing (MFASA) in `src/localization/algorithms/MFASA.ts`. MFASA maintains a population of candidate positions ("fireflies"), moves them toward better solutions based on relative brightness (lower RMSE), and applies simulated annealing-style random perturbations with a cooling schedule to escape local minima. The optimizer is time-sliced (using small per-step time budgets) so that iterative computation does not block the React Native UI thread. Future algorithms (e.g., GA, PSO, or simpler multilateration) can be added behind the same optimizer interface.

Downstream consumers (screens or components) typically use `useBeaconScanner` to obtain three views of state: the raw per-MAC beacon map for diagnostics, the filtered beacon measurements used by the localization engine, and the latest estimated performer position in meters relative to the field. Copilot suggestions should preserve this flow (native scanner → parser → Kalman filter + propagation model → MFASA optimizer → UI) and avoid breaking the public surface of the native module or hooks without a clear reason.

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
