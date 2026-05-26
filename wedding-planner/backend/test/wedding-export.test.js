const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("wedding export", () => {
  let server;

  beforeEach(async () => {
    const app = await createTestServer({
      weddings: [
        {
          id: "wedding-1",
          partner_a_name: "Ala",
          partner_b_name: "Jan",
          wedding_date: "2026-07-25",
          ceremony_location: null,
          created_by_user_id: "user-a",
        },
      ],
      partner_invitations: [
        {
          id: "invite-1",
          wedding_id: "wedding-1",
          invited_by_user_id: "user-a",
          email: "partner@example.com",
          token: "secret-token",
          status: "pending",
          expires_at: "2026-06-01T10:00:00.000Z",
          accepted_at: null,
          created_at: "2026-05-24T10:00:00.000Z",
        },
      ],
      guests: [{ id: "guest-1", wedding_id: "wedding-1", first_name: "Ola" }],
    });
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("returns downloadable JSON without invitation tokens", async () => {
    const response = await request(server, "GET", "/api/weddings/wedding-1/export");

    assert.equal(response.status, 200);
    assert.match(response.headers["content-disposition"], /attachment; filename="wedding-wedding-1-export.json"/);
    assert.equal(response.body.wedding.id, "wedding-1");
    assert.equal(response.body.partnerInvitations[0].email, "partner@example.com");
    assert.equal(response.body.partnerInvitations[0].token, undefined);
    assert.equal(JSON.stringify(response.body).includes("secret-token"), false);
  });
});
