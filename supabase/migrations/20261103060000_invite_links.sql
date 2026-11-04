-- Invite links: every invite gets a secret token (/join/<token>) that can be
-- shared by WhatsApp or any channel. Accepting by link works with any email and
-- links the account to the exact member record the invite was made for.
-- Email-matching invites (claimed automatically at sign-up) keep working.

alter table public.invites
  add column token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  add column member_id  uuid references public.members (id) on delete cascade,
  add column expires_at timestamptz not null default now() + interval '30 days';

-- Link-only invites (e.g. members without an email) have no email.
alter table public.invites alter column email drop not null;

create unique index invites_open_member_unique on public.invites (member_id)
  where accepted_at is null and member_id is not null;

-- What the invite page shows before the visitor signs in. Anyone holding the
-- token may see it — the token is the secret.
create function public.invite_preview(p_token text)
returns table (gym_name text, role public.gym_role, member_name text, email text, expired boolean, accepted boolean)
language sql stable security definer set search_path = ''
as $$
  select g.name, i.role, m.full_name, coalesce(i.email, m.email), i.expires_at < now(), i.accepted_at is not null
    from public.invites i
    join public.gyms g on g.id = i.gym_id
    left join public.members m on m.id = i.member_id
   where i.token = p_token
$$;

-- Accepts an invite link for the signed-in user. Returns the role granted.
create function public.accept_invite(p_token text)
returns public.gym_role
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv      public.invites;
  v_existing public.gym_role;
  v_linked   uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select * into v_inv from public.invites where token = p_token for update;
  if v_inv.id is null then
    raise exception 'This invite link isn''t valid' using errcode = 'P0002';
  end if;

  select role into v_existing from public.gym_users where gym_id = v_inv.gym_id and user_id = auth.uid();

  if v_inv.accepted_at is not null then
    -- Already used — fine if it was this same person (e.g. claimed by email at sign-up).
    if v_existing is not null then
      return v_existing;
    end if;
    raise exception 'This invite link has already been used' using errcode = '22023';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'This invite link has expired. Ask the gym for a new one.' using errcode = '22023';
  end if;
  if v_existing is not null and v_existing <> v_inv.role then
    raise exception 'You''re already part of this gym as %', v_existing using errcode = '22023';
  end if;

  if v_inv.member_id is not null then
    select user_id into v_linked from public.members where id = v_inv.member_id for update;
    if v_linked is not null and v_linked <> auth.uid() then
      raise exception 'This membership is already linked to another account' using errcode = '22023';
    end if;
    if exists (select 1 from public.members where gym_id = v_inv.gym_id and user_id = auth.uid() and id <> v_inv.member_id) then
      raise exception 'Your account is already linked to another membership at this gym' using errcode = '22023';
    end if;
    -- Link first so the gym_users trigger finds this record instead of creating one.
    update public.members set user_id = auth.uid() where id = v_inv.member_id;
  end if;

  insert into public.gym_users (gym_id, user_id, role) values (v_inv.gym_id, auth.uid(), v_inv.role)
  on conflict (gym_id, user_id) do nothing;
  update public.invites set accepted_at = now() where id = v_inv.id;
  return v_inv.role;
end;
$$;

-- Front desk: get (or create) the open portal invite for a member. Returns the token.
create function public.member_invite_token(p_member_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_m     public.members;
  v_token text;
begin
  select * into v_m from public.members where id = p_member_id;
  if v_m.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if not public.can_handle_billing(v_m.gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_m.user_id is not null then
    raise exception 'This member already has portal access' using errcode = '22023';
  end if;

  -- Reuse a live invite for this member, or an email invite made earlier.
  update public.invites set member_id = v_m.id, expires_at = greatest(expires_at, now() + interval '30 days')
   where gym_id = v_m.gym_id and accepted_at is null and role = 'member'
     and (member_id = v_m.id or (member_id is null and v_m.email is not null and email = v_m.email))
  returning token into v_token;
  if v_token is not null then
    return v_token;
  end if;

  insert into public.invites (gym_id, email, role, invited_by, member_id)
  values (v_m.gym_id, v_m.email, 'member', auth.uid(), v_m.id)
  returning token into v_token;
  return v_token;
end;
$$;

revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
revoke execute on function public.member_invite_token(uuid) from public, anon;
grant execute on function public.member_invite_token(uuid) to authenticated;
