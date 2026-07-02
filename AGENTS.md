# Eight2Five Monorepo

Expo-based React Native monorepo for tracking marching band performers through trilateration via stationary BLE and UWB beacons.

## Architecture & Boundaries
- **`apps/mobile`**: Main React Native application used on the field.
- **`apps/testbed`**: Sandbox app to validate localization algorithms (MFASA, path-loss models) and new features independent of the main app.
- **`packages/mobile`** (`@eight2five/mobile`): Shared mobile logic provider. Includes localization (Kalman filter, MFASA optimizer), hooks, utils, and mobile dependency surface shared by the Expo apps.
- **`modules/expo-kbeaconpro`**: Native Expo module wrapping KBeaconPro SDKs (BLE).
- **`modules/expo-pans-ble-api`**: Native Expo module for DWM1001/PANS interaction (UWB).

## Core Concepts
- **`useBeaconScanner`**: The source-agnostic integration hook. **UI components must consume this**, not transport-specific providers.
- Data Flow: `Provider Source → Parser/Adapter → Filter & Model → MFASA Optimizer → UI`. Keep side-by-side KBeacon BLE and PANS UWB support unless told otherwise.

## UI System
- **gluestack-ui v5** is the active UI system for shared app components. Some local agent skills may still reference gluestack-ui v4; they can be useful for general patterns, but always verify setup, APIs, styling-engine guidance, and generated component conventions against the official v5 documentation before making gluestack changes.
- For future visualization work, prefer **React Native Skia** for complex custom 2D graphics and **Victory Native** for charts. If either dependency is added for shared mobile/testbed use, install it in `packages/mobile` per the shared mobile dependency policy and verify Expo compatibility.

## Dependency Management
- **Shared Mobile Dependency Policy**: If a mobile package is used by both Expo apps, or belongs in shared mobile logic, install it in `packages/mobile` to keep future web/backend apps isolated from mobile dependencies.
- Command: `pnpm --filter @eight2five/mobile add <package>`

## Development & Verification
Run from the root of the repository:
- **`pnpm validate`**: Runs linting, type-checking, testing, and Expo checks across all workspaces. Use this as your primary verification gate.
- **`pnpm validate:expo:doctor`**: Required after changing Expo config, SDKs, or native plugins.
- **`pnpm validate:expo:install-check`**: Required after any dependency updates to verify Expo compatibility.

## Context7
Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service - even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer - your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

1. Always start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question). Use version-specific IDs when the user mentions a version
3. `query-docs` with the selected library ID and the user's full question (not single words)
4. Answer using the fetched docs

## Documentation
- Detailed outdoor BLE localization math (Two-Ray Model) paper is at `.github/docs/BLE-Based Outdoor Localization With Two-Ray Ground-Reflection Model Using Optimization Algorithms/llms-txt-documentation.md`.

## Git Notes
- `.opencode/opencode.json` is set to `--skip-worktree` (local changes are ignored by git; the committed version is preserved). Do not try to commit changes to this file. If you need to modify it intentionally, run `git update-index --no-skip-worktree .opencode/opencode.json`, make your change, commit it, then re-apply `--skip-worktree`.
