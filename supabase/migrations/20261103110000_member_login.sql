-- Members log in with a generated password and whatever they know: their
-- email, their phone number, or their member (check-in) code.

-- Lebanese-style phone normalisation: digits only, without 00961/+961/961 or a
-- leading 0, so "71 123 456", "071123456" and "+961 71 123 456" all match.
create function public.normalize_phone(p text)
returns text
language sql immutable set search_path = ''
as $$
  select nullif(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^(00)?961', ''), '^0+', ''), '')
$$;

-- The account email to sign in with, for an email / phone / member code.
-- Null when unknown or ambiguous (the same phone on two accounts). Only the
-- server (service role) may call this, so it can't be used to look people up.
create function public.member_login_email(p_identifier text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id    text := trim(coalesce(p_identifier, ''));
  v_users uuid[];
begin
  if v_id = '' then
    return null;
  end if;
  if position('@' in v_id) > 0 then
    return lower(v_id);
  end if;

  select array_agg(distinct m.user_id) into v_users
    from public.members m
   where m.user_id is not null and upper(m.checkin_code) = upper(v_id);

  if coalesce(cardinality(v_users), 0) = 0 and public.normalize_phone(v_id) is not null then
    select array_agg(distinct m.user_id) into v_users
      from public.members m
     where m.user_id is not null and public.normalize_phone(m.phone) = public.normalize_phone(v_id);
  end if;

  if coalesce(cardinality(v_users), 0) <> 1 then
    return null;
  end if;
  return (select email from auth.users where id = v_users[1]);
end;
$$;

revoke execute on function public.member_login_email(text) from public, anon, authenticated;
grant execute on function public.normalize_phone(text) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.member_login_email(text) to service_role;
  end if;
end;
$$;
