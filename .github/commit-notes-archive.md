# Commit Notes Archive
This file is repository-tracked and stores consumed commit note entries.

## Archived Entry 20260403013350-cofh
archived_at: 2026-04-03T02:40:29.474Z
entry_id: 20260403013350-cofh
commit: included-in-same-commit
status: committed
type: chore
scope: repo
subject: unify validation workflow docs and tsconfig migration
breaking: false

### Changes
- add repo-level validation entry points and agent-oriented commit/validation scripts under .github/scripts and package.json
- add validation-guide skill and align copilot-instructions workflow guidance with scripted validation and commit-note sequencing
- standardize README validation sections across root, apps, shared package, and native modules while removing agent command examples from README files
- rewrite Sources README and Swift stub header comments in a concise maintainer voice to reduce generated-sounding phrasing while preserving build/tooling guidance
- remove deprecated compilerOptions.baseUrl and update tsconfig path aliases to explicit relative targets
- add module-local tsconfig files for expo-kbeaconpro and expo-pans-ble-api to support workspace type-check execution
- update app icon asset layout and related app config/package wiring for mobile and testbed workspaces

### Impact
- establish a clearer and more consistent validation workflow for contributors across the monorepo
- improve readability and maintainability of Sources documentation for contributors using Swift LSP tooling
- prevent TypeScript deprecation and configuration errors while preserving @eight2five/shared path alias resolution
- improve agent reliability by requiring clarifying questions when requirements are ambiguous

### Validation
- ran npm run lint:fix
- ran npm run type-check (pass)
- ran npm run agent:validate -- --mode core (pass)
- not run: npm run validate (full Expo checks)

---
