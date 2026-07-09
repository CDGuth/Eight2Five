# Eight2Five Monorepo

Expo-based React Native monorepo for tracking marching band performers through trilateration via stationary BLE and UWB beacons.

## Architecture & Boundaries
- **`apps/mobile`**: Main React Native application used on the field.
- **`apps/testbed`**: Sandbox app to validate localization algorithms (MFASA, path-loss models) and new features independent of the main app.
- **`packages/mobile`** (`@eight2five/mobile`): Shared mobile logic provider. Includes localization (Kalman filter, MFASA optimizer), hooks, utils, and mobile dependency surface shared by the Expo apps.
- **`packages/ui`** (`@eight2five/ui`): Shared gluestack-ui v5 component package consumed by Expo apps. Keep generated UI components and shared presentation primitives here rather than duplicating app-local UI code.
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
- Command: `npm install <package> --workspace @eight2five/mobile`

## Development & Verification
Run from the root of the repository:
- **`npm run validate`**: Runs type-checking, linting, syncpack lint, testing, and Expo checks across all workspaces. Use this as your primary verification gate.
- **`npm run syncpack:lint`**: Checks dependency version consistency across workspace manifests.
- **`npm run syncpack:fix`**: Applies Syncpack's autofixes for dependency version consistency issues.
- **`npm run expo:doctor`**: Required after changing Expo config, SDKs, or native plugins.
- **`npm run expo:install-check`**: Required after any dependency updates to verify Expo compatibility.

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

### State-Changing Git Commands Require Approval

**Always ask the user for explicit approval before running any state-changing git commands**, including but not limited to: `git add`, `git commit`, `git merge`, `git rebase`, `git reset`, `git push`, `git revert`, `git cherry-pick`, and `git rm`. Read-only commands (`git status`, `git log`, `git diff`, `git branch`) do not require approval.

## Git Notes
- `.opencode/opencode.json` is set to `--skip-worktree` (local changes are ignored by git; the committed version is preserved). Do not try to commit changes to this file. If you need to modify it intentionally, run `git update-index --no-skip-worktree .opencode/opencode.json`, make your change, commit it, then re-apply `--skip-worktree`.
- Files under `.opencode/agents/` are also marked `--skip-worktree` so that per-developer agent customizations (model, variant, permissions) stay local and never accidentally get committed.
