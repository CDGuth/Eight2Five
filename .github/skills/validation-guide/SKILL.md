---
name: validation-guide
description: Validation policy and agent-oriented script workflow for repo checks and commit-note driven commits.
---

# Eight2Five Validation Guide

This skill defines the source of truth for validation and agent-oriented script usage.
Use this skill when:
- Running or selecting validation commands for a change.
- Recording validation for commit notes.
- Creating commits with the agent note/commit/archive scripts.

## 1. Core Validation Commands

- `npm run type-check`
- `npm run lint`
- `npm run lint:fix`
- `npm run test`
- `npx expo-doctor`
- `npx expo install --check`

## 2. Root Entry Points

- `npm run validate:core`
  - Runs `type-check`, `lint`, and `test` across workspaces.
- `npm run validate`
  - Runs `validate:core` plus Expo checks for mobile and testbed.
- `npm run agent:validate`
  - Agent entry point that runs scripted validation and writes a validation report.
- `npm run agent:validate -- --fix`
  - Uses `lint:fix` during scripted validation.
- `npm run agent:validate -- --mode core`
  - Runs scripted validation without Expo checks.

## 3. Command Requirement Matrix

### 3.1 Type and lint checks
- Run `npm run type-check` when touching TypeScript source, contracts, exports, interfaces, parser/model logic, hooks/types, or tsconfig/build config.
- Run `npm run lint` for all code/config/script changes before commit and PR.
- Run `npm run lint:fix` first when lint is auto-fixable, then rerun `npm run lint`.

### 3.2 Tests
- Run `npm run test` for behavior changes, bug fixes, refactors, localization algorithm updates, parser/filter changes, and module API changes.

### 3.3 Expo checks
- Run `npx expo-doctor` after Expo SDK/app config/plugin/native/dependency-tree changes in Expo apps.
- Run `npx expo install --check` after dependency edits affecting Expo packages.

## 4. Native Module Folder Commands

Both module folders support direct checks:

### 4.1 modules/expo-kbeaconpro
- `npm run lint`
- `npm run lint:fix`
- `npm run type-check`
- `npm run test`

### 4.2 modules/expo-pans-ble-api
- `npm run lint`
- `npm run lint:fix`
- `npm run type-check`
- `npm run test`

## 5. Agent-Oriented Script Workflow

### 5.1 Validation workflow for agents
- Preferred validation command:
  - `npm run agent:validate`
- Common variants:
  - `npm run agent:validate -- --mode core`
  - `npm run agent:validate -- --fix`
- Behavior:
  - Stops on first failed command.
  - Writes report to `.github/.agent-validation-last.json`.
  - Report is used by commit message generation to infer validation bullets.

### 5.2 Commit-note workflow for agents

Use this order unless explicitly instructed otherwise:

1. Create/update pending note entry.
   - `npm run agent:commit:note -- --type <type> --scope <scope> --subject "<subject>" --change "<item>" --impact "<item>" --validation "<item>"`
2. Run validation (`agent:validate` or explicit commands as required).
3. Generate commit from next pending note.
   - `npm run agent:commit:from-note`
4. Let auto-archive happen after successful commit.

### 5.3 Manual archive usage
- `npm run agent:commit:archive -- --id <entry-id> --commit <hash>`
- Use only when a specific pending entry needs manual reconciliation.

### 5.4 Failure semantics
- If `agent:commit:from-note` fails, pending notes must remain in `.github/.commit-notes.local.md`.
- Do not delete or clear pending notes on commit failure.

## 6. Commit Notes Files

- Local working notes (ignored): `.github/.commit-notes.local.md`
- Local validation cache (ignored): `.github/.agent-validation-last.json`
- Repo-tracked archive: `.github/commit-notes-archive.md`
