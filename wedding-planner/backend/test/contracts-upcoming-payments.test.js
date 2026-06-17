const assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

// Risk #4 — the "upcoming payments (30 days)" window. A due installment that
// silently drops out of this window means a missed payment. The boundaries are
// the off-by-one trap: the window is [today, today+30] inclusive on BOTH ends,
// and only `planned` payments count.
//
// Dates are pinned relative to "now" (never hardcoded) so the window keeps its
// meaning whenever the suite runs — the repo's time-bomb rule.
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysFromNow = (days) => new Date(Date.now() + days * DAY_MS).toISOString();
const dateDaysFromNow = (days) => isoDaysFromNow(days).slice(0, 10);

function seedWithPayments(payments) {
  return {
    weddings: [
      {
        id: "wedding-1",
        partner_a_name: "Ala",
        partner_b_name: "Jan",
        wedding_date: "2026-07-25",
        ceremony_location: null,
        budget_total: 10000,
        created_by_user_id: "user-a",
      },
    ],
    vendors: [
      {
        id: "vendor-1",
        wedding_id: "wedding-1",
        category: "sala",
        company_name: "Palac",
        status: "zarezerwowany",
      },
    ],
    contracts: [{ id: "contract-1", wedding_id: "wedding-1", vendor_id: "vendor-1" }],
    payments,
  };
}

function payment(id, dueDays, status) {
  return {
    id,
    contract_id: "contract-1",
    kind: "rata",
    due_date: dateDaysFromNow(dueDays),
    amount: 1000,
    status,
    method: "przelew",
  };
}

describe("contracts upcoming-payments (30-day window, Risk #4)", () => {
  let server;

  afterEach(async () => {
    if (server) await close(server);
    server = null;
    clearAppCache();
  });

  async function getUpcomingIds(payments) {
    const app = await createTestServer(seedWithPayments(payments));
    server = app.server;
    const response = await request(
      server,
      "GET",
      "/api/weddings/wedding-1/contracts/upcoming-payments",
    );
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));
    return response.body.map((p) => p.id);
  }

  it("includes planned payments due today through day 30 (both ends inclusive), sorted ascending", async () => {
    const ids = await getUpcomingIds([
      payment("p-today", 0, "planned"), // lower boundary — must appear
      payment("p-mid", 15, "planned"), // clearly inside
      payment("p-day30", 30, "planned"), // upper boundary — must appear
      payment("p-day31", 31, "planned"), // one day past — must NOT appear
    ]);

    // Oracle = the window definition [today, today+30], not the code's own math.
    assert.deepEqual(ids, ["p-today", "p-mid", "p-day30"]);
  });

  it("excludes a planned payment that is already overdue (past today, not 'upcoming')", async () => {
    const ids = await getUpcomingIds([
      payment("p-overdue", -2, "planned"), // due in the past — dropped by `due >= today`
      payment("p-soon", 3, "planned"),
    ]);

    assert.deepEqual(ids, ["p-soon"]);
  });

  it("excludes non-planned payments inside the window (only 'planned' counts)", async () => {
    const ids = await getUpcomingIds([
      payment("p-paid", 5, "paid"), // settled — must not show as upcoming
      payment("p-planned", 5, "planned"),
    ]);

    assert.deepEqual(ids, ["p-planned"]);
  });
});
