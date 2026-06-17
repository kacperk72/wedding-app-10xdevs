const assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

// Risk #5 — the "Wymaga uwagi" signal must not under-report (hide something
// actually due) nor over-report (flag something that isn't). The oracle is the
// boundary in buildDashboard: a task/payment is overdue when due_date < today
// (strictly before today), so an item due *today* is NOT overdue, one due
// *yesterday* IS. Dates pinned relative to now (no time-bombs).
const DAY_MS = 24 * 60 * 60 * 1000;
const dateDaysFromNow = (days) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

function baseSeed(extra) {
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
      { id: "vendor-1", wedding_id: "wedding-1", category: "sala", company_name: "Palac", status: "zarezerwowany" },
    ],
    contracts: [{ id: "contract-1", wedding_id: "wedding-1", vendor_id: "vendor-1" }],
    ...extra,
  };
}

describe("dashboard 'Wymaga uwagi' signal (Risk #5)", () => {
  let server;

  afterEach(async () => {
    if (server) await close(server);
    server = null;
    clearAppCache();
  });

  async function getDashboard(extra) {
    const app = await createTestServer(baseSeed(extra));
    server = app.server;
    const res = await request(server, "GET", "/api/weddings/wedding-1/dashboard");
    assert.equal(res.status, 200);
    return res.body;
  }

  it("flags yesterday's items as overdue but never today's (the boundary)", async () => {
    const body = await getDashboard({
      tasks: [
        { id: "task-yesterday", wedding_id: "wedding-1", title: "Zaległe", due_date: dateDaysFromNow(-1), done: false },
        { id: "task-today", wedding_id: "wedding-1", title: "Na dziś", due_date: dateDaysFromNow(0), done: false },
        { id: "task-done", wedding_id: "wedding-1", title: "Gotowe", due_date: dateDaysFromNow(-5), done: true },
      ],
      payments: [
        { id: "pay-yesterday", contract_id: "contract-1", kind: "rata", amount: 500, due_date: dateDaysFromNow(-1), status: "planned" },
        { id: "pay-today", contract_id: "contract-1", kind: "rata", amount: 600, due_date: dateDaysFromNow(0), status: "planned" },
        { id: "pay-paid-late", contract_id: "contract-1", kind: "rata", amount: 700, due_date: dateDaysFromNow(-3), status: "paid" },
      ],
    });

    // overdue = strictly before today; today's task/payment are NOT overdue.
    assert.equal(body.kpis.tasks.overdueCount, 1);
    assert.equal(body.kpis.payments.overdueCount, 1);
    // today's planned payment is upcoming (due >= today), not overdue, not lost.
    assert.equal(body.kpis.payments.upcomingCount, 1);

    // attentionItems: tasks first, then payments — only the genuinely overdue ones.
    assert.equal(body.attentionItems.length, 2);
    assert.equal(body.attentionItems[0].type, "task");
    assert.equal(body.attentionItems[0].title, "Zaległe");
    assert.equal(body.attentionItems[1].type, "payment");
    assert.ok(body.attentionItems[1].title.includes("500"));
  });

  it("is empty when nothing is overdue (no false positives)", async () => {
    const body = await getDashboard({
      tasks: [
        { id: "task-future", wedding_id: "wedding-1", title: "Później", due_date: dateDaysFromNow(5), done: false },
      ],
      payments: [
        { id: "pay-future", contract_id: "contract-1", kind: "rata", amount: 800, due_date: dateDaysFromNow(10), status: "planned" },
      ],
    });

    assert.deepEqual(body.attentionItems, []);
    assert.equal(body.kpis.tasks.overdueCount, 0);
    assert.equal(body.kpis.payments.overdueCount, 0);
    assert.equal(body.kpis.payments.upcomingCount, 1); // future-but-within-30 still surfaces as upcoming
  });
});
