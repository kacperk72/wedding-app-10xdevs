const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseLocalVersions,
  parseRemoteVersions,
  diffMigrations,
} = require("../scripts/check-migration-drift");

test("parseLocalVersions extracts versions from .sql files and ignores others", () => {
  const result = parseLocalVersions([
    "20260523233000_m1_schema_and_seed.sql",
    "20260601120000_wedding_timeline.sql",
    "README.md",
    "not-a-migration.txt",
  ]);
  assert.deepEqual(result, [
    {
      version: "20260523233000",
      filename: "20260523233000_m1_schema_and_seed.sql",
    },
    {
      version: "20260601120000",
      filename: "20260601120000_wedding_timeline.sql",
    },
  ]);
});

test("parseRemoteVersions reads applied versions from the Remote column", () => {
  const cliOutput = [
    "   Local          | Remote         | Time (UTC)          ",
    "  ----------------|----------------|---------------------",
    "   20260523233000 | 20260523233000 | 2026-05-23 23:30:00 ",
    "   20260601120000 |                | 2026-06-01 12:00:00 ",
  ].join("\n");
  const remote = parseRemoteVersions(cliOutput);
  assert.ok(remote.has("20260523233000"));
  // local-only row (empty Remote column) must NOT count as applied
  assert.ok(!remote.has("20260601120000"));
});

test("diffMigrations returns local versions missing from remote", () => {
  const local = [
    { version: "20260523233000", filename: "a.sql" },
    { version: "20260601120000", filename: "b.sql" },
  ];
  const missing = diffMigrations(local, new Set(["20260523233000"]));
  assert.deepEqual(missing, [{ version: "20260601120000", filename: "b.sql" }]);
});

test("diffMigrations flags drift even when counts are equal (no count shortcut)", () => {
  // Equal sizes, but versions differ: b.sql is on disk, a different version is
  // applied remotely. A naive count comparison would wrongly report "in sync".
  const local = [
    { version: "20260523233000", filename: "a.sql" },
    { version: "20260601120000", filename: "b.sql" },
  ];
  const remote = new Set(["20260523233000", "20260609185950"]);
  const missing = diffMigrations(local, remote);
  assert.deepEqual(missing, [{ version: "20260601120000", filename: "b.sql" }]);
});

test("diffMigrations returns empty when every local version is applied remotely", () => {
  const local = [{ version: "20260523233000", filename: "a.sql" }];
  const remote = new Set(["20260523233000", "20260609185950"]);
  assert.deepEqual(diffMigrations(local, remote), []);
});
