const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const WORKING_NOTE_RELATIVE_PATH = ".github/.commit-notes.local.md";
const ARCHIVE_RELATIVE_PATH = ".github/commit-notes-archive.md";
const VALIDATION_REPORT_RELATIVE_PATH = ".github/.agent-validation-last.json";

function getRepositoryRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
}

function getDefaultPaths(repoRoot) {
  return {
    workingNotePath: path.join(repoRoot, WORKING_NOTE_RELATIVE_PATH),
    archivePath: path.join(repoRoot, ARCHIVE_RELATIVE_PATH),
    validationReportPath: path.join(repoRoot, VALIDATION_REPORT_RELATIVE_PATH),
  };
}

function getWorkingNoteTemplate() {
  return [
    "# Agent Commit Notes (local-only)",
    "This file is generated for local agent-assisted commits.",
    "Do not commit this file.",
    "",
  ].join("\n");
}

function getArchiveTemplate() {
  return [
    "# Agent Commit Notes Archive",
    "This file is repository-tracked and stores consumed commit note entries.",
    "",
  ].join("\n");
}

function ensureFileWithTemplate(filePath, template) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, template, "utf8");
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  if (!content.trim()) fs.writeFileSync(filePath, template, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];
    const hasValue = Boolean(next) && !next.startsWith("--");
    const value = hasValue ? next : true;

    if (hasValue) i += 1;

    if (parsed[key] === undefined) {
      parsed[key] = value;
      continue;
    }

    if (Array.isArray(parsed[key])) {
      parsed[key].push(value);
      continue;
    }

    parsed[key] = [parsed[key], value];
  }

  return parsed;
}

function toArray(value) {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function extractSectionText(block, title) {
  const marker = `### ${title}\n`;
  const start = block.indexOf(marker);
  if (start === -1) return "";

  const rest = block.slice(start + marker.length);
  let end = rest.length;

  const markers = ["\n### ", "\n## Entry ", "\n---\n"];
  for (const candidate of markers) {
    const idx = rest.indexOf(candidate);
    if (idx >= 0 && idx < end) end = idx;
  }

  return rest.slice(0, end).trim();
}

function extractBulletList(block, title) {
  const text = extractSectionText(block, title);
  if (!text) return [];

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function parseEntryMetadata(block) {
  const firstHeadingIndex = block.indexOf("\n### ");
  const metadataArea =
    firstHeadingIndex === -1 ? block : block.slice(0, firstHeadingIndex);
  const lines = metadataArea.split(/\r?\n/).slice(1);
  const metadata = {};

  for (const line of lines) {
    const match = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (!match) continue;
    metadata[match[1].toLowerCase()] = match[2].trim();
  }

  return metadata;
}

function parseEntries(content) {
  const entries = [];
  let start = content.indexOf("## Entry ");

  while (start !== -1) {
    const nextBoundary = content.indexOf("\n## Entry ", start + 1);
    const end = nextBoundary === -1 ? content.length : nextBoundary + 1;
    const raw = content.slice(start, end);
    const block = raw.trimEnd();
    const header = block.split(/\r?\n/, 1)[0] || "";
    const idMatch = header.match(/^## Entry\s+(.+)$/);
    const metadata = parseEntryMetadata(block);

    entries.push({
      id: idMatch ? idMatch[1].trim() : "",
      status: metadata.status || "pending",
      type: metadata.type || "chore",
      scope: metadata.scope || "repo",
      subject: metadata.subject || "describe change",
      breaking: String(metadata.breaking || "false").toLowerCase() === "true",
      createdAt: metadata.created_at || "",
      changes: extractBulletList(block, "Changes"),
      impact: extractBulletList(block, "Impact"),
      validation: extractBulletList(block, "Validation"),
      raw,
      index: start,
      endIndex: end,
    });

    start = nextBoundary === -1 ? -1 : nextBoundary + 1;
  }

  return entries;
}

function formatBullets(items, fallback) {
  const cleaned = (items || []).map((item) => item.trim()).filter(Boolean);
  const output = cleaned.length > 0 ? cleaned : [fallback];
  return output.map((item) => `- ${item}`).join("\n");
}

function buildEntryBlock(entry) {
  return [
    `## Entry ${entry.id}`,
    `status: ${entry.status || "pending"}`,
    `type: ${entry.type || "chore"}`,
    `scope: ${entry.scope || "repo"}`,
    `subject: ${entry.subject || "describe change"}`,
    `breaking: ${entry.breaking ? "true" : "false"}`,
    `created_at: ${entry.createdAt || new Date().toISOString()}`,
    "",
    "### Changes",
    formatBullets(
      entry.changes,
      "document pending changes from implementation work",
    ),
    "",
    "### Impact",
    formatBullets(
      entry.impact,
      "describe user-visible or developer-visible impact",
    ),
    "",
    "### Validation",
    formatBullets(
      entry.validation,
      "capture executed validation commands and results",
    ),
    "",
    "---",
    "",
  ].join("\n");
}

function buildArchiveRecord(entry, commitHash, archivedAt) {
  const commitRef = commitHash ? String(commitHash) : "included-in-same-commit";

  return [
    `## Archived Entry ${entry.id}`,
    `archived_at: ${archivedAt}`,
    `entry_id: ${entry.id}`,
    `commit: ${commitRef}`,
    "status: committed",
    `type: ${entry.type || "chore"}`,
    `scope: ${entry.scope || "repo"}`,
    `subject: ${entry.subject || "describe change"}`,
    `breaking: ${entry.breaking ? "true" : "false"}`,
    "",
    "### Changes",
    formatBullets(entry.changes, "documented changes were unavailable"),
    "",
    "### Impact",
    formatBullets(entry.impact, "impact details were not captured"),
    "",
    "### Validation",
    formatBullets(entry.validation, "validation details were not captured"),
    "",
    "---",
    "",
  ].join("\n");
}

function removeEntryFromWorkingNote(content, entry) {
  const next = `${content.slice(0, entry.index)}${content.slice(
    entry.endIndex,
  )}`.replace(/\n{3,}/g, "\n\n");

  if (!next.includes("## Entry ")) return getWorkingNoteTemplate();
  if (next.endsWith("\n")) return next;
  return `${next}\n`;
}

function inferValidationBullets(validationReportPath) {
  if (!fs.existsSync(validationReportPath)) return [];

  try {
    const report = JSON.parse(fs.readFileSync(validationReportPath, "utf8"));
    const commands = Array.isArray(report.commands) ? report.commands : [];
    const successful = commands.filter(
      (cmd) => cmd && cmd.success && cmd.command,
    );
    if (successful.length === 0) return [];

    return successful.map((cmd) => `ran ${cmd.command} (pass)`);
  } catch {
    return [];
  }
}

function composeCommitMessage(entry, inferredValidation) {
  const scopePart =
    entry.scope && entry.scope !== "none" ? `(${entry.scope})` : "";
  const breakingPart = entry.breaking ? "!" : "";
  const subject = `${entry.type || "chore"}${scopePart}${breakingPart}: ${
    entry.subject || "describe change"
  }`;

  const changesText = formatBullets(
    entry.changes,
    "document pending changes from implementation work",
  );
  const impactText = formatBullets(
    entry.impact,
    "describe user-visible or developer-visible impact",
  );
  const validationItems =
    entry.validation && entry.validation.length > 0
      ? entry.validation
      : inferredValidation && inferredValidation.length > 0
        ? inferredValidation
        : ["not run (no validation commands were captured for this commit)"];
  const validationText = formatBullets(
    validationItems,
    "not run (no validation commands were captured for this commit)",
  );

  return [
    subject,
    "",
    changesText,
    "",
    "Impact:",
    impactText,
    "",
    "Validation:",
    validationText,
    "",
  ].join("\n");
}

function findEntry(entries, id) {
  if (!id) return entries.find((entry) => entry.status === "pending") || null;
  return entries.find((entry) => entry.id === id) || null;
}

function appendEntryToWorkingNote(workingNotePath, entry) {
  ensureFileWithTemplate(workingNotePath, getWorkingNoteTemplate());

  const current = fs.readFileSync(workingNotePath, "utf8");
  const suffix = current.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(
    workingNotePath,
    `${current}${suffix}${buildEntryBlock(entry)}`,
    "utf8",
  );
}

function archiveEntry(options) {
  const { workingNotePath, archivePath, entryId, commitHash } = options;

  ensureFileWithTemplate(workingNotePath, getWorkingNoteTemplate());
  ensureFileWithTemplate(archivePath, getArchiveTemplate());

  const workingContent = fs.readFileSync(workingNotePath, "utf8");
  const entries = parseEntries(workingContent);
  const entry = findEntry(entries, entryId);
  if (!entry)
    return { archived: false, removed: false, reason: "no-pending-entry" };

  const archiveContent = fs.readFileSync(archivePath, "utf8");
  const duplicateSignature = `entry_id: ${entry.id}`;
  const isDuplicate = archiveContent.includes(duplicateSignature);

  if (!isDuplicate) {
    const suffix = archiveContent.endsWith("\n") ? "" : "\n";
    const record = buildArchiveRecord(
      entry,
      commitHash,
      new Date().toISOString(),
    );
    fs.writeFileSync(
      archivePath,
      `${archiveContent}${suffix}${record}`,
      "utf8",
    );
  }

  const nextWorking = removeEntryFromWorkingNote(workingContent, entry);
  fs.writeFileSync(workingNotePath, nextWorking, "utf8");

  return {
    archived: !isDuplicate,
    removed: true,
    reason: isDuplicate ? "already-archived" : "archived",
    entry,
  };
}

module.exports = {
  ARCHIVE_RELATIVE_PATH,
  VALIDATION_REPORT_RELATIVE_PATH,
  WORKING_NOTE_RELATIVE_PATH,
  appendEntryToWorkingNote,
  archiveEntry,
  composeCommitMessage,
  ensureFileWithTemplate,
  findEntry,
  getArchiveTemplate,
  getDefaultPaths,
  getRepositoryRoot,
  getWorkingNoteTemplate,
  inferValidationBullets,
  parseArgs,
  parseEntries,
  toArray,
};
