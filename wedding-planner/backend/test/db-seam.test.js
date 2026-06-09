const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

// Verifies the hermetic DB seam (config/database.js DB_TEST_MODE). Each test
// file runs in its own process under `node --test`, so the env mutations here
// do not leak to other suites.

const DB_PATH = require.resolve("../src/config/database");

function loadDatabaseWith(env) {
  const saved = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    process.env[key] = env[key];
  }
  delete require.cache[DB_PATH];
  try {
    return require(DB_PATH);
  } finally {
    for (const key of Object.keys(env)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("DB test seam (DB_TEST_MODE)", () => {
  it("serves the in-memory seed when enabled (no Supabase env needed)", async () => {
    const { supabase, isReachable } = loadDatabaseWith({ DB_TEST_MODE: "1" });

    assert.equal(await isReachable(), true);

    const { data: wedding } = await supabase
      .from("weddings")
      .select("*")
      .eq("id", "wedding-1")
      .maybeSingle();
    assert.equal(wedding.partner_a_name, "Ania");
    assert.equal(wedding.created_by_user_id, "user-a");

    const { data: members } = await supabase
      .from("wedding_members")
      .select("*")
      .eq("wedding_id", "wedding-1");
    const userIds = members.map((m) => m.user_id).sort();
    assert.deepEqual(userIds, ["user-a", "user-b"]);
  });

  it("refuses to load when DB_TEST_MODE is set under NODE_ENV=production", () => {
    assert.throws(
      () => loadDatabaseWith({ DB_TEST_MODE: "1", NODE_ENV: "production" }),
      /production/i,
    );
  });
});
