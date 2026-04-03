#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  VALIDATION_REPORT_RELATIVE_PATH,
  getRepositoryRoot,
  parseArgs,
} = require("./agent-commit-utils.cjs");

function runCommand(command, cwd) {
  const start = Date.now();
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: "inherit",
  });
  const durationMs = Date.now() - start;

  return {
    command,
    success: result.status === 0,
    durationMs,
    exitCode: result.status,
  };
}

function getCommandPlan(fix, full) {
  const lintCommand = fix ? "npm run lint:fix" : "npm run lint";
  const commands = ["npm run type-check", lintCommand, "npm run test"];

  if (full) {
    commands.push("npm run --workspace apps/mobile expo:doctor");
    commands.push("npm run --workspace apps/testbed expo:doctor");
    commands.push("npm run --workspace apps/mobile expo:install-check");
    commands.push("npm run --workspace apps/testbed expo:install-check");
  }

  return commands;
}

function writeValidationReport(repoRoot, commands, success) {
  const reportPath = path.join(repoRoot, VALIDATION_REPORT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        success,
        commands,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = getRepositoryRoot();
  const fix = args.fix === true;
  const full = args.mode ? String(args.mode) !== "core" : true;

  const planned = getCommandPlan(fix, full);
  const results = [];

  for (const command of planned) {
    const result = runCommand(command, repoRoot);
    results.push(result);

    if (!result.success) {
      writeValidationReport(repoRoot, results, false);
      process.exitCode = 1;
      return;
    }
  }

  writeValidationReport(repoRoot, results, true);
}

run();
