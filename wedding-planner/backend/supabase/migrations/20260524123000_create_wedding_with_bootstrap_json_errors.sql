create or replace function create_wedding_with_bootstrap(
  p_creator_user_id uuid,
  p_partner_a_name text,
  p_partner_b_name text,
  p_wedding_date date,
  p_ceremony_location text default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_wedding weddings%rowtype;
  v_bootstrap jsonb;
begin
  if exists (select 1 from wedding_members where user_id = p_creator_user_id) then
    return jsonb_build_object('status', 409, 'error', 'User already belongs to a wedding');
  end if;

  insert into weddings (
    partner_a_name,
    partner_b_name,
    wedding_date,
    ceremony_location,
    created_by_user_id
  )
  values (
    p_partner_a_name,
    p_partner_b_name,
    p_wedding_date,
    p_ceremony_location,
    p_creator_user_id
  )
  returning * into v_wedding;

  v_bootstrap := bootstrap_wedding(v_wedding.id, p_creator_user_id);

  return jsonb_build_object(
    'id', v_wedding.id,
    'partnerAName', v_wedding.partner_a_name,
    'partnerBName', v_wedding.partner_b_name,
    'weddingDate', v_wedding.wedding_date,
    'ceremonyLocation', v_wedding.ceremony_location,
    'createdByUserId', v_wedding.created_by_user_id,
    'bootstrap', v_bootstrap
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 409, 'error', 'User already belongs to a wedding');
end;
$$;

alter function public.create_wedding_with_bootstrap(uuid, text, text, date, text)
  set search_path = public, pg_catalog;

grant execute on function public.create_wedding_with_bootstrap(uuid, text, text, date, text)
  to service_role;

revoke execute on function public.create_wedding_with_bootstrap(uuid, text, text, date, text)
  from public;
