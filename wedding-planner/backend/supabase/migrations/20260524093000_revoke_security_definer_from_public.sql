-- Postgres grants EXECUTE TO PUBLIC on every newly created function by default,
-- which means anon and authenticated inherit access even after a role-specific
-- revoke. The previous migration's revokes from anon/authenticated were no-ops
-- because the privilege came through PUBLIC, not those roles directly.
-- service_role has its own explicit GRANT (set up by Supabase) and is unaffected.

revoke execute on function public.bootstrap_wedding(uuid, uuid)
  from public;
revoke execute on function public.create_wedding_with_bootstrap(uuid, text, text, date, text)
  from public;
