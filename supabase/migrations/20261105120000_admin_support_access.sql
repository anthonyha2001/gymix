-- Super admin tools: open any gym's dashboard as its owner (support access),
-- keep the WhatsApp keys, and announce something to every gym.

-- The gym a super admin is currently helping. While a row exists they act as
-- that gym's owner; leaving deletes it. One gym at a time.
create table public.platform_admin_visits (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.platform_admin_visits enable row level security;
create policy "Admins read their own visit" on public.platform_admin_visits
  for select to authenticated using (user_id = auth.uid());

-- Every permission check goes through this: a visiting super admin is the owner.
create or replace function public.my_gym_role(p_gym_id uuid)
returns public.gym_role
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role from public.gym_users where gym_id = p_gym_id and user_id = auth.uid()),
    (select 'owner'::public.gym_role from public.platform_admin_visits v
      where v.user_id = auth.uid() and v.gym_id = p_gym_id and public.is_platform_admin())
  )
$$;

-- Secrets only the server reads (service role); no policies on purpose.
create table public.platform_secrets (
  id                        boolean primary key default true check (id),
  whatsapp_token            text not null default '',
  whatsapp_phone_number_id  text not null default '',
  updated_at                timestamptz not null default now()
);
insert into public.platform_secrets (id) values (true);
alter table public.platform_secrets enable row level security;
revoke all on public.platform_secrets from anon, authenticated;

-- An announcement from Gymix to the people of every gym (bell notification).
-- p_audience: 'staff' (owners and team) or 'everyone' (members too).
create function public.admin_broadcast(p_title text, p_body text, p_audience text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Write a title' using errcode = '22023';
  end if;
  insert into public.notifications (gym_id, user_id, kind, title, body)
  select gu.gym_id, gu.user_id, 'announcement', left(trim(p_title), 120), nullif(left(trim(coalesce(p_body, '')), 300), '')
    from public.gym_users gu
   where p_audience = 'everyone' or gu.role <> 'member';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.admin_broadcast(text, text, text) from public, anon;
grant execute on function public.admin_broadcast(text, text, text) to authenticated;
