alter table public.budget_categories
  drop column if exists planned_amount;

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

  insert into budget_categories (wedding_id, name, sort_order)
  values
    (p_wedding_id, 'Sala weselna', 1),
    (p_wedding_id, 'Catering', 2),
    (p_wedding_id, 'Fotograf', 3),
    (p_wedding_id, 'Kwiaty', 4),
    (p_wedding_id, 'Dekoracje', 5),
    (p_wedding_id, 'Muzyka / DJ', 6),
    (p_wedding_id, 'Stylizacja panny mlodej', 7),
    (p_wedding_id, 'Stylizacja pana mlodego', 8),
    (p_wedding_id, 'USC / formalnosci', 9),
    (p_wedding_id, 'Alkohol', 10),
    (p_wedding_id, 'Tort', 11),
    (p_wedding_id, 'Transport gosci', 12),
    (p_wedding_id, 'Hotel dla gosci', 13),
    (p_wedding_id, 'Obraczki', 14),
    (p_wedding_id, 'Zaproszenia i papeteria', 15)
  on conflict (wedding_id, name) do nothing;
  get diagnostics v_budget_count = row_count;

  insert into tables (wedding_id, name, seats_count, sort_order)
  select p_wedding_id, 'Stol ' || n::text, 8, n
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

revoke execute on function public.bootstrap_wedding(uuid, uuid) from public;
revoke execute on function public.bootstrap_wedding(uuid, uuid) from anon, authenticated;
