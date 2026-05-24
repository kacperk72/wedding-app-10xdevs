-- Supabase/PostgREST may keep explicit EXECUTE grants for client roles even
-- when EXECUTE was revoked from PUBLIC. Keep SECURITY DEFINER RPCs service-role only.
revoke execute on function public.accept_partner_invite(text, uuid)
  from anon, authenticated;

revoke execute on function public.guest_aggregates(uuid)
  from anon, authenticated;

revoke execute on function public.bootstrap_wedding(uuid, uuid)
  from anon, authenticated;

revoke execute on function public.create_wedding_with_bootstrap(uuid, text, text, date, text)
  from anon, authenticated;
