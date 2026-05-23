const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const {
  addDays,
  buildBootstrapRows,
} = require("../src/services/bootstrap-wedding");
const {
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TABLES,
  TASK_TEMPLATES,
} = require("../src/seed/defaults");

describe("wedding bootstrap seed", () => {
  it("creates the documented starter rows for a new wedding", () => {
    const rows = buildBootstrapRows({
      weddingId: "wedding-1",
      creatorUserId: "user-1",
      weddingDate: "2026-07-25",
      templates: [
        {
          id: "template-1",
          title: "Wybor menu z cateringiem",
          category: "kontrahent",
          days_before_wedding: 90,
        },
      ],
    });

    assert.equal(rows.member.role, "partner_a");
    assert.equal(rows.budgetCategories.length, DEFAULT_BUDGET_CATEGORIES.length);
    assert.equal(rows.tables.length, DEFAULT_TABLES.length);
    assert.equal(rows.tasks.length, 1);
    assert.equal(rows.tasks[0].due_date, "2026-04-26");
    assert.equal(rows.tasks[0].is_auto, true);
  });

  it("keeps the default seed size stable", () => {
    assert.equal(DEFAULT_BUDGET_CATEGORIES.length, 15);
    assert.equal(DEFAULT_TABLES.length, 12);
    assert.ok(TASK_TEMPLATES.length >= 10);
  });

  it("subtracts days in UTC date-only form", () => {
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
});

describe("Supabase migration", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260523233000_m1_schema_and_seed.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("defines the M1 schema tables and atomic bootstrap RPC", () => {
    for (const fragment of [
      "create table users",
      "create table weddings",
      "create table wedding_members",
      "create table guests",
      "create table vendors",
      "create table contracts",
      "create table budget_categories",
      "create table tasks",
      "create table catering_offers",
      "create table wedding_catering_selection",
      "create or replace function bootstrap_wedding",
      "create or replace function create_wedding_with_bootstrap",
    ]) {
      assert.ok(sql.includes(fragment), `${fragment} is present`);
    }
  });

  it("keeps critical database guards in SQL", () => {
    for (const fragment of [
      "tg_weddings_shift_auto_tasks",
      "tg_seating_conflict_check",
      "tg_catering_course_dish_same_offer",
      "tg_wcdp_consistency",
      "on conflict (title) do update",
    ]) {
      assert.ok(sql.includes(fragment), `${fragment} is present`);
    }
  });
});
