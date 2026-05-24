const assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("wedding creation and current user payload", () => {
  let server;

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
    server = null;
  });

  it("creates a wedding through the bootstrap RPC", async () => {
    const app = await createTestServer({ wedding_members: [] });
    server = app.server;

    const response = await request(
      server,
      "POST",
      "/api/weddings",
      {
        partnerAName: "Ala",
        partnerBName: "Jan",
        weddingDate: "2026-07-25",
        ceremonyLocation: "Garden",
      },
      "sso-c",
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.partnerAName, "Ala");
    assert.equal(response.body.bootstrap.tables, 12);
    assert.equal(
      app.db.wedding_members.some(
        (member) => member.user_id === "user-c" && member.role === "partner_a",
      ),
      true,
    );
  });

  it("rejects creating a second wedding for an existing member", async () => {
    const app = await createTestServer();
    server = app.server;

    const response = await request(server, "POST", "/api/weddings", {
      partnerAName: "Ala",
      partnerBName: "Jan",
      weddingDate: "2026-07-25",
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.error, "User already belongs to a wedding");
  });

  it("returns /api/me without membership", async () => {
    const app = await createTestServer({ wedding_members: [] });
    server = app.server;

    const response = await request(server, "GET", "/api/me", undefined, "sso-c");

    assert.equal(response.status, 200);
    assert.equal(response.body.weddingId, null);
    assert.equal(response.body.weddingMembership, null);
    assert.equal(response.body.partner, null);
  });

  it("returns /api/me for partner_a without a linked partner", async () => {
    const app = await createTestServer();
    server = app.server;

    const response = await request(server, "GET", "/api/me");

    assert.equal(response.status, 200);
    assert.equal(response.body.weddingId, "wedding-1");
    assert.deepEqual(response.body.weddingMembership, {
      weddingId: "wedding-1",
      role: "partner_a",
      linkedAt: "2026-05-24T09:00:00.000Z",
    });
    assert.equal(response.body.partner, null);
  });

  it("returns /api/me with linked partner data", async () => {
    const app = await createTestServer({
      users: [
        {
          id: "user-b",
          sso_user_id: "sso-b",
          email: "partner@example.com",
          first_name: "Partner",
          last_name: "Two",
        },
      ],
      wedding_members: [
        {
          wedding_id: "wedding-1",
          user_id: "user-a",
          role: "partner_a",
          linked_at: "2026-05-24T09:00:00.000Z",
        },
        {
          wedding_id: "wedding-1",
          user_id: "user-b",
          role: "partner_b",
          linked_at: "2026-05-24T10:00:00.000Z",
        },
      ],
    });
    server = app.server;

    const response = await request(server, "GET", "/api/me");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.partner, {
      id: "user-b",
      firstName: "Partner",
      lastName: "Two",
      email: "partner@example.com",
      linkStatus: "linked",
    });
  });
});
