const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("partner invite HTTP flow", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer();
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("creates a partner invitation and accepts it as partner_b", async () => {
    const invite = await request(server, "POST", "/api/weddings/wedding-1/invite-partner", {
      email: "partner@example.com",
    });

    assert.equal(invite.status, 201);
    assert.equal(invite.body.email, "partner@example.com");
    assert.equal(db.partner_invitations.length, 1);
    assert.equal(db.partner_invitations[0].status, "pending");

    const accept = await request(
      server,
      "POST",
      "/api/weddings/accept-invite",
      { token: db.partner_invitations[0].token },
      "sso-b",
    );

    assert.equal(accept.status, 200);
    assert.deepEqual(accept.body.weddingMembership, {
      weddingId: "wedding-1",
      role: "partner_b",
      linkedAt: "2026-05-24T10:00:00.000Z",
    });
    assert.equal(db.partner_invitations[0].status, "accepted");
    assert.equal(
      db.wedding_members.some(
        (member) => member.user_id === "user-b" && member.role === "partner_b",
      ),
      true,
    );
  });

  it("marks expired invitations as expired and does not create membership", async () => {
    db.partner_invitations.push({
      id: "invite-expired",
      wedding_id: "wedding-1",
      invited_by_user_id: "user-a",
      email: "expired@example.com",
      token: "expired-token",
      status: "pending",
      expires_at: "2026-05-01T00:00:00.000Z",
      accepted_at: null,
    });

    const accept = await request(
      server,
      "POST",
      "/api/weddings/accept-invite",
      { token: "expired-token" },
      "sso-b",
    );

    assert.equal(accept.status, 400);
    assert.equal(accept.body.error, "Invite token has expired");
    assert.equal(db.partner_invitations[0].status, "expired");
    assert.equal(db.wedding_members.some((member) => member.user_id === "user-b"), false);
  });

  it("rejects reissuing an invitation after it was accepted", async () => {
    db.partner_invitations.push({
      id: "invite-accepted",
      wedding_id: "wedding-1",
      invited_by_user_id: "user-a",
      email: "done@example.com",
      token: "accepted-token",
      status: "accepted",
      expires_at: "2026-06-01T00:00:00.000Z",
      accepted_at: "2026-05-24T10:00:00.000Z",
    });

    const invite = await request(server, "POST", "/api/weddings/wedding-1/invite-partner", {
      email: "done@example.com",
    });

    assert.equal(invite.status, 409);
    assert.equal(invite.body.error, "Invite cannot be reissued after final status");
    assert.equal(db.partner_invitations[0].token, "accepted-token");
  });

  it("does not expose flat guest mutation routes", async () => {
    const response = await request(server, "PATCH", "/api/guests/guest-1", {
      mealOptionId: "foreign-meal-option",
    });

    assert.equal(response.status, 404);
  });

  it("rate-limits repeated accept-invite attempts", async () => {
    let response;
    for (let i = 0; i < 11; i += 1) {
      response = await request(
        server,
        "POST",
        "/api/weddings/accept-invite",
        { token: `invalid-token-${i}` },
        "sso-b",
      );
    }

    assert.equal(response.status, 429);
  });
});
