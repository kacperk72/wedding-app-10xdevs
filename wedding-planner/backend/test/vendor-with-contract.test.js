const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("vendor + contract + payments atomic create", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer();
    server = app.server;
    db = app.db;
  });

  afterEach(async () => {
    await close(server);
    clearAppCache();
  });

  it("creates vendor, contract, and two payments in one POST", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "dekoratorka",
      companyName: "Kwiatowy raj",
      status: "zarezerwowany",
      contract: {
        totalAmount: 6000,
        signedDate: "2026-06-01",
        deposit: { amount: 2000, dueDate: "2026-06-05", method: "gotowka" },
        finalPayment: { amount: 4000, dueDate: "2026-07-20", method: "przelew" },
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.category, "dekoratorka");
    assert.equal(response.body.contractAmount, 6000);
    assert.equal(response.body.hasContract, true);

    const vendorRow = db.vendors.find((vendor) => vendor.id === response.body.id);
    assert.ok(vendorRow);

    const contractRow = db.contracts.find((contract) => contract.vendor_id === response.body.id);
    assert.ok(contractRow);
    assert.equal(Number(contractRow.total_amount), 6000);

    const payments = db.payments.filter((payment) => payment.contract_id === contractRow.id);
    assert.equal(payments.length, 2);
    const deposit = payments.find((payment) => payment.kind === "zaliczka");
    const final = payments.find((payment) => payment.kind === "final");
    assert.equal(deposit.method, "gotowka");
    assert.equal(final.method, "przelew");
    assert.equal(Number(deposit.amount) + Number(final.amount), 6000);
  });

  it("accepts deposit only when finalPayment is omitted", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "ciasta_pozegnalne",
      companyName: "Cukiernia Zofia",
      contract: {
        totalAmount: 800,
        deposit: { amount: 800, dueDate: "2026-07-25", method: "przelew" },
      },
    });

    assert.equal(response.status, 201);
    const contractRow = db.contracts.find((contract) => contract.vendor_id === response.body.id);
    const payments = db.payments.filter((payment) => payment.contract_id === contractRow.id);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].kind, "zaliczka");
  });

  it("rejects bundle when deposit + finalPayment does not equal totalAmount", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "kosciol",
      companyName: "Parafia sw. Anny",
      contract: {
        totalAmount: 1000,
        deposit: { amount: 300, dueDate: "2026-06-01", method: "gotowka" },
        finalPayment: { amount: 800, dueDate: "2026-07-01", method: "gotowka" },
      },
    });

    assert.equal(response.status, 400);
    assert.ok(/equal/i.test(response.body.error));
    assert.equal(db.vendors.filter((vendor) => vendor.company_name === "Parafia sw. Anny").length, 0);
    assert.equal(db.contracts.length, 0);
    assert.equal(db.payments.length, 0);
  });

  it("rejects unknown vendor category", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "kwiaciarz",
      companyName: "Stara nazwa",
    });
    assert.equal(response.status, 400);
  });

  it("rejects invalid payment method", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/vendors", {
      category: "slodki_stol_tort",
      companyName: "Sweet Co",
      contract: {
        totalAmount: 500,
        deposit: { amount: 500, dueDate: "2026-07-01", method: "karta" },
      },
    });
    assert.equal(response.status, 400);
    assert.equal(db.vendors.length, 0);
  });
});
