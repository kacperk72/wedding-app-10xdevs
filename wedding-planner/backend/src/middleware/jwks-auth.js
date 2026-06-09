const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const { isTestAuthEnabled, verifyTestToken } = require("./test-auth");
require("dotenv").config();

// One JWKS client per process. Pulls keys from the SSO at JWKS_URL,
// caches up to 5 keys for 1h, with 10/min request limit as a hedge
// against pathological retry loops.
const client = jwksClient({
  jwksUri: process.env.JWKS_URL,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 60 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

const verifyOptions = { algorithms: ["RS256"] };
if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;

// Express middleware. Expects "Authorization: Bearer <token>".
// Attaches req.user with the SSO payload shape:
//   { userId, email, firstName, lastName, role, isActive, apps }
function requireSsoAuth(req, res, next) {
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ error: "Access denied. No token provided." });
  }

  // Hermetic e2e/integration seam — only active when AUTH_TEST_MODE is set AND
  // NODE_ENV !== "production" (see middleware/test-auth.js). Verifies a
  // locally-signed token without touching the live JWKS. The live path below
  // is unchanged when the seam is off.
  if (isTestAuthEnabled()) {
    try {
      req.user = verifyTestToken(token);
      return next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired." });
      }
      return res.status(401).json({ error: "Invalid token." });
    }
  }

  jwt.verify(token, getSigningKey, verifyOptions, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired." });
      }
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "Invalid token." });
      }
      console.error("JWKS auth error:", err);
      return res.status(401).json({ error: "Authentication failed." });
    }
    req.user = decoded;
    next();
  });
}

module.exports = requireSsoAuth;
