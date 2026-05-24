-- RLS lockdown: enable row-level security on every public table and revoke
-- direct access to SECURITY DEFINER RPCs from anon/authenticated. The backend
-- talks to Postgres via service_role, which bypasses RLS, so application code
-- is unaffected. anon/authenticated are exposed via PostgREST only as a safety
-- net for accidental Data API exposure; with no policies defined, every read
-- and write through those roles is denied by default.

alter table public.users                        enable row level security;
alter table public.weddings                     enable row level security;
alter table public.wedding_members              enable row level security;
alter table public.partner_invitations          enable row level security;
alter table public.vendors                      enable row level security;
alter table public.contracts                    enable row level security;
alter table public.payments                     enable row level security;
alter table public.tables                       enable row level security;
alter table public.meal_options                 enable row level security;
alter table public.guests                       enable row level security;
alter table public.seating_conflicts            enable row level security;
alter table public.budget_categories            enable row level security;
alter table public.expenses                     enable row level security;
alter table public.task_templates               enable row level security;
alter table public.tasks                        enable row level security;
alter table public.meetings                     enable row level security;
alter table public.catering_offers              enable row level security;
alter table public.catering_packages            enable row level security;
alter table public.catering_courses             enable row level security;
alter table public.catering_dishes              enable row level security;
alter table public.catering_course_dishes       enable row level security;
alter table public.catering_addons              enable row level security;
alter table public.wedding_catering_selection   enable row level security;
alter table public.wedding_catering_dish_picks  enable row level security;
alter table public.wedding_catering_addon_picks enable row level security;

-- Only the backend (service_role) should call these. anon/authenticated are
-- exposed via /rest/v1/rpc/* by default — explicitly revoke EXECUTE so the
-- SECURITY DEFINER bit can't be leveraged through PostgREST.
revoke execute on function public.bootstrap_wedding(uuid, uuid)
  from anon, authenticated;
revoke execute on function public.create_wedding_with_bootstrap(uuid, text, text, date, text)
  from anon, authenticated;

-- Pin search_path on every custom function. Critical for SECURITY DEFINER ones
-- (prevents an attacker creating a same-named object in a writable schema to
-- hijack a reference); harmless on the trigger helpers.
alter function public.set_updated_at()
  set search_path = public, pg_catalog;
alter function public.shift_auto_tasks_on_wedding_date_change()
  set search_path = public, pg_catalog;
alter function public.enforce_seating_conflict_wedding_match()
  set search_path = public, pg_catalog;
alter function public.enforce_catering_course_dish_same_offer()
  set search_path = public, pg_catalog;
alter function public.enforce_catering_selection_package_wedding()
  set search_path = public, pg_catalog;
alter function public.enforce_catering_pick_consistency()
  set search_path = public, pg_catalog;
alter function public.bootstrap_wedding(uuid, uuid)
  set search_path = public, pg_catalog;
alter function public.create_wedding_with_bootstrap(uuid, text, text, date, text)
  set search_path = public, pg_catalog;
