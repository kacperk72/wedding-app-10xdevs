const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

function guest(id, tableId = null, weddingId = "wedding-1") {
  return {
    id,
    wedding_id: weddingId,
    first_name: id === "guest-1" ? "Anna" : id === "guest-2" ? "Marek" : "Ola",
    last_name: id === "guest-1" ? "Nowak" : id === "guest-2" ? "Kowalski" : "Lis",
    relation: "wspolni_znajomi",
    rsvp_status: "confirmed",
    diet: "standard",
    has_plus_one: false,
    is_child: false,
    meal_option_id: null,
    table_id: tableId,
    contact_phone: null,
    contact_email: null,
  };
}

describe("seating", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      tables: [
        {
          id: "table-1",
          wedding_id: "wedding-1",
          name: "Stol 1",
          seats_count: 2,
          sort_order: 1,
          position_x: null,
          position_y: null,
        },
        {
          id: "full-table",
          wedding_id: "wedding-1",
          name: "Pelny stol",
          seats_count: 1,
          sort_order: 2,
          position_x: null,
          position_y: null,
        },
      ],
      guests: [guest("guest-1"), guest("guest-2", "table-1"), guest("guest-3", "full-table")],
      seating_conflicts: [],
    });
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("creates a seating conflict", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/seating-conflicts", {
      guestAId: "guest-1",
      guestBId: "guest-2",
      reason: "konflikt rodzinny",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.guestAName, "Anna Nowak");
    assert.equal(response.body.guestBName, "Marek Kowalski");
    assert.equal(response.body.reason, "konflikt rodzinny");
  });

  it("rejects a conflict between the same guest", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/seating-conflicts", {
      guestAId: "guest-1",
      guestBId: "guest-1",
      reason: "duplicate",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "guestAId and guestBId must differ");
  });

  it("rejects a conflict with a cross-wedding guest", async () => {
    db.guests.push(guest("foreign-guest", null, "wedding-2"));

    const response = await request(server, "POST", "/api/weddings/wedding-1/seating-conflicts", {
      guestAId: "guest-1",
      guestBId: "foreign-guest",
      reason: "foreign",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "guestBId does not belong to this wedding");
  });

  it("assigns a guest to a table", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-1/assign-table",
      { tableId: "table-1" },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.guest.tableId, "table-1");
    assert.equal(db.guests.find((item) => item.id === "guest-1").table_id, "table-1");
    // Przy dropie na stół backend utrwala pierwsze wolne krzesło (auto-seat).
    assert.equal(response.body.guest.seatNumber, 1);
    assert.equal(db.guests.find((item) => item.id === "guest-1").seat_number, 1);
  });

  it("auto-seat: przypisanie do stołu wybiera pierwsze wolne krzesło", async () => {
    // guest-2 zajmuje krzesło 1 przy table-1 (2 miejsca) → guest-1 ma dostać 2.
    db.guests.find((item) => item.id === "guest-2").seat_number = 1;

    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-1/assign-table",
      { tableId: "table-1" },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.guest.seatNumber, 2);
    assert.equal(db.guests.find((item) => item.id === "guest-1").seat_number, 2);
  });

  it("rejects assigning a guest to a full table", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-1/assign-table",
      { tableId: "full-table" },
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "table is full");
  });

  it("returns warnings when assigned to a table with a conflicted guest", async () => {
    db.seating_conflicts.push({
      id: "conflict-1",
      wedding_id: "wedding-1",
      guest_a_id: "guest-1",
      guest_b_id: "guest-2",
      reason: "konflikt rodzinny",
      created_at: "2026-05-24T10:00:00.000Z",
    });

    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-1/assign-table",
      { tableId: "table-1" },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.warnings, [
      {
        otherGuestId: "guest-2",
        otherGuestName: "Marek Kowalski",
        reason: "konflikt rodzinny",
      },
    ]);
  });

  it("reseat: sadza gościa na wolne krzesło (ustawia table_id i seat_number)", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-2/reseat",
      { tableId: "table-1", seatNumber: 1 },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.guest.tableId, "table-1");
    assert.equal(response.body.guest.seatNumber, 1);
    const row = db.guests.find((item) => item.id === "guest-2");
    assert.equal(row.table_id, "table-1");
    assert.equal(row.seat_number, 1);
  });

  it("reseat: zamiana miejscami dwóch gości przy tym samym stole", async () => {
    // guest-2 i guest-4 przy table-1 (2 miejsca), na krzesłach 1 i 2.
    db.guests.push(guest("guest-4", "table-1"));
    db.guests.find((item) => item.id === "guest-2").seat_number = 1;
    db.guests.find((item) => item.id === "guest-4").seat_number = 2;

    // Przeciągamy guest-2 (krzesło 1) na krzesło 2 (zajęte przez guest-4).
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-2/reseat",
      { tableId: "table-1", seatNumber: 2 },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.guest.seatNumber, 2);
    assert.equal(db.guests.find((item) => item.id === "guest-2").seat_number, 2);
    // Dotychczasowy lokator wskakuje na stare krzesło przeciąganego gościa.
    assert.equal(db.guests.find((item) => item.id === "guest-4").seat_number, 1);
    assert.equal(db.guests.find((item) => item.id === "guest-4").table_id, "table-1");
  });

  it("reseat: odrzuca gościa z listy nieposadzonych na zajęte krzesło", async () => {
    db.guests.find((item) => item.id === "guest-2").seat_number = 1; // zajmuje krzesło 1

    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-1/reseat", // guest-1 nie ma stołu
      { tableId: "table-1", seatNumber: 1 },
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "To krzesło jest już zajęte");
  });

  it("reseat: odrzuca wejście na wolne krzesło pełnego stołu", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-1/reseat",
      { tableId: "full-table", seatNumber: 1 }, // full-table zajęty przez guest-3
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "table is full");
  });

  it("reseat: odrzuca numer krzesła spoza zakresu stołu", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-2/reseat",
      { tableId: "table-1", seatNumber: 5 }, // table-1 ma tylko 2 miejsca
    );

    assert.equal(response.status, 400);
    assert.match(response.body.error, /Numer krzesła przekracza/);
  });

  it("unassigns a guest from a table", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/guests/guest-2/unassign-table",
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.tableId, null);
    assert.equal(db.guests.find((item) => item.id === "guest-2").table_id, null);
  });

  it("releases a table, unseating all assigned guests at once", async () => {
    // Druga osoba przy tym samym stole + numer krzesła, by sprawdzić pełne czyszczenie.
    db.guests.push(guest("guest-4", "table-1"));
    db.guests.find((item) => item.id === "guest-2").seat_number = 1;
    db.guests.find((item) => item.id === "guest-4").seat_number = 2;

    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/tables/table-1/release",
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.released, 2);
    for (const id of ["guest-2", "guest-4"]) {
      const guestRow = db.guests.find((item) => item.id === id);
      assert.equal(guestRow.table_id, null);
      assert.equal(guestRow.seat_number, null);
    }
    // Gość przy innym stole pozostaje nietknięty.
    assert.equal(db.guests.find((item) => item.id === "guest-3").table_id, "full-table");
  });

  it("returns released: 0 when the table has no guests", async () => {
    db.tables.push({
      id: "empty-table",
      wedding_id: "wedding-1",
      name: "Pusty stol",
      seats_count: 4,
      sort_order: 3,
      position_x: null,
      position_y: null,
    });

    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/tables/empty-table/release",
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.released, 0);
  });

  it("rejects releasing a table that does not belong to the wedding", async () => {
    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/tables/missing-table/release",
    );

    assert.equal(response.status, 404);
  });

  it("returns seating stats", async () => {
    db.tables = [
      { id: "table-1", wedding_id: "wedding-1", name: "Stol 1", seats_count: 2, sort_order: 1 },
      { id: "table-2", wedding_id: "wedding-1", name: "Stol 2", seats_count: 4, sort_order: 2 },
    ];
    db.guests = [guest("guest-1", "table-1"), guest("guest-2", "table-1"), guest("guest-3")];
    db.seating_conflicts = [
      {
        id: "conflict-1",
        wedding_id: "wedding-1",
        guest_a_id: "guest-1",
        guest_b_id: "guest-2",
        reason: "konflikt rodzinny",
      },
    ];

    const response = await request(server, "GET", "/api/weddings/wedding-1/seating/stats");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      seatedCount: 2,
      unseatedCount: 1,
      tablesUsed: 1,
      totalSeats: 6,
      conflictsCount: 1,
      fullTablesCount: 1,
    });
  });

  it("stats: goście z odmową (declined) nie liczą się do rozsadzenia", async () => {
    db.tables = [
      { id: "table-1", wedding_id: "wedding-1", name: "Stol 1", seats_count: 2, sort_order: 1 },
    ];
    // guest-1 przy stole (declined) i guest-2 nieposadzony (declined) — oboje pomijani.
    const declinedSeated = guest("guest-1", "table-1");
    declinedSeated.rsvp_status = "declined";
    const declinedUnseated = guest("guest-2");
    declinedUnseated.rsvp_status = "declined";
    db.guests = [declinedSeated, declinedUnseated, guest("guest-3", "table-1")];
    db.seating_conflicts = [];

    const response = await request(server, "GET", "/api/weddings/wedding-1/seating/stats");

    assert.equal(response.status, 200);
    assert.equal(response.body.seatedCount, 1); // tylko guest-3
    assert.equal(response.body.unseatedCount, 0); // declined pominięty
    assert.equal(response.body.fullTablesCount, 0); // stół nie jest pełny (1/2)
  });

  it("patches a seating conflict reason", async () => {
    db.seating_conflicts.push({
      id: "conflict-1",
      wedding_id: "wedding-1",
      guest_a_id: "guest-1",
      guest_b_id: "guest-2",
      reason: "stary powod",
      created_at: "2026-05-24T10:00:00.000Z",
    });

    const response = await request(
      server,
      "PATCH",
      "/api/weddings/wedding-1/seating-conflicts/conflict-1",
      { reason: "nowy powod" },
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.reason, "nowy powod");
  });

  it("deletes a seating conflict", async () => {
    db.seating_conflicts.push({
      id: "conflict-1",
      wedding_id: "wedding-1",
      guest_a_id: "guest-1",
      guest_b_id: "guest-2",
      reason: "stary powod",
      created_at: "2026-05-24T10:00:00.000Z",
    });

    const response = await request(
      server,
      "DELETE",
      "/api/weddings/wedding-1/seating-conflicts/conflict-1",
    );

    assert.equal(response.status, 204);
    assert.equal(db.seating_conflicts.length, 0);
  });
});
