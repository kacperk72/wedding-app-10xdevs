const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { before, describe, it } = require("node:test");
const jwt = require("jsonwebtoken");

// The integration harness (http-app.js) swaps jwks-auth out for a mock, so the
// real 401 authentication paths are never exercised there. This unit test
// covers them hermetically: we stub `jwks-rsa` so the middleware's signing-key
// lookup returns a locally-generated public key, and sign tokens with the
// matching private key — no network to the live JWKS endpoint.

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const PUBLIC_PEM = publicKey.export({ type: "spki", format: "pem" });
const PRIVATE_PEM = privateKey.export({ type: "pkcs8", format: "pem" });

let requireSsoAuth;

before(() => {
  // Replace jwks-rsa before the middleware loads it. The middleware calls
  // jwksClient({...}) once at module load and later client.getSigningKey(kid, cb).
  const JWKS_RSA_PATH = require.resolve("jwks-rsa");
  require.cache[JWKS_RSA_PATH] = {
    id: JWKS_RSA_PATH,
    filename: JWKS_RSA_PATH,
    loaded: true,
    exports: () => ({
      getSigningKey: (_kid, cb) => cb(null, { getPublicKey: () => PUBLIC_PEM }),
    }),
  };

  process.env.JWKS_URL = "https://sso.test/.well-known/jwks.json";
  const AUTH_PATH = require.resolve("../src/middleware/jwks-auth");
  delete require.cache[AUTH_PATH];
  requireSsoAuth = require(AUTH_PATH);
});

// Drive the middleware with a minimal req/res/next and resolve when it either
// sends a response or calls next().
function run(authHeader) {
  return new Promise((resolve) => {
    const req = {
      header: (name) => (name === "Authorization" ? authHeader : undefined),
    };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve({ outcome: "response", req, res: this });
        return this;
      },
    };
    const next = () => resolve({ outcome: "next", req, res });
    requireSsoAuth(req, res, next);
  });
}

function signValid(claims = {}, options = {}) {
  return jwt.sign(
    { userId: "user-x", email: "x@example.com", firstName: "Ewa", lastName: "Lis", ...claims },
    PRIVATE_PEM,
    { algorithm: "RS256", keyid: "test-kid", expiresIn: "1h", ...options },
  );
}

describe("requireSsoAuth (JWKS authentication)", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const { outcome, res } = await run(undefined);
    assert.equal(outcome, "response");
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Access denied. No token provided.");
  });

  it("returns 401 for an expired token", async () => {
    const expired = signValid({}, { expiresIn: -10 });
    const { outcome, res } = await run(`Bearer ${expired}`);
    assert.equal(outcome, "response");
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Token expired.");
  });

  it("returns 401 for a malformed / invalid token", async () => {
    const { outcome, res } = await run("Bearer not-a-real-jwt");
    assert.equal(outcome, "response");
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Invalid token.");
  });

  it("calls next() and attaches req.user for a valid token", async () => {
    const token = signValid();
    const { outcome, req } = await run(`Bearer ${token}`);
    assert.equal(outcome, "next");
    assert.equal(req.user.userId, "user-x");
    assert.equal(req.user.email, "x@example.com");
  });
});
