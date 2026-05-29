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
      vendors: [
        {
          id: "vendor-1",
          wedding_id: "wedding-1",
          category: "dj",
          company_name: "Sound Garden",
          contact_person: "Michal",
          phone: "+48 500 100 200",
          email: "dj@example.com",
          status: "spotkanie",
          contract_amount: 5800,
          notes: null,
        },
      ],
      contracts: [],
      payments: [],
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
    assert.equal(aggregates.body.pending, 1);
    assert.equal(aggregates.body.declined, 1);
    assert.equal(aggregates.body.noMealPick, 1);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/guests/${created.body.id}`,
    );
    assert.equal(removed.status, 204);
    assert.equal(db.guests.some((guest) => guest.id === created.body.id), false);
  });

  async function seatGuestAtTable1(seatNumber) {
    const created = await request(server, "POST", "/api/weddings/wedding-1/guests", {
      firstName: "Ewa",
      lastName: "Lis",
      relation: "wspolni_znajomi",
      diet: "standard",
      tableId: "table-1",
    });
    assert.equal(created.body.seatNumber, null);
    if (seatNumber === undefined) return created.body;

    const seated = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/guests/${created.body.id}`,
      { seatNumber },
    );
    assert.equal(seated.status, 200);
    assert.equal(seated.body.seatNumber, seatNumber);
    return seated.body;
  }

  it("assigns and clears a guest's seat number", async () => {
    const guest = await seatGuestAtTable1(3);

    const cleared = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/guests/${guest.id}`,
      { seatNumber: null },
    );
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.seatNumber, null);
  });

  it("rejects a seat number beyond table capacity", async () => {
    const guest = await seatGuestAtTable1();
    const res = await request(server, "PATCH", `/api/weddings/wedding-1/guests/${guest.id}`, {
      seatNumber: 9,
    });
    assert.equal(res.status, 400);
  });

  it("rejects a seat number for a guest without a table", async () => {
    const res = await request(server, "PATCH", "/api/weddings/wedding-1/guests/guest-1", {
      seatNumber: 1,
    });
    assert.equal(res.status, 400);
  });

  it("clears the seat number when a guest leaves the table", async () => {
    const guest = await seatGuestAtTable1(2);
    const left = await request(server, "PATCH", `/api/weddings/wedding-1/guests/${guest.id}`, {
      tableId: null,
    });
    assert.equal(left.status, 200);
    assert.equal(left.body.tableId, null);
    assert.equal(left.body.seatNumber, null);
  });

  it("blocks shrinking a table below an occupied seat but allows shrinking to it", async () => {
    await seatGuestAtTable1(6);

    const blocked = await request(server, "PATCH", "/api/weddings/wedding-1/tables/table-1", {
      seatsCount: 5,
    });
    assert.equal(blocked.status, 400);

    const allowed = await request(server, "PATCH", "/api/weddings/wedding-1/tables/table-1", {
      seatsCount: 6,
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.seatsCount, 6);
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

  it("creates, updates, lists, and deletes vendors", async () => {
    const created = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "fotograf",
      companyName: "Kadr i Swiatlo",
      contactPerson: "Tomasz",
      phone: "+48 500 300 400",
      email: "foto@example.com",
      status: "rozwazany",
      contractAmount: 8500,
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.companyName, "Kadr i Swiatlo");
    assert.equal(created.body.hasContract, false);

    const updated = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/vendors/${created.body.id}`,
      { status: "zarezerwowany", notes: "Podpis do potwierdzenia" },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, "zarezerwowany");

    const list = await request(server, "GET", "/api/weddings/wedding-1/vendors?status=zarezerwowany");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);

    const missing = await request(server, "GET", "/api/weddings/wedding-1/vendors/missing");
    assert.equal(missing.status, 200);
    assert.equal(missing.body.includes("fotograf"), false);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/vendors/${created.body.id}`,
    );
    assert.equal(removed.status, 204);
  });

  it("does not mutate vendors from another wedding", async () => {
    db.vendors.push({
      id: "foreign-vendor",
      wedding_id: "wedding-2",
      category: "dj",
      company_name: "Foreign DJ",
      status: "rozwazany",
      contract_amount: 1000,
    });

    const updated = await request(
      server,
      "PATCH",
      "/api/weddings/wedding-1/vendors/foreign-vendor",
      { status: "zarezerwowany" },
    );
    assert.equal(updated.status, 404);

    const removed = await request(
      server,
      "DELETE",
      "/api/weddings/wedding-1/vendors/foreign-vendor",
    );
    assert.equal(removed.status, 404);
    assert.equal(db.vendors.find((vendor) => vendor.id === "foreign-vendor").status, "rozwazany");
  });

  it("creates contracts and nested payments with status sync", async () => {
    const contract = await request(server, "POST", "/api/weddings/wedding-1/contracts", {
      vendorId: "vendor-1",
      totalAmount: 5800,
      signedDate: "2026-05-24",
    });

    assert.equal(contract.status, 201);
    assert.equal(contract.body.vendorName, "Sound Garden");
    assert.equal(contract.body.totalAmount, 5800);

    const deposit = await request(
      server,
      "POST",
      `/api/weddings/wedding-1/contracts/${contract.body.id}/payments`,
      {
        kind: "zaliczka",
        dueDate: "2026-05-30",
        amount: 1500,
      },
    );
    assert.equal(deposit.status, 201);

    const finalPayment = await request(
      server,
      "POST",
      `/api/weddings/wedding-1/contracts/${contract.body.id}/payments`,
      {
        kind: "final",
        dueDate: "2026-06-15",
        amount: 4300,
      },
    );
    assert.equal(finalPayment.status, 201);

    const paidDeposit = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/contracts/${contract.body.id}/payments/${deposit.body.id}`,
      { status: "paid", paidAt: "2026-05-24" },
    );
    assert.equal(paidDeposit.status, 200);

    const list = await request(server, "GET", "/api/weddings/wedding-1/contracts");
    assert.equal(list.status, 200);
    assert.equal(list.body[0].status, "deposit_paid");
    assert.equal(list.body[0].paidCount, 1);
    assert.equal(list.body[0].totalCount, 2);

    const paidFinal = await request(
      server,
      "PATCH",
      `/api/weddings/wedding-1/contracts/${contract.body.id}/payments/${finalPayment.body.id}`,
      { status: "paid", paidAt: "2026-06-01" },
    );
    assert.equal(paidFinal.status, 200);

    const paidInFullList = await request(server, "GET", "/api/weddings/wedding-1/contracts");
    assert.equal(paidInFullList.status, 200);
    assert.equal(paidInFullList.body[0].status, "paid_in_full");
    assert.equal(paidInFullList.body[0].paidCount, 2);

    const upcoming = await request(server, "GET", "/api/weddings/wedding-1/contracts/upcoming-payments");
    assert.equal(upcoming.status, 200);
    assert.equal(upcoming.body.length, 0);

    const removed = await request(
      server,
      "DELETE",
      `/api/weddings/wedding-1/contracts/${contract.body.id}/payments/${deposit.body.id}`,
    );
    assert.equal(removed.status, 204);
  });

  it("rejects contracts for vendors from another wedding", async () => {
    db.vendors.push({
      id: "foreign-vendor",
      wedding_id: "wedding-2",
      category: "dj",
      company_name: "Foreign DJ",
      status: "rozwazany",
    });

    const response = await request(server, "POST", "/api/weddings/wedding-1/contracts", {
      vendorId: "foreign-vendor",
      totalAmount: 1000,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "vendorId does not belong to this wedding");
  });

  it("rejects nested payment writes through contracts from another wedding", async () => {
    db.vendors.push({
      id: "foreign-vendor",
      wedding_id: "wedding-2",
      category: "dj",
      company_name: "Foreign DJ",
      status: "rozwazany",
    });
    db.contracts.push({
      id: "foreign-contract",
      wedding_id: "wedding-2",
      vendor_id: "foreign-vendor",
      total_amount: 1000,
      signed_date: null,
      status: "pending",
    });

    const response = await request(
      server,
      "POST",
      "/api/weddings/wedding-1/contracts/foreign-contract/payments",
      { kind: "zaliczka", dueDate: "2026-05-30", amount: 500 },
    );

    assert.equal(response.status, 404);
    assert.equal(db.payments.some((payment) => payment.contract_id === "foreign-contract"), false);
  });
});
