const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { buildBootstrapRows } = require("../src/services/bootstrap-wedding");
const {
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_TABLES,
} = require("../src/seed/defaults");

describe("wedding bootstrap seed", () => {
  it("creates the documented starter rows for a new wedding", () => {
    const rows = buildBootstrapRows({
      weddingId: "wedding-1",
      creatorUserId: "user-1",
    });

    assert.equal(rows.member.role, "partner_a");
    assert.equal(rows.budgetCategories.length, DEFAULT_BUDGET_CATEGORIES.length);
    assert.equal(rows.tables.length, DEFAULT_TABLES.length);
    assert.equal(rows.tasks, undefined);
  });

  it("keeps the default seed size stable", () => {
    assert.equal(DEFAULT_BUDGET_CATEGORIES.length, 15);
    assert.equal(DEFAULT_TABLES.length, 12);
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
      "tg_seating_conflict_check",
      "tg_catering_course_dish_same_offer",
      "tg_wcdp_consistency",
    ]) {
      assert.ok(sql.includes(fragment), `${fragment} is present`);
    }
  });
});

describe("Partner invite RPC migration", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260524120000_accept_partner_invite_rpc.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("defines an atomic accept_partner_invite RPC with key guards", () => {
    for (const fragment of [
      "create or replace function accept_partner_invite",
      "for update",
      "insert into wedding_members",
      "set status = 'accepted'",
      "grant execute on function public.accept_partner_invite",
      "revoke execute on function public.accept_partner_invite",
    ]) {
      assert.ok(sql.includes(fragment), `${fragment} is present`);
    }
  });
});

describe("Create wedding RPC migration", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260524123000_create_wedding_with_bootstrap_json_errors.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("returns json errors instead of sniffable raised messages", () => {
    for (const fragment of [
      "create or replace function create_wedding_with_bootstrap",
      "return jsonb_build_object('status', 409, 'error', 'User already belongs to a wedding')",
      "exception",
      "when unique_violation then",
      "grant execute on function public.create_wedding_with_bootstrap",
      "revoke execute on function public.create_wedding_with_bootstrap",
    ]) {
      assert.ok(sql.includes(fragment), `${fragment} is present`);
    }
  });
});

describe("RPC execute grants hardening migration", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260524193000_revoke_rpc_execute_from_client_roles.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("revokes SECURITY DEFINER RPC execution from client roles", () => {
    for (const fragment of [
      "revoke execute on function public.accept_partner_invite(text, uuid)",
      "revoke execute on function public.guest_aggregates(uuid)",
      "revoke execute on function public.bootstrap_wedding(uuid, uuid)",
      "revoke execute on function public.create_wedding_with_bootstrap(uuid, text, text, date, text)",
      "from anon, authenticated",
    ]) {
      assert.ok(sql.includes(fragment), `${fragment} is present`);
    }
  });
});

describe("Strip task auto migration", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260526150000_strip_task_auto.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("drops the auto-task machinery", () => {
    for (const fragment of [
      "drop trigger if exists tg_weddings_shift_auto_tasks",
      "drop function if exists shift_auto_tasks_on_wedding_date_change",
      "drop index if exists uq_tasks_wedding_template_auto",
      "alter table tasks drop column if exists template_id",
      "alter table tasks drop column if exists is_auto",
      "drop table if exists task_templates",
      "create or replace function bootstrap_wedding",
    ]) {
      assert.ok(sql.includes(fragment), `${fragment} is present`);
    }
  });
});
