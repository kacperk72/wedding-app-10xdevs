create or replace function public.guest_aggregates(p_wedding_id uuid)
returns table (
  "invited" bigint,
  "confirmed" bigint,
  "pending" bigint,
  "declined" bigint,
  "vegeOrVegan" bigint,
  "children" bigint,
  "noMealPick" bigint
)
language sql
security definer
set search_path = public
as $$
  select
    count(*) as "invited",
    count(*) filter (where rsvp_status = 'confirmed') as "confirmed",
    count(*) filter (where rsvp_status = 'pending') as "pending",
    count(*) filter (where rsvp_status = 'declined') as "declined",
    count(*) filter (where diet in ('vege', 'vegan')) as "vegeOrVegan",
    count(*) filter (where is_child) as "children",
    count(*) filter (where meal_option_id is null) as "noMealPick"
  from public.guests
  where wedding_id = p_wedding_id;
$$;

revoke all on function public.guest_aggregates(uuid) from public;
grant execute on function public.guest_aggregates(uuid) to service_role;
