#!/usr/bin/env node
/**
 * Migration drift guard (test-plan Risk #3).
 *
 * Compares local Supabase migration versions (from the filenames in
 * supabase/migrations/) against the versions actually APPLIED on the remote
 * project, and fails (exit 1) if any local migration has not been applied
 * remotely. This is the automated form of the manual "Drift check" ritual in
 * CLAUDE.md — a migration authored on disk but never pushed makes code pass
 * locally and fail only in production.
 *
 * Diff is by VERSION, never by count: file counts can match while the actual
 * versions differ, so a length comparison would miss real drift.
 *
 * Remote state comes from the Supabase CLI:
 *     supabase migration list --linked
 * The CI workflow runs `supabase link` first so `--linked` resolves. Override
 * the command with MIGRATION_LIST_CMD when testing locally.
 *
 * Run from wedding-planner/backend/:
 *     npm run migration:check
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "supabase", "migrations");
const VERSION_RE = /(\d{14})/;

/**
 * Extract `{ version, filename }` from `.sql` migration filenames. Non-`.sql`
 * entries and files without a 14-digit version prefix are ignored.
 */
function parseLocalVersions(filenames) {
  return filenames
    .filter((name) => name.endsWith(".sql"))
    .map((name) => {
      const match = name.match(VERSION_RE);
      return match ? { version: match[1], filename: name } : null;
    })
    .filter(Boolean);
}

function readLocalMigrations(dir = MIGRATIONS_DIR) {
  return parseLocalVersions(fs.readdirSync(dir));
}

/**
 * Parse `supabase migration list` table output. Columns are
 * `Local | Remote | Time (UTC)`; a migration counts as applied remotely when
 * its 14-digit version appears in the Remote (second) column. Returns a Set of
 * remote versions.
 */
function parseRemoteVersions(cliOutput) {
  const remote = new Set();
  for (const line of cliOutput.split("\n")) {
    if (!line.includes("|")) continue;
    const cols = line.split("|").map((col) => col.trim());
    if (cols.length < 2) continue;
    const match = cols[1].match(/^(\d{14})$/);
    if (match) remote.add(match[1]);
  }
  return remote;
}

/**
 * Local migrations whose version is absent from the remote set. Pure version
 * diff — never compares counts.
 */
function diffMigrations(localMigrations, remoteVersions) {
  const remote =
    remoteVersions instanceof Set ? remoteVersions : new Set(remoteVersions);
  return localMigrations.filter((mig) => !remote.has(mig.version));
}

function formatMissing(missing) {
  return missing.map((mig) => `  - ${mig.version}  ${mig.filename}`).join("\n");
}

function getRemoteOutput() {
  const cmd = process.env.MIGRATION_LIST_CMD || "supabase migration list --linked";
  return execSync(cmd, { encoding: "utf8" });
}

function main() {
  const local = readLocalMigrations();
  if (local.length === 0) {
    console.error(`No local migrations found in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  let output;
  try {
    output = getRemoteOutput();
  } catch (err) {
    console.error("Failed to read remote migration state via Supabase CLI.");
    console.error(err.message || err);
    process.exit(1);
  }

  const remote = parseRemoteVersions(output);
  const missing = diffMigrations(local, remote);

  if (missing.length > 0) {
    console.error(
      `Migration drift: ${missing.length} local migration(s) not applied remotely:`,
    );
    console.error(formatMissing(missing));
    console.error(
      "\nPush them before deploying:  npx supabase db push  (from wedding-planner/backend/)",
    );
    process.exit(1);
  }

  console.log(
    `Migration drift check OK: all ${local.length} local migration(s) are applied remotely.`,
  );
}

module.exports = {
  parseLocalVersions,
  readLocalMigrations,
  parseRemoteVersions,
  diffMigrations,
  formatMissing,
};

if (require.main === module) {
  main();
}
