#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const {
  archiveEntry,
  composeCommitMessage,
  ensureFileWithTemplate,
  findEntry,
  getDefaultPaths,
  getRepositoryRoot,
  getWorkingNoteTemplate,
  inferValidationBullets,
  parseArgs,
  parseEntries,
} = require("./agent-commit-utils.cjs");

function commitWithMessage(message) {
  const tempPath = path.join(os.tmpdir(), `agent-commit-msg-${Date.now()}.txt`);
  fs.writeFileSync(tempPath, message, "utf8");

  const result = spawnSync("git", ["commit", "--file", tempPath], {
    stdio: "inherit",
  });

  fs.rmSync(tempPath, { force: true });

  if (result.status !== 0) {
    throw new Error("git commit failed");
  }
}

function stageFile(filePath) {
  const result = spawnSync("git", ["add", "--", filePath], {
    stdio: "inherit",
  });

  if (result.status !== 0) throw new Error(`failed to stage ${filePath}`);
}

function stageAllChanges() {
  const result = spawnSync("git", ["add", "-A"], {
    stdio: "inherit",
  });

  if (result.status !== 0) throw new Error("failed to stage repository changes");
}

function snapshotFile(filePath) {
  return {
    exists: fs.existsSync(filePath),
    content: fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf8")
      : null,
  };
}

function restoreFile(filePath, snapshot) {
  if (!snapshot.exists) {
    fs.rmSync(filePath, { force: true });
    return;
  }

  fs.writeFileSync(filePath, snapshot.content, "utf8");
}

function getHeadCommitHash() {
  return execSync("git rev-parse HEAD", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = getRepositoryRoot();
  const paths = getDefaultPaths(repoRoot);

  ensureFileWithTemplate(paths.workingNotePath, getWorkingNoteTemplate());

  const workingContent = fs.readFileSync(paths.workingNotePath, "utf8");
  const entries = parseEntries(workingContent);
  const entry = findEntry(entries, args.id ? String(args.id) : undefined);

  if (!entry) {
    process.stderr.write("no pending entry found in local commit notes\n");
    process.exitCode = 1;
    return;
  }

  const inferredValidation = inferValidationBullets(paths.validationReportPath);
  const commitMessage = composeCommitMessage(entry, inferredValidation);

  if (args["dry-run"] === true) {
    process.stdout.write(commitMessage);
    return;
  }

  if (args["no-archive"] === true) {
    stageAllChanges();
    commitWithMessage(commitMessage);
    const commitHash = getHeadCommitHash();
    process.stdout.write(`committed entry ${entry.id} without archiving\n`);
    process.stdout.write(`commit hash: ${commitHash}\n`);
    return;
  }

  const workingSnapshot = snapshotFile(paths.workingNotePath);
  const archiveSnapshot = snapshotFile(paths.archivePath);

  const archiveResult = archiveEntry({
    workingNotePath: paths.workingNotePath,
    archivePath: paths.archivePath,
    entryId: entry.id,
  });

  stageAllChanges();

  try {
    commitWithMessage(commitMessage);
  } catch (error) {
    restoreFile(paths.workingNotePath, workingSnapshot);
    restoreFile(paths.archivePath, archiveSnapshot);

    const resetResult = spawnSync("git", ["reset"], {
      stdio: "inherit",
    });

    if (resetResult.status !== 0) {
      process.stderr.write(`warning: failed to unstage ${paths.archivePath}\n`);
    }

    throw error;
  }

  const commitHash = getHeadCommitHash();
  process.stdout.write(`committed entry ${entry.id} as ${commitHash}\n`);
  process.stdout.write(`${archiveResult.reason} entry ${entry.id}\n`);
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
