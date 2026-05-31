const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

// Dates relative to "now" so the upcoming-meetings window never rots over time.
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysFromNow = (days) => new Date(Date.now() + days * DAY_MS).toISOString();

describe("meetings CRUD", () => {
  let server;
  let db;

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
      vendors: [
        {
          id: "vendor-1",
          wedding_id: "wedding-1",
          category: "dj",
          company_name: "Sound Garden",
          status: "spotkanie",
        },
      ],
      meetings: [],
    });
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("creates, updates, lists, gets upcoming, and deletes meetings", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/meetings", {
      title: "Omowic muzyke",
      meetingDate: isoDaysFromNow(3),
      vendorId: "vendor-1",
      notes: "Playlista",
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.vendorName, "Sound Garden");

    const updated = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/meetings/${created.body.id}`,
      { title: "Omowic pierwszy taniec", vendorId: null },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.title, "Omowic pierwszy taniec");
    assert.equal(updated.body.vendorId, null);

    const list = await request(server, "GET", "/api/weddings/wedding-1/meetings");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);

    const upcoming = await request(server, "GET", "/api/weddings/wedding-1/meetings/upcoming");
    assert.equal(upcoming.status, 200);
    assert.equal(upcoming.body.length, 1);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/meetings/${created.body.id}`,
    );
    assert.equal(removed.status, 204);
  });

  it("rejects vendor ids from another wedding", async () => {
    db.vendors.push({
      id: "foreign-vendor",
      wedding_id: "wedding-2",
      category: "dj",
      company_name: "Foreign",
      status: "spotkanie",
    });

    const response = await request(server, "POST", "/api/weddings/wedding-1/meetings", {
      title: "Bad",
      meetingDate: "2026-05-30T12:00:00.000Z",
      vendorId: "foreign-vendor",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "vendorId does not belong to this wedding");
  });

  it("does not mutate meetings from another wedding", async () => {
    db.meetings.push({
      id: "foreign-meeting",
      wedding_id: "wedding-2",
      title: "Foreign",
      starts_at: "2026-05-30T12:00:00.000Z",
      vendor_id: null,
      notes: null,
    });

    const response = await request(
      server,
      "PATCH",
      "/api/weddings/wedding-1/meetings/foreign-meeting",
      { title: "Changed" },
    );

    assert.equal(response.status, 404);
    assert.equal(db.meetings[0].title, "Foreign");
  });
});
