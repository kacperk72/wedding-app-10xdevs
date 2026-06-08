const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

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
      .from("weddings")
      .select("id", { head: true })
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

module.exports = { supabase, isReachable };
