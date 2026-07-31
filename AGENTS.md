# Eight2Five Monorepo

Expo-based React Native monorepo for managing DWM1001/PANS networks and displaying UWB-derived performer positions.

## Architecture & Boundaries
- **`apps/mobile`**: Main React Native application used on the field.
- **`apps/testbed`**: DWM1001/PANS network-manager and hardware-validation app.
- **`packages/mobile`** (`@eight2five/mobile`): Shared PANS manager services, persistence, position streaming, map components, utilities, and mobile dependency surface.
- **`packages/ui`** (`@eight2five/ui`): Shared gluestack-ui v5 component package consumed by Expo apps. Keep generated UI components and shared presentation primitives here rather than duplicating app-local UI code.
- **`modules/expo-pans-ble-api`**: Native Expo module for DWM1001/PANS BLE GATT discovery, configuration, and location-frame notifications.

## Position Data Boundary
- BLE discovers and configures PANS nodes and transports PANS location frames. BLE discovery RSSI is device telemetry, not a positioning input.
- DWM1001/PANS firmware performs UWB ranging and position calculation internally; the app consumes the resulting positions and anchor ranges.
- Data flow: `PANS BLE discovery/configuration → PANS location notifications → DWM1001 internal UWB position/ranges → PansPositionStreamService → map/logging UI`.

## UI System
- **gluestack-ui v5** is the active UI system for shared app components. Some local agent skills may still reference gluestack-ui v4; they can be useful for general patterns, but always verify setup, APIs, styling-engine guidance, and generated component conventions against the official v5 documentation before making gluestack changes.
- For future visualization work, prefer **React Native Skia** for complex custom 2D graphics and **Victory Native** for charts. If either dependency is added for shared mobile/testbed use, install it in `packages/mobile` per the shared mobile dependency policy and verify Expo compatibility.

## Dependency Management
- **Shared Mobile Dependency Policy**: If a mobile package is used by both Expo apps, or belongs in shared mobile logic, install it in `packages/mobile` to keep future web/backend apps isolated from mobile dependencies.
- Command: `npm install <package> --workspace @eight2five/mobile`

## Root Project Scripts
Run these commands from the repository root. The root scripts are the preferred interface because they target the correct app or delegate consistently across npm workspaces.

### Start the Expo development servers

- **`npm run start:mobile`**: Starts the Expo development server for `apps/mobile`. Use this for ordinary JavaScript and TypeScript development in the main field app.
- **`npm run start:mobile:mcp`**: Starts `apps/mobile` with Expo's MCP server enabled. Use this when an MCP client or coding agent needs access to the running Expo project.
- **`npm run start:testbed`**: Starts the Expo development server for `apps/testbed`.
- **`npm run start:testbed:mcp`**: Starts `apps/testbed` with Expo's MCP server enabled.

Starting Metro does not compile a new native development client. Rebuild the relevant app after changing native module code, config plugins, native app configuration, or development-client dependencies.

### Build and run native apps locally

- **`npm run android:mobile`**: Runs `expo run:android` for `apps/mobile`. Requires the Android SDK, a working Java/JDK and Gradle environment, and an emulator or connected Android device.
- **`npm run android:testbed`**: Runs `expo run:android` for `apps/testbed` with the same Android prerequisites.
- **`npm run ios:mobile`**: Runs `expo run:ios` for `apps/mobile`. Requires macOS, Xcode, CocoaPods, and an iOS simulator or connected device.
- **`npm run ios:testbed`**: Runs `expo run:ios` for `apps/testbed` with the same iOS prerequisites.

These commands may generate or update native project files before compiling and installing the selected app.

### Static analysis and dependency consistency

- **`npm run type-check`**: Runs every workspace's TypeScript compiler in no-emit mode. Use it after changing types, public interfaces, navigation contracts, or shared packages.
- **`npm run lint`**: Runs each workspace's configured linter without modifying files. This is the lint command used by CI.
- **`npm run lint:fix`**: Runs each workspace's lint autofix command where one exists. Review the resulting diff before committing because autofix can rewrite multiple files.
- **`npm run syncpack:lint`**: Checks dependency-version consistency and the repository's Syncpack manifest rules.
- **`npm run syncpack:fix`**: Applies Syncpack's manifest fixes. Review all modified package manifests and the lockfile, then rerun `npm run syncpack:lint` and the Expo dependency checks.

### JavaScript and native tests

- **`npm run test:jest`**: Runs workspace JavaScript and TypeScript Jest suites only. It does not run Swift or Android native tests.
- **`npm run test:native:expo-pans-ble-api:ios`**: Runs the iOS native tests for `modules/expo-pans-ble-api`. Requires a functioning Swift toolchain and its system-library dependencies.
- **`npm run test:native:expo-pans-ble-api:android`**: Runs the Android native tests for `modules/expo-pans-ble-api`. Requires Java/JDK and the Android/Gradle environment expected by the module.
- **`npm run test:native:expo-pans-ble-api`**: Runs the PANS BLE API iOS native tests first and the Android native tests second. The Android command is not reached if the iOS command fails.
- **`npm run test:native`**: Repository-level alias for `npm run test:native:expo-pans-ble-api`. Use this when the repository has only the current PANS native test target.
- **`npm run test`**: Runs `test:jest` followed by `test:native`. Use it for complete test coverage when both native toolchains are available. On unsupported hosts, run `test:jest` and the native target that the host can support, and report the omitted target explicitly.

### Expo compatibility checks

- **`npm run expo:doctor`**: Runs Expo Doctor in every workspace that defines an `expo:doctor` script. Use it after changing Expo configuration, SDK versions, native plugins, or native dependencies.
- **`npm run expo:install-check`**: Runs `expo install --check` in every applicable workspace and reports packages that do not match the installed Expo SDK's recommended versions. Use it after dependency changes and before committing Expo upgrades.
- **`npm run expo:install-fix`**: Runs `expo install --fix` in every applicable workspace. This can change package manifests and the lockfile; inspect the changes, then run Syncpack, type checking, tests, Expo Doctor, and Expo install check again.

### Complete verification

- **`npm run validate`**: Primary repository verification gate. It runs, in order: `type-check`, `lint`, `syncpack:lint`, `test`, `expo:doctor`, and `expo:install-check`. Because `test` includes both native platforms sequentially, `validate` requires working Swift and Java/Android environments to complete. When the host cannot provide one of those toolchains, run every supported component separately and document the exact environmental blocker rather than treating the partial run as a complete validation.

## Context7
Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service - even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer - your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

1. Always start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question). Use version-specific IDs when the user mentions a version
3. `query-docs` with the selected library ID and the user's full question (not single words)
4. Answer using the fetched docs

## Git Workflow

This project follows a disciplined git workflow. The rules below are mandatory.

### Feature Branch Workflow

1. **Develop on personal feature branches.** All work happens on branches branched off `main`. Commit freely during development — noisy commits, temporary debug code, and experimentation are fine at this stage.
2. **Interactive rebase before merging.** Before merging a feature branch into `main`, perform an interactive rebase (`git rebase -i main`) to:
   - **Squash** noisy, incremental, or "wip" commits into logical units
   - **Reword** commit messages so each commit describes *what* and *why* clearly
   - **Reorder** commits for a logical narrative
   - **Remove** temporary or debugging commits entirely
   - The goal is a branch history that is clean, self-explanatory, and easy to review.
3. **Merge into main with `--merge` via PR.** After the rebase is complete and the branch history is clean, open a pull request and merge using `gh pr merge --merge` (creates a merge commit, preserving individual commit history). All changes must go through a PR — **no direct or force pushes to `main` are allowed**. **Never merge with `--squash` or `--rebase`** — those flatten or discard history and are only acceptable on personal feature branches or non-shared branches that will never be merged into `main`.
4. **Clean up local and remote branches after merging.** After the PR has been merged, delete the local feature branch (`git branch -d <branch-name>`) and the remote feature branch (`git push origin --delete <branch-name>` or via `gh pr merge --delete-branch`). This prevents stale branches from accumulating locally and on the remote.
5. **Never rewrite history on shared branches.** Interactive rebasing is acceptable and encouraged for personal feature branches, but `main` (and any other long-lived shared branch) must **never** have its history rewritten.

### Commit and Pull Request Conventions

- When creating a commit, load the `conventional-commit` skill to produce properly structured commit messages.
- When creating a pull request, load the `create-pr` skill to follow the project's PR conventions.

## Git Notes
- `.opencode/opencode.json` is set to `--skip-worktree` (local changes are ignored by git; the committed version is preserved). Do not try to commit changes to this file. If you need to modify it intentionally, run `git update-index --no-skip-worktree .opencode/opencode.json`, make your change, commit it, then re-apply `--skip-worktree`.
- Files under `.opencode/agents/` are also marked `--skip-worktree` so that per-developer agent customizations (model, variant, permissions) stay local and never accidentally get committed.
