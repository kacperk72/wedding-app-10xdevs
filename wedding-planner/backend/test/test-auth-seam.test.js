const assert = require("node:assert/strict");
const { before, describe, it } = require("node:test");
const jwt = require("jsonwebtoken");

// Verifies the hermetic test-auth seam (middleware/test-auth.js) and its
// wiring into requireSsoAuth. Hermetic — no live JWKS. Each test file runs in
// its own process under `node --test`, so the env mutations here do not leak
// to other suites.

const TEST_SECRET = "seam-test-secret";

let requireSsoAuth;
let testAuth;

before(() => {
  process.env.AUTH_TEST_MODE = "1";
  process.env.AUTH_TEST_SECRET = TEST_SECRET;
  process.env.JWKS_URL = "https://sso.test/.well-known/jwks.json";
  // NODE_ENV stays "test" (set by the runner) — seam is active here.

  const TEST_AUTH_PATH = require.resolve("../src/middleware/test-auth");
  delete require.cache[TEST_AUTH_PATH];
  testAuth = require(TEST_AUTH_PATH);

  const AUTH_PATH = require.resolve("../src/middleware/jwks-auth");
  delete require.cache[AUTH_PATH];
  requireSsoAuth = require(AUTH_PATH);
});

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

describe("test-auth seam (requireSsoAuth with AUTH_TEST_MODE)", () => {
  it("accepts a valid locally-signed token and attaches req.user", async () => {
    const token = jwt.sign(
      { userId: "user-b", email: "b@example.com", firstName: "Bartek", lastName: "Test" },
      TEST_SECRET,
      { algorithm: "HS256" },
    );
    const { outcome, req } = await run(`Bearer ${token}`);
    assert.equal(outcome, "next");
    assert.equal(req.user.userId, "user-b");
    assert.equal(req.user.email, "b@example.com");
  });

  it("rejects a wrong-signature token with 401", async () => {
    const bad = jwt.sign({ userId: "user-b" }, "not-the-real-secret", { algorithm: "HS256" });
    const { outcome, res } = await run(`Bearer ${bad}`);
    assert.equal(outcome, "response");
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Invalid token.");
  });
});

describe("test-auth boot guard (assertTestAuthConfigSafe)", () => {
  it("throws when AUTH_TEST_MODE is set under NODE_ENV=production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production"; // AUTH_TEST_MODE already "1"
    try {
      assert.throws(() => testAuth.assertTestAuthConfigSafe(), /production/i);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("does not throw when AUTH_TEST_MODE is set under a non-production env", () => {
    assert.doesNotThrow(() => testAuth.assertTestAuthConfigSafe());
  });
});
