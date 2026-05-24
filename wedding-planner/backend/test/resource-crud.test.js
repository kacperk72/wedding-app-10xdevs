const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("scoped wedding resource CRUD", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      meal_options: [
        {
          id: "meal-1",
          wedding_id: "wedding-1",
          label: "Standard",
          sort_order: 1,
        },
      ],
      tables: [
        {
          id: "table-1",
          wedding_id: "wedding-1",
          name: "Table 1",
          seats_count: 8,
          sort_order: 1,
          position_x: null,
          position_y: null,
        },
      ],
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
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("creates, updates, lists, and deletes guests through scoped routes", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/guests", {
      firstName: "Jan",
      lastName: "Kowalski",
      relation: "wspolni_znajomi",
      rsvpStatus: "confirmed",
      diet: "standard",
      mealOptionId: "meal-1",
      tableId: "table-1",
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.firstName, "Jan");
    assert.equal(created.body.mealOptionId, "meal-1");

    const updated = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/guests/${created.body.id}`,
      { rsvpStatus: "declined", tableId: null },
    );

    assert.equal(updated.status, 200);
    assert.equal(updated.body.rsvpStatus, "declined");
    assert.equal(updated.body.tableId, null);

    const list = await request(server, "GET", "/api/weddings/wedding-1/guests");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2);

    const aggregates = await request(server, "GET", "/api/weddings/wedding-1/guests/aggregates");
    assert.equal(aggregates.status, 200);
    assert.equal(aggregates.body.invited, 2);
    assert.equal(aggregates.body.confirmed, 0);
    assert.equal(aggregates.body.declined, 1);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/guests/${created.body.id}`,
    );
    assert.equal(removed.status, 204);
    assert.equal(db.guests.some((guest) => guest.id === created.body.id), false);
  });

  it("rejects guest foreign keys from another wedding", async () => {
    db.meal_options.push({
      id: "foreign-meal",
      wedding_id: "wedding-2",
      label: "Foreign",
      sort_order: 1,
    });

    const response = await request(server, "POST", "/api/weddings/wedding-1/guests", {
      firstName: "Ola",
      lastName: "Zielinska",
      relation: "wspolni_znajomi",
      mealOptionId: "foreign-meal",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "mealOptionId does not belong to this wedding");
  });

  it("creates, updates, lists, and deletes meal options", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/meal-options", {
      label: "Vegan",
      sortOrder: 2,
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.label, "Vegan");

    const updated = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/meal-options/${created.body.id}`,
      { label: "Vegan plus", sortOrder: 3 },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.sortOrder, 3);

    const list = await request(server, "GET", "/api/weddings/wedding-1/meal-options");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/meal-options/${created.body.id}`,
    );
    assert.equal(removed.status, 204);
  });

  it("creates, updates, lists, and deletes tables", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/tables", {
      name: "Table 2",
      seatsCount: 10,
      sortOrder: 2,
      positionX: 15,
      positionY: 25,
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.seatsCount, 10);

    const updated = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/tables/${created.body.id}`,
      { seatsCount: 12, positionX: 20 },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.positionX, 20);

    const list = await request(server, "GET", "/api/weddings/wedding-1/tables");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2);

    const invalid = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/tables/${created.body.id}`,
      { seatsCount: 25 },
    );
    assert.equal(invalid.status, 400);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/tables/${created.body.id}`,
    );
    assert.equal(removed.status, 204);
  });
});
