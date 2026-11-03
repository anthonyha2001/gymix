-- Gymix foundation: gyms, profiles, roles, invites.
--
-- Multi-tenancy model: every gym-owned row carries a gym_id, and RLS checks the
-- caller's role in that gym via gym_users. Mutations that need to bypass RLS
-- (creating a gym, claiming invites) go through SECURITY DEFINER functions.


create type public.gym_role as enum ('owner', 'manager', 'front_desk', 'trainer', 'member');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 80),
  slug        text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  -- Copied from auth.users (kept in sync by trigger) so staff can see it via RLS.
  email       text not null default '',
  full_name   text not null default '' check (char_length(full_name) <= 120),
  phone       text check (char_length(phone) <= 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One role per user per gym. References profiles (which cascades from auth.users)
-- so the API can embed a person's name/email alongside their role.
create table public.gym_users (
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.gym_role not null,
  created_at  timestamptz not null default now(),
  primary key (gym_id, user_id)
);

create index gym_users_user_id_idx on public.gym_users (user_id);

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  -- Stored lowercased so matching against auth emails is a plain equality.
  email        text not null check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role         public.gym_role not null check (role <> 'owner'),
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);

-- At most one open invite per email per gym.
create unique index invites_open_unique on public.invites (gym_id, email) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies on gym_users don't recurse)
-- ---------------------------------------------------------------------------

create function public.my_gym_role(p_gym_id uuid)
returns public.gym_role
language sql stable security definer set search_path = ''
as $$
  select role from public.gym_users where gym_id = p_gym_id and user_id = auth.uid()
$$;

create function public.is_gym_staff(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_gym_role(p_gym_id) <> 'member', false)
$$;

-- Who may invite / assign which role:
--   owner      -> anyone except owner
--   manager    -> front_desk, trainer, member
--   front_desk -> member
create function public.can_assign_role(p_gym_id uuid, p_role public.gym_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case public.my_gym_role(p_gym_id)
    when 'owner'      then p_role <> 'owner'
    when 'manager'    then p_role in ('front_desk', 'trainer', 'member')
    when 'front_desk' then p_role = 'member'
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.gyms      enable row level security;
alter table public.profiles  enable row level security;
alter table public.gym_users enable row level security;
alter table public.invites   enable row level security;

-- Column-level limits on top of RLS: only these columns are ever client-editable.
revoke update on public.gyms, public.profiles, public.gym_users, public.invites from anon, authenticated;
revoke insert on public.gyms, public.profiles, public.gym_users from anon, authenticated;
revoke all on public.gyms, public.profiles, public.gym_users, public.invites from anon;
grant update (name) on public.gyms to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant update (role) on public.gym_users to authenticated;

-- gyms: visible to anyone in the gym; editable by the owner. Created via create_gym().
create policy gyms_select on public.gyms for select
  using (public.my_gym_role(id) is not null);
create policy gyms_update on public.gyms for update
  using (public.my_gym_role(id) = 'owner')
  with check (public.my_gym_role(id) = 'owner');

-- profiles: you see your own, and staff see profiles of people in their gym.
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.gym_users gu
      where gu.user_id = profiles.id and public.is_gym_staff(gu.gym_id)
    )
  );
create policy profiles_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- gym_users: you see your own rows; staff see the whole gym roster.
create policy gym_users_select on public.gym_users for select
  using (user_id = auth.uid() or public.is_gym_staff(gym_id));
-- Changing a role: you must be allowed to assign both the old and the new role.
create policy gym_users_update on public.gym_users for update
  using (user_id <> auth.uid() and public.can_assign_role(gym_id, role))
  with check (public.can_assign_role(gym_id, role));
create policy gym_users_delete on public.gym_users for delete
  using (user_id <> auth.uid() and public.can_assign_role(gym_id, role));

-- invites: staff who could assign the role can see/create/cancel the invite.
create policy invites_select on public.invites for select
  using (public.is_gym_staff(gym_id));
create policy invites_insert on public.invites for insert
  with check (public.can_assign_role(gym_id, role) and invited_by = auth.uid() and accepted_at is null);
create policy invites_delete on public.invites for delete
  using (accepted_at is null and public.can_assign_role(gym_id, role));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Turns any open invites for the given user's email into gym memberships.
create function public.claim_invites_for(p_user_id uuid, p_email text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  claimed integer;
begin
  with open_invites as (
    update public.invites
       set accepted_at = now()
     where email = lower(p_email) and accepted_at is null
    returning gym_id, role
  )
  insert into public.gym_users (gym_id, user_id, role)
  select gym_id, p_user_id, role from open_invites
  on conflict (gym_id, user_id) do nothing;

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

-- Callable by a logged-in user to pick up invites sent after they signed up.
create function public.claim_my_invites()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return 0;
  end if;
  return public.claim_invites_for(auth.uid(), v_email);
end;
$$;

-- New auth user -> profile + any pending invites.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120)
  );

  if new.email is not null then
    perform public.claim_invites_for(new.id, new.email);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Creates a gym with the caller as owner. Returns the new gym id.
create function public.create_gym(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_base   text;
  v_slug   text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then
    v_base := 'gym';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.gyms where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;

  insert into public.gyms (name, slug, created_by)
  values (trim(p_name), v_slug, auth.uid())
  returning id into v_gym_id;

  insert into public.gym_users (gym_id, user_id, role)
  values (v_gym_id, auth.uid(), 'owner');

  return v_gym_id;
end;
$$;

-- Internal helpers aren't meant to be called directly over the API.
revoke execute on function public.claim_invites_for(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.create_gym(text) from public, anon;
revoke execute on function public.claim_my_invites() from public, anon;
grant execute on function public.create_gym(text) to authenticated;
grant execute on function public.claim_my_invites() to authenticated;
