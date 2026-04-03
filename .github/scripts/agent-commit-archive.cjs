#!/usr/bin/env node

const { execSync } = require("child_process");
const {
  archiveEntry,
  getDefaultPaths,
  getRepositoryRoot,
  parseArgs,
} = require("./agent-commit-utils.cjs");

function resolveCommitHash(argValue) {
  if (argValue) return String(argValue);
  return execSync("git rev-parse HEAD", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = getRepositoryRoot();
  const paths = getDefaultPaths(repoRoot);
  const commitHash = resolveCommitHash(args.commit);

  const result = archiveEntry({
    workingNotePath: paths.workingNotePath,
    archivePath: paths.archivePath,
    entryId: args.id ? String(args.id) : undefined,
    commitHash,
  });

  if (!result.removed && result.reason === "no-pending-entry") {
    process.stderr.write("no pending entry was found to archive\n");
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${result.reason} entry ${result.entry.id} for commit ${commitHash}\n`);
}

run();
