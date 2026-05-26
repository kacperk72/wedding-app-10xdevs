const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("wedding delete", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      users: [
        { id: "user-b", sso_user_id: "sso-b", email: "b@example.com" },
      ],
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
      guests: [{ id: "guest-1", wedding_id: "wedding-1" }],
    });
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("allows the founder to delete the wedding", async () => {
    const response = await request(server, "DELETE", "/api/weddings/wedding-1");

    assert.equal(response.status, 204);
    assert.equal(db.weddings.length, 0);
    assert.equal(db.guests.length, 0);
  });

  it("rejects partner B", async () => {
    const response = await request(server, "DELETE", "/api/weddings/wedding-1", undefined, "sso-b");

    assert.equal(response.status, 403);
    assert.equal(db.weddings.length, 1);
  });

  it("rejects non-members", async () => {
    const response = await request(server, "DELETE", "/api/weddings/wedding-1", undefined, "sso-c");

    assert.equal(response.status, 403);
    assert.equal(db.weddings.length, 1);
  });
});
