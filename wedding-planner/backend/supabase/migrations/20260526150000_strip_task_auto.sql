-- Remove auto-task machinery (2026-05-26 product decision):
-- Tasks become a plain manual TODO list. No templates, no auto generation,
-- no date-shift trigger, no is_auto/template_id columns.

-- 1. Drop the date-shift trigger and its function.
drop trigger if exists tg_weddings_shift_auto_tasks on weddings;
drop function if exists shift_auto_tasks_on_wedding_date_change();

-- 2. Drop the partial unique index that referenced template_id.
drop index if exists uq_tasks_wedding_template_auto;

-- 3. Drop FK column before dropping the parent table.
alter table tasks drop column if exists template_id;
alter table tasks drop column if exists is_auto;

-- 4. Drop the templates table — no longer used.
drop table if exists task_templates;

-- 5. Rewrite bootstrap_wedding without the task seeding step.
--    CREATE OR REPLACE preserves prior REVOKEs (added in M1+RLS lockdown).
create or replace function bootstrap_wedding(p_wedding_id uuid, p_creator_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_budget_count integer;
  v_table_count integer;
begin
  if not exists (select 1 from weddings where id = p_wedding_id) then
    raise exception 'wedding not found';
  end if;

  insert into wedding_members (wedding_id, user_id, role)
  values (p_wedding_id, p_creator_user_id, 'partner_a')
  on conflict do nothing;

  insert into budget_categories (wedding_id, name, planned_amount, sort_order)
  values
    (p_wedding_id, 'Sala weselna', 0, 1),
    (p_wedding_id, 'Catering', 0, 2),
    (p_wedding_id, 'Fotograf', 0, 3),
    (p_wedding_id, 'Kwiaty', 0, 4),
    (p_wedding_id, 'Dekoracje', 0, 5),
    (p_wedding_id, 'Muzyka / DJ', 0, 6),
    (p_wedding_id, 'Stylizacja panny młodej', 0, 7),
    (p_wedding_id, 'Stylizacja pana młodego', 0, 8),
    (p_wedding_id, 'USC / formalności', 0, 9),
    (p_wedding_id, 'Alkohol', 0, 10),
    (p_wedding_id, 'Tort', 0, 11),
    (p_wedding_id, 'Transport gości', 0, 12),
    (p_wedding_id, 'Hotel dla gości', 0, 13),
    (p_wedding_id, 'Obrączki', 0, 14),
    (p_wedding_id, 'Zaproszenia i papeteria', 0, 15)
  on conflict (wedding_id, name) do nothing;
  get diagnostics v_budget_count = row_count;

  insert into tables (wedding_id, name, seats_count, sort_order)
  select p_wedding_id, 'Stół ' || n::text, 8, n
    from generate_series(1, 12) as n
  on conflict (wedding_id, name) do nothing;
  get diagnostics v_table_count = row_count;

  return jsonb_build_object(
    'budgetCategories', v_budget_count,
    'tables', v_table_count,
    'tasks', 0
  );
end;
$$;

-- 6. Re-assert revokes in case CREATE OR REPLACE somehow reset them.
revoke execute on function public.bootstrap_wedding(uuid, uuid) from public;
revoke execute on function public.bootstrap_wedding(uuid, uuid) from anon, authenticated;
