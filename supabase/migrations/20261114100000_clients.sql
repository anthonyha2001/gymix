-- Onboarding paying gyms by hand (control room → Clients): the super admin
-- creates the owner's login (server, service role), then this makes their gym
-- with them as owner. welcome_sent_at records when their login was sent
-- (by WhatsApp Business, from the control room).

alter table public.gyms add column welcome_sent_at timestamptz;

create function public.admin_provision_gym(p_owner uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym uuid;
  v_base text;
  v_slug text;
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from public.profiles where id = p_owner) then
    raise exception 'That person has no Gymix account';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give the gym a name';
  end if;
  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then
    v_base := 'gym';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.gyms where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 5);
  end loop;
  insert into public.gyms (name, slug, created_by) values (trim(p_name), v_slug, p_owner) returning id into v_gym;
  insert into public.gym_users (gym_id, user_id, role) values (v_gym, p_owner, 'owner');
  return v_gym;
end;
$$;
revoke execute on function public.admin_provision_gym(uuid, text) from public, anon;
grant execute on function public.admin_provision_gym(uuid, text) to authenticated;

create function public.admin_mark_welcome_sent(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  update public.gyms set welcome_sent_at = now() where id = p_gym_id;
end;
$$;
revoke execute on function public.admin_mark_welcome_sent(uuid) from public, anon;
grant execute on function public.admin_mark_welcome_sent(uuid) to authenticated;

-- ------------------------------------------------------------ access requests
-- Gyms ask for Gymix on the website (/request). The super admin sends them
-- the payment details on WhatsApp, confirms the payment, and sends their
-- login. Self-serve sign-up stays off unless platform_settings.open_signup.
alter table public.platform_settings add column open_signup boolean not null default false;

create table public.access_requests (
  id              uuid primary key default gen_random_uuid(),
  owner_name      text not null check (char_length(trim(owner_name)) between 2 and 80),
  phone           text not null check (char_length(phone) between 6 and 30),
  email           text not null check (char_length(email) between 5 and 120),
  gym_name        text not null check (char_length(trim(gym_name)) between 2 and 80),
  city            text check (char_length(city) <= 80),
  members         text check (members in ('<50', '50-150', '150-400', '400+')),
  message         text check (char_length(message) <= 1000),
  source          text check (char_length(source) <= 120),
  status          text not null default 'new' check (status in ('new', 'contacted', 'paid', 'declined')),
  notes           text check (char_length(notes) <= 2000),
  gym_id          uuid references public.gyms (id) on delete set null,
  created_at      timestamptz not null default now(),
  contacted_at    timestamptz,
  paid_at         timestamptz,
  welcome_sent_at timestamptz
);
create index access_requests_status_idx on public.access_requests (status, created_at desc);
alter table public.access_requests enable row level security;
create policy access_requests_admin on public.access_requests for select using (public.is_platform_admin());
grant select on public.access_requests to authenticated;

-- Anyone (signed in or not) asks for Gymix. At most 3 a day per phone.
create function public.submit_access_request(p_owner_name text, p_phone text, p_email text, p_gym_name text, p_city text default null, p_members text default null, p_message text default null, p_source text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select count(*) from public.access_requests where phone = trim(p_phone) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'We already have your request. We''ll reach you on WhatsApp soon.';
  end if;
  insert into public.access_requests (owner_name, phone, email, gym_name, city, members, message, source)
  values (trim(p_owner_name), trim(p_phone), lower(trim(p_email)), trim(p_gym_name), nullif(trim(coalesce(p_city, '')), ''), p_members,
          nullif(trim(coalesce(p_message, '')), ''), left(p_source, 120))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.submit_access_request(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_access_request(text, text, text, text, text, text, text, text) to anon, authenticated;

-- Super admins move a request along.
create function public.admin_update_request(p_id uuid, p_status text default null, p_notes text default null, p_gym_id uuid default null, p_welcome_sent boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  update public.access_requests
     set status = coalesce(p_status, status),
         contacted_at = case when p_status = 'contacted' then coalesce(contacted_at, now()) else contacted_at end,
         paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
         notes = coalesce(p_notes, notes),
         gym_id = coalesce(p_gym_id, gym_id),
         welcome_sent_at = case when p_welcome_sent then now() else welcome_sent_at end
   where id = p_id;
end;
$$;
revoke execute on function public.admin_update_request(uuid, text, text, uuid, boolean) from public, anon;
grant execute on function public.admin_update_request(uuid, text, text, uuid, boolean) to authenticated;
