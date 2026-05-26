const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("budget and expenses", () => {
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
          budget_total: null,
          created_by_user_id: "user-a",
        },
      ],
      budget_categories: [
        { id: "cat-1", wedding_id: "wedding-1", name: "Sala", sort_order: 1 },
        { id: "cat-2", wedding_id: "wedding-1", name: "Fotograf", sort_order: 2 },
        { id: "foreign-cat", wedding_id: "wedding-2", name: "Foreign", sort_order: 1 },
      ],
      vendors: [
        {
          id: "vendor-1",
          wedding_id: "wedding-1",
          category: "sala",
          company_name: "Palac",
          status: "zarezerwowany",
        },
        {
          id: "foreign-vendor",
          wedding_id: "wedding-2",
          category: "sala",
          company_name: "Foreign",
          status: "zarezerwowany",
        },
      ],
      expenses: [],
    });
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("updates wedding budgetTotal", async () => {
    const response = await request(server, "PATCH", "/api/weddings/wedding-1", {
      budgetTotal: 50000,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.budgetTotal, 50000);
    assert.equal(db.weddings[0].budget_total, 50000);
  });

  it("creates an expense", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/expenses", {
      categoryId: "cat-1",
      vendorId: "vendor-1",
      amount: 1200,
      spentOn: "2026-05-26",
      description: "Zaliczka za sale",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.amount, 1200);
    assert.equal(response.body.vendorName, "Palac");
    assert.equal(db.expenses.length, 1);
  });

  it("rejects cross-wedding categoryId", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/expenses", {
      categoryId: "foreign-cat",
      amount: 100,
      spentOn: "2026-05-26",
      description: "Bad",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "categoryId does not belong to this wedding");
  });

  it("rejects cross-wedding vendorId", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/expenses", {
      categoryId: "cat-1",
      vendorId: "foreign-vendor",
      amount: 100,
      spentOn: "2026-05-26",
      description: "Bad",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "vendorId does not belong to this wedding");
  });

  it("rejects negative amounts", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/expenses", {
      categoryId: "cat-1",
      amount: -1,
      spentOn: "2026-05-26",
      description: "Bad",
    });

    assert.equal(response.status, 400);
  });

  it("returns summary with spent and remaining", async () => {
    db.weddings[0].budget_total = 50000;
    db.expenses.push(
      {
        id: "expense-1",
        wedding_id: "wedding-1",
        category_id: "cat-1",
        vendor_id: null,
        amount: 1000,
        spent_on: "2026-05-24",
        description: "A",
      },
      {
        id: "expense-2",
        wedding_id: "wedding-1",
        category_id: "cat-2",
        vendor_id: null,
        amount: 2500,
        spent_on: "2026-05-25",
        description: "B",
      },
      {
        id: "expense-3",
        wedding_id: "wedding-1",
        category_id: "cat-1",
        vendor_id: null,
        amount: 500,
        spent_on: "2026-05-26",
        description: "C",
      },
    );

    const response = await request(server, "GET", "/api/weddings/wedding-1/budget/summary");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      budgetTotal: 50000,
      spent: 4000,
      remaining: 46000,
      expensesCount: 3,
    });
  });

  it("returns null remaining when budgetTotal is null", async () => {
    db.expenses.push({
      id: "expense-1",
      wedding_id: "wedding-1",
      category_id: "cat-1",
      vendor_id: null,
      amount: 1000,
      spent_on: "2026-05-24",
      description: "A",
    });

    const response = await request(server, "GET", "/api/weddings/wedding-1/budget/summary");

    assert.equal(response.status, 200);
    assert.equal(response.body.budgetTotal, null);
    assert.equal(response.body.remaining, null);
    assert.equal(response.body.spent, 1000);
  });

  it("filters expenses by categoryId", async () => {
    db.expenses.push(
      {
        id: "expense-1",
        wedding_id: "wedding-1",
        category_id: "cat-1",
        vendor_id: null,
        amount: 1000,
        spent_on: "2026-05-24",
        description: "A",
      },
      {
        id: "expense-2",
        wedding_id: "wedding-1",
        category_id: "cat-2",
        vendor_id: null,
        amount: 2500,
        spent_on: "2026-05-25",
        description: "B",
      },
    );

    const response = await request(
      server,
      "GET",
      "/api/weddings/wedding-1/expenses?categoryId=cat-1",
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].categoryId, "cat-1");
  });

  it("patches an expense", async () => {
    db.expenses.push({
      id: "expense-1",
      wedding_id: "wedding-1",
      category_id: "cat-1",
      vendor_id: null,
      amount: 1000,
      spent_on: "2026-05-24",
      description: "A",
    });

    const response = await request(server, "PATCH", "/api/weddings/wedding-1/expenses/expense-1", {
      categoryId: "cat-2",
      amount: 1500,
      description: "Po zmianie",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.categoryId, "cat-2");
    assert.equal(response.body.amount, 1500);
    assert.equal(response.body.description, "Po zmianie");
  });

  it("deletes an expense and summary updates", async () => {
    db.weddings[0].budget_total = 5000;
    db.expenses.push(
      {
        id: "expense-1",
        wedding_id: "wedding-1",
        category_id: "cat-1",
        vendor_id: null,
        amount: 1000,
        spent_on: "2026-05-24",
        description: "A",
      },
      {
        id: "expense-2",
        wedding_id: "wedding-1",
        category_id: "cat-2",
        vendor_id: null,
        amount: 1500,
        spent_on: "2026-05-25",
        description: "B",
      },
    );

    const removed = await request(server, "DELETE", "/api/weddings/wedding-1/expenses/expense-1");
    assert.equal(removed.status, 204);

    const summary = await request(server, "GET", "/api/weddings/wedding-1/budget/summary");
    assert.equal(summary.status, 200);
    assert.equal(summary.body.spent, 1500);
    assert.equal(summary.body.remaining, 3500);
  });
});
