const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Hermetic e2e/local seam — mirrors AUTH_TEST_MODE (middleware/test-auth.js).
// When DB_TEST_MODE=1 AND NODE_ENV != production, a standalone `node
// src/server.js` serves an in-memory mock (seeded for the golden flow) instead
// of connecting to real Supabase, so e2e is networkless. The node:test harness
// (test/helpers/http-app.js) still swaps this module via require.cache for
// in-process tests; this seam covers the *running server* case e2e needs.
function isDbTestEnabled() {
  return process.env.DB_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
}

// Fail-closed: refuse to boot if the in-memory test DB is ever enabled in
// production. A misconfig crashes loudly instead of silently serving fake data.
if (process.env.DB_TEST_MODE === "1" && process.env.NODE_ENV === "production") {
  throw new Error(
    "DB_TEST_MODE is enabled under NODE_ENV=production. " +
      "The in-memory test DB must never run in production. Refusing to boot.",
  );
}

let supabase;
let isReachable;

if (isDbTestEnabled()) {
  // Lazy require keeps test-only code out of the production module graph.
  const { createMockSupabase } = require("../../test/helpers/mock-supabase");
  const { e2eSeed } = require("../../test/helpers/e2e-seed");
  const mock = createMockSupabase(e2eSeed());
  supabase = mock.supabase;
  isReachable = async () => true;
} else {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill them in.",
    );
  }

  // Service-role client: bypasses Supabase RLS. Authorization happens upstream
  // in middleware/jwks-auth.js (SSO JWT verification). Never expose this key
  // to the Angular bundle.
  supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  isReachable = async () => {
    try {
      const { error } = await supabase.from("weddings").select("id", { head: true }).limit(1);
      return !error;
    } catch {
      return false;
    }
  };
}

module.exports = { supabase, isReachable };
