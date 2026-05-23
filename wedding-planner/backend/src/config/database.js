const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill them in.",
  );
}

// Service-role client: bypasses RLS. Authorization happens upstream
// in middleware/jwks-auth.js (SSO JWT verification). Never expose this
// client or its key to the frontend.
const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function isReachable() {
  try {
    const { error } = await supabase
      .from("_supabase_health_probe")
      .select("*", { count: "exact", head: true });
    // PGRST205 = table not found; the round-trip itself proved
    // the connection works. Anything else (network, auth, 5xx) is real.
    if (error && error.code !== "PGRST205") return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = { supabase, isReachable };
