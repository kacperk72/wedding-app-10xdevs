const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

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
          created_by_user_id: "user-a",
        },
      ],
      guests: [
        { id: "guest-1", wedding_id: "wedding-1", rsvp_status: "confirmed" },
        { id: "guest-2", wedding_id: "wedding-1", rsvp_status: "pending" },
        { id: "guest-3", wedding_id: "wedding-1", rsvp_status: "declined" },
      ],
      budget_categories: [
        { id: "budget-1", wedding_id: "wedding-1", planned_amount: 10000 },
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
          due_date: "2026-05-20",
          amount: 1000,
          status: "planned",
        },
        {
          id: "payment-2",
          contract_id: "contract-1",
          kind: "rata",
          due_date: "2026-06-10",
          amount: 2000,
          status: "planned",
        },
      ],
      tasks: [
        {
          id: "task-1",
          wedding_id: "wedding-1",
          title: "Podpisac umowe",
          due_date: "2026-05-10",
          done: false,
        },
        {
          id: "task-2",
          wedding_id: "wedding-1",
          title: "Gotowe",
          due_date: "2026-05-10",
          done: true,
        },
      ],
      meetings: [
        {
          id: "meeting-1",
          wedding_id: "wedding-1",
          vendor_id: "vendor-1",
          title: "Spotkanie z sala",
          starts_at: "2026-05-30T10:00:00.000Z",
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
