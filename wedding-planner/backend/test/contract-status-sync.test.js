const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

// Risk #4 — contract status must track its payments. The FSM (payments.js
// syncContractStatus) is the oracle, restated here independently:
//   no payments                              -> pending
//   >=1 payment, none paid                   -> in_progress
//   >=1 payment, a *zaliczka* paid (not all) -> deposit_paid
//   all payments paid                        -> paid_in_full
// A wrong transition misreports how far along a contract is.

const PAYMENTS = "/api/weddings/wedding-1/contracts/contract-1/payments";

describe("contract status sync (Risk #4)", () => {
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
        { id: "vendor-1", wedding_id: "wedding-1", category: "sala", company_name: "Palac", status: "zarezerwowany" },
      ],
      contracts: [
        { id: "contract-1", wedding_id: "wedding-1", vendor_id: "vendor-1", total_amount: 5000, status: "pending" },
      ],
      payments: [],
    });
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    server = null;
    clearAppCache();
  });

  const status = () => db.contracts.find((c) => c.id === "contract-1").status;

  async function addPayment(kind, paymentStatus) {
    const res = await request(server, "POST", PAYMENTS, {
      kind,
      dueDate: "2026-07-01",
      amount: 1000,
      status: paymentStatus,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.id;
  }

  async function setPaid(paymentId) {
    const res = await request(server, "PATCH", `${PAYMENTS}/${paymentId}`, { status: "paid" });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }

  it("a single planned payment moves the contract from pending to in_progress", async () => {
    assert.equal(status(), "pending");
    await addPayment("rata", "planned");
    assert.equal(status(), "in_progress");
  });

  it("a paid zaliczka with an outstanding rata yields deposit_paid", async () => {
    await addPayment("rata", "planned");
    const zaliczka = await addPayment("zaliczka", "planned");
    assert.equal(status(), "in_progress");

    await setPaid(zaliczka);
    assert.equal(status(), "deposit_paid");
  });

  it("all payments paid yields paid_in_full", async () => {
    const rata = await addPayment("rata", "planned");
    const zaliczka = await addPayment("zaliczka", "planned");
    await setPaid(zaliczka);
    await setPaid(rata);
    assert.equal(status(), "paid_in_full");
  });

  it("a paid non-zaliczka does NOT count as a deposit (stays in_progress)", async () => {
    // Subtlety: deposit_paid requires a paid *zaliczka* specifically. A paid
    // rata while the zaliczka is still planned must remain in_progress.
    const rata = await addPayment("rata", "planned");
    await addPayment("zaliczka", "planned");
    await setPaid(rata);
    assert.equal(status(), "in_progress");
  });

  it("removing the last payment returns the contract to pending", async () => {
    const rata = await addPayment("rata", "planned");
    assert.equal(status(), "in_progress");

    const res = await request(server, "DELETE", `${PAYMENTS}/${rata}`);
    assert.equal(res.status, 204);
    assert.equal(status(), "pending");
  });
});
