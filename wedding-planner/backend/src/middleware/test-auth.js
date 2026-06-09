const jwt = require("jsonwebtoken");

// Hermetic test-auth seam — used ONLY by e2e/integration so a running server
// can accept a locally-signed token instead of contacting the live JWKS.
// Defense-in-depth against ever authenticating in production:
//   1. `isTestAuthEnabled()` requires BOTH the explicit flag AND a
//      non-production NODE_ENV before the seam ever verifies a token.
//   2. `assertTestAuthConfigSafe()` is called at server boot and THROWS if the
//      flag is set under production — a misconfig crashes loudly instead of
//      silently opening an auth bypass.
// The token is HS256-signed with AUTH_TEST_SECRET (shared with the e2e SSO
// stub); the live RS256/JWKS path in jwks-auth.js is untouched when the seam
// is off.

function isTestAuthEnabled() {
  return process.env.AUTH_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
}

function assertTestAuthConfigSafe() {
  if (process.env.AUTH_TEST_MODE === "1" && process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_TEST_MODE is enabled under NODE_ENV=production. " +
        "The test-auth seam must never run in production. Refusing to boot.",
    );
  }
}

function testSecret() {
  return process.env.AUTH_TEST_SECRET || "wedding-planner-e2e-test-secret";
}

// Verify a locally-signed token and return the SSO-shaped payload. Throws the
// same jsonwebtoken errors (TokenExpiredError / JsonWebTokenError) the live
// path keys off, so the caller maps them to 401 identically.
function verifyTestToken(token) {
  return jwt.verify(token, testSecret(), { algorithms: ["HS256"] });
}

module.exports = {
  assertTestAuthConfigSafe,
  isTestAuthEnabled,
  verifyTestToken,
};
