-- MUST mirror test/helpers/mock-supabase.js acceptPartnerInvite until a real
-- database-backed integration test replaces the in-memory RPC mock.
create or replace function accept_partner_invite(
  p_token text,
  p_user_id uuid
)
returns jsonb language plpgsql security definer as $$
declare
  v_invitation partner_invitations%rowtype;
  v_membership wedding_members%rowtype;
begin
  select *
    into v_invitation
    from partner_invitations
   where token = p_token
   for update;

  if not found then
    return jsonb_build_object('status', 400, 'error', 'Invalid invite token');
  end if;

  if v_invitation.status <> 'pending' then
    return jsonb_build_object('status', 409, 'error', 'Invite is no longer pending');
  end if;

  if v_invitation.expires_at <= now() then
    update partner_invitations
       set status = 'expired'
     where id = v_invitation.id
       and status = 'pending';

    return jsonb_build_object('status', 400, 'error', 'Invite token has expired');
  end if;

  if exists (select 1 from wedding_members where user_id = p_user_id) then
    return jsonb_build_object('status', 409, 'error', 'User already belongs to a wedding');
  end if;

  if exists (
    select 1
      from wedding_members
     where wedding_id = v_invitation.wedding_id
       and role = 'partner_b'
  ) then
    return jsonb_build_object('status', 409, 'error', 'Wedding already has partner_b linked');
  end if;

  insert into wedding_members (wedding_id, user_id, role)
  values (v_invitation.wedding_id, p_user_id, 'partner_b')
  returning * into v_membership;

  update partner_invitations
     set status = 'accepted',
         accepted_at = now()
   where id = v_invitation.id;

  return jsonb_build_object(
    'weddingId', v_membership.wedding_id,
    'weddingMembership', jsonb_build_object(
      'weddingId', v_membership.wedding_id,
      'role', v_membership.role,
      'linkedAt', v_membership.linked_at
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('status', 409, 'error', 'Invite could not be accepted');
end;
$$;

alter function public.accept_partner_invite(text, uuid)
  set search_path = public, pg_catalog;

grant execute on function public.accept_partner_invite(text, uuid)
  to service_role;

revoke execute on function public.accept_partner_invite(text, uuid)
  from public;
