const { supabase } = require("../config/database");

function getSsoUserId(payload) {
  return payload.userId || payload.sub || payload.id;
}

async function ensureUserFromSsoPayload(payload) {
  const ssoUserId = getSsoUserId(payload);
  if (!ssoUserId) {
    const error = new Error("SSO token does not include a user id");
    error.status = 401;
    throw error;
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        sso_user_id: String(ssoUserId),
        email: payload.email,
        // SSO emits camelCase today; snake_case keeps this tolerant of issuer drift.
        first_name: payload.firstName || payload.first_name || null,
        last_name: payload.lastName || payload.last_name || null,
        email_verified: true,
      },
      { onConflict: "sso_user_id" },
    )
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      error.status = 409;
    }
    throw error;
  }
  return data;
}

module.exports = { ensureUserFromSsoPayload, getSsoUserId };
