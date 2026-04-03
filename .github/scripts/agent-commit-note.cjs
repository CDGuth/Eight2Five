#!/usr/bin/env node

const {
  appendEntryToWorkingNote,
  getDefaultPaths,
  getRepositoryRoot,
  parseArgs,
  toArray,
} = require("./agent-commit-utils.cjs");

function createEntryFromArgs(args) {
  const now = new Date();
  const compactTimestamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6);

  return {
    id: String(args.id || `${compactTimestamp}-${suffix}`),
    status: String(args.status || "pending"),
    type: String(args.type || "chore"),
    scope: String(args.scope || "repo"),
    subject: String(args.subject || "describe change"),
    breaking: String(args.breaking || "false").toLowerCase() === "true",
    createdAt: now.toISOString(),
    changes: toArray(args.change),
    impact: toArray(args.impact),
    validation: toArray(args.validation),
  };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = getRepositoryRoot();
  const paths = getDefaultPaths(repoRoot);

  const entry = createEntryFromArgs(args);
  appendEntryToWorkingNote(paths.workingNotePath, entry);

  process.stdout.write(`added commit note entry ${entry.id}\n`);
  process.stdout.write(`working note: ${paths.workingNotePath}\n`);
}

run();
