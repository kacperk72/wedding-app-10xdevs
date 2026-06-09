const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

// Risk #1 — per-wedding isolation breach. A logged-in identity that is NOT a
// member of the wedding must get 403 (not [] / 404) on every read and write
// path. `requireWeddingMember` (mounted at the top of the resource router)
// throws NotMemberError before any handler runs, so 403 is method-agnostic.
// The default seed makes only user-a a member of wedding-1, so token "sso-b"
// (→ user-b via the auth mock) is a genuine non-member.
describe("per-wedding isolation gate (Risk #1)", () => {
  let server;

  beforeEach(async () => {
    const app = await createTestServer({
      guests: [
        {
          id: "guest-1",
          wedding_id: "wedding-1",
          first_name: "Ala",
          last_name: "Nowak",
          relation: "wspolni_znajomi",
          rsvp_status: "pending",
          diet: "pending",
          has_plus_one: false,
          is_child: false,
          meal_option_id: null,
          table_id: null,
          contact_phone: null,
          contact_email: null,
        },
      ],
    });
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  const FORBIDDEN = "You are not a member of this wedding";

  it("rejects a non-member with 403 on read paths (list + aggregates)", async () => {
    const list = await request(server, "GET", "/api/weddings/wedding-1/guests", undefined, "sso-b");
    assert.equal(list.status, 403);
    assert.equal(list.body.error, FORBIDDEN);

    const aggregates = await request(
      server,
      "GET",
      "/api/weddings/wedding-1/guests/aggregates",
      undefined,
      "sso-b",
    );
    assert.equal(aggregates.status, 403);
    assert.equal(aggregates.body.error, FORBIDDEN);
  });

  it("rejects a non-member with 403 on write paths (POST + PATCH + DELETE)", async () => {
    const created = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests",
      { firstName: "Jan", lastName: "Kowalski", relation: "wspolni_znajomi" },
      "sso-b",
    );
    assert.equal(created.status, 403);
    assert.equal(created.body.error, FORBIDDEN);

    const patched = await request(
      server,
      "PATCH",
      "/api/weddings/wedding-1/guests/guest-1",
      { rsvpStatus: "confirmed" },
      "sso-b",
    );
    assert.equal(patched.status, 403);
    assert.equal(patched.body.error, FORBIDDEN);

    const removed = await request(
      server,
      "DELETE",
      "/api/weddings/wedding-1/guests/guest-1",
      undefined,
      "sso-b",
    );
    assert.equal(removed.status, 403);
    assert.equal(removed.body.error, FORBIDDEN);
  });

  it("never hands a non-member an empty list or 404 in place of 403", async () => {
    const res = await request(server, "GET", "/api/weddings/wedding-1/guests", undefined, "sso-b");
    assert.equal(res.status, 403);
    // The member's data must not leak: not a 200, not an array body, not a 404.
    assert.notEqual(res.status, 200);
    assert.notEqual(res.status, 404);
    assert.equal(Array.isArray(res.body), false);
  });

  it("positive control: a member (sso-a) is not blocked by the gate", async () => {
    const list = await request(server, "GET", "/api/weddings/wedding-1/guests", undefined, "sso-a");
    assert.equal(list.status, 200);
    assert.equal(Array.isArray(list.body), true);

    const created = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests",
      { firstName: "Jan", lastName: "Kowalski", relation: "wspolni_znajomi" },
      "sso-a",
    );
    assert.equal(created.status, 201);
  });
});

// Risk #2 (cheap half) — the central cache mitigation that stops a browser/CDN
// from serving partner B a cached pre-write response. Asserted here rather than
// in e2e because it is a deterministic header contract (server.js:44-48).
describe("cache contract on /api responses (Risk #2 cheap half)", () => {
  let server;

  beforeEach(async () => {
    const app = await createTestServer();
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("sets Cache-Control: no-store and Vary: Authorization", async () => {
    const res = await request(server, "GET", "/api/weddings/wedding-1/guests", undefined, "sso-a");
    assert.equal(res.status, 200);
    assert.match(res.headers["cache-control"], /no-store/);
    assert.match(res.headers["vary"], /Authorization/);
  });
});
