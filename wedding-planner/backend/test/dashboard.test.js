const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

// Seed dates are pinned relative to "now" so the overdue/upcoming/meeting
// windows keep their intended relationships no matter when the suite runs.
// (Previously hardcoded dates rotted past the filter windows and went red.)
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysFromNow = (days) => new Date(Date.now() + days * DAY_MS).toISOString();
const dateDaysFromNow = (days) => isoDaysFromNow(days).slice(0, 10);

describe("dashboard aggregate", () => {
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
          budget_total: 10000,
          created_by_user_id: "user-a",
        },
      ],
      guests: [
        { id: "guest-1", wedding_id: "wedding-1", rsvp_status: "confirmed" },
        { id: "guest-2", wedding_id: "wedding-1", rsvp_status: "pending" },
        { id: "guest-3", wedding_id: "wedding-1", rsvp_status: "declined" },
      ],
      expenses: [{ id: "expense-1", wedding_id: "wedding-1", amount: 2500 }],
      vendors: [
        {
          id: "vendor-1",
          wedding_id: "wedding-1",
          category: "sala",
          company_name: "Palac",
          status: "zarezerwowany",
        },
      ],
      contracts: [
        { id: "contract-1", wedding_id: "wedding-1", vendor_id: "vendor-1" },
      ],
      payments: [
        {
          id: "payment-1",
          contract_id: "contract-1",
          kind: "zaliczka",
          due_date: dateDaysFromNow(-11),
          amount: 1000,
          status: "planned",
        },
        {
          id: "payment-2",
          contract_id: "contract-1",
          kind: "rata",
          due_date: dateDaysFromNow(10),
          amount: 2000,
          status: "planned",
        },
      ],
      tasks: [
        {
          id: "task-1",
          wedding_id: "wedding-1",
          title: "Podpisac umowe",
          due_date: dateDaysFromNow(-21),
          done: false,
        },
        {
          id: "task-2",
          wedding_id: "wedding-1",
          title: "Gotowe",
          due_date: dateDaysFromNow(-21),
          done: true,
        },
      ],
      meetings: [
        {
          id: "meeting-1",
          wedding_id: "wedding-1",
          vendor_id: "vendor-1",
          title: "Spotkanie z sala",
          starts_at: isoDaysFromNow(1),
          notes: "Menu",
        },
      ],
    });
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("returns KPI, attention items, and upcoming meetings", async () => {
    const response = await request(server, "GET", "/api/weddings/wedding-1/dashboard");

    assert.equal(response.status, 200);
    assert.equal(response.body.kpis.guests.invited, 3);
    assert.equal(response.body.kpis.guests.confirmed, 1);
    assert.equal(response.body.kpis.budget.plannedTotal, 10000);
    assert.equal(response.body.kpis.budget.spentTotal, 2500);
    assert.equal(response.body.kpis.payments.upcomingCount, 1);
    assert.equal(response.body.kpis.payments.overdueCount, 1);
    assert.equal(response.body.kpis.tasks.overdueCount, 1);
    assert.equal(response.body.attentionItems.length, 5);
    assert.equal(response.body.attentionItems[0].type, "task");
    assert.equal(response.body.upcomingMeetings[0].vendorName, "Palac");
  });
});
