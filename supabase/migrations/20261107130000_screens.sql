-- Gymix Screens: TVs and tablets at the gym showing rotating slides.
--
--   screens        each display, opened by its secret link (/screen/<token>)
--   screen_slides  what they show, in order: today's classes, a check-in
--                  leaderboard, the week's personal records, live occupancy,
--                  and the gym's own announcements and promotions (with an
--                  optional image). Each slide can be limited to some screens,
--                  dates, weekdays and times of day.
--   screen_feed()  everything one screen should show right now (server only).
--
-- Members appear by first name and last initial, and can opt out from their
-- profile (members.show_on_screens).

alter table public.members add column show_on_screens boolean not null default true;
grant update (show_on_screens) on public.members to authenticated;

-- A member's own choice (members can't edit their member row otherwise).
create function public.set_show_on_screens(p_gym_id uuid, p_show boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.members set show_on_screens = coalesce(p_show, true)
   where gym_id = p_gym_id and user_id = auth.uid();
  if not found then
    raise exception 'Not a member of this gym' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.set_show_on_screens(uuid, boolean) from public, anon;
grant execute on function public.set_show_on_screens(uuid, boolean) to authenticated;

create table public.screens (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 60),
  token         text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  orientation   text not null default 'landscape' check (orientation in ('landscape', 'portrait')),
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index screens_gym_idx on public.screens (gym_id);

create table public.screen_slides (
  id                uuid primary key default gen_random_uuid(),
  gym_id            uuid not null references public.gyms (id) on delete cascade,
  kind              text not null check (kind in ('announcement', 'promo', 'schedule', 'leaderboard', 'achievements', 'occupancy')),
  title             text check (char_length(title) <= 80),
  body              text check (char_length(body) <= 300),
  image_path        text check (char_length(image_path) <= 300),
  theme             text not null default 'dark' check (theme in ('dark', 'lime', 'light')),
  duration_seconds  integer not null default 12 check (duration_seconds between 5 and 60),
  -- When it shows (all optional): dates, weekdays (0 = Sunday), times of day.
  starts_on         date,
  ends_on           date,
  weekdays          smallint[] check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  time_from         time,
  time_to           time,
  -- Null: every screen.
  screen_ids        uuid[],
  position          integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (kind not in ('announcement', 'promo') or coalesce(trim(title), '') <> '')
);
create index screen_slides_gym_idx on public.screen_slides (gym_id, position);

alter table public.screens enable row level security;
alter table public.screen_slides enable row level security;
create policy screens_select on public.screens for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy screens_write on public.screens for all to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy screen_slides_select on public.screen_slides for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy screen_slides_write on public.screen_slides for all to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
revoke insert, update on public.screens from authenticated;
grant insert (gym_id, name, orientation, is_active) on public.screens to authenticated;
grant update (name, orientation, is_active) on public.screens to authenticated;

-- "Nour K."
create function public.screen_name(p_full_name text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when position(' ' in trim(p_full_name)) = 0 then trim(p_full_name)
    else split_part(trim(p_full_name), ' ', 1) || ' ' || upper(left(split_part(trim(p_full_name), ' ', array_length(regexp_split_to_array(trim(p_full_name), '\s+'), 1)), 1)) || '.'
  end
$$;

-- Everything a screen shows right now. Null for an unknown or switched-off screen.
create function public.screen_feed(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_screen  public.screens;
  v_gym     public.gyms;
  v_now     timestamp;
  v_today   date;
  v_month   timestamptz;
  v_week    timestamptz;
  v_slides  jsonb;
begin
  select * into v_screen from public.screens where token = p_token;
  if not found or not v_screen.is_active then return null; end if;
  select * into v_gym from public.gyms where id = v_screen.gym_id;
  update public.screens set last_seen_at = now() where id = v_screen.id;
  v_now := now() at time zone v_gym.timezone;
  v_today := v_now::date;
  v_month := date_trunc('month', v_now) at time zone v_gym.timezone;
  v_week := (v_now - interval '7 days') at time zone v_gym.timezone;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', s.id, 'kind', s.kind, 'title', s.title, 'body', s.body, 'image_path', s.image_path,
             'theme', s.theme, 'duration', s.duration_seconds,
             'data', case s.kind
               when 'schedule' then (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'name', c.name, 'time', to_char(c.start_time, 'HH24:MI'), 'minutes', c.duration_min,
                          'location', c.location, 'trainer', public.screen_name(p.full_name),
                          'spots', c.capacity,
                          'booked', (select count(*) from public.class_bookings b where b.class_id = c.id and b.session_date = v_today and b.status = 'booked'))
                          order by c.start_time), '[]')
                   from public.classes c left join public.profiles p on p.id = c.trainer_id
                  where c.gym_id = v_gym.id and c.is_active and c.weekday = extract(dow from v_today)
                    and c.start_time + make_interval(mins => c.duration_min) > v_now::time)
               when 'leaderboard' then (
                 select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'visits', x.visits) order by x.visits desc, x.name), '[]')
                   from (select public.screen_name(m.full_name) as name, count(*) as visits
                           from public.checkins c join public.members m on m.id = c.member_id
                          where c.gym_id = v_gym.id and c.allowed and c.checked_in_at >= v_month
                            and m.show_on_screens and m.archived_at is null
                          group by m.id, m.full_name
                          order by count(*) desc, m.full_name limit 10) x)
               when 'achievements' then (
                 select coalesce(jsonb_agg(jsonb_build_object('name', y.name, 'exercise', y.exercise, 'weight', y.weight, 'reps', y.reps) order by y.logged_at desc), '[]')
                   from (select distinct on (l.member_id, l.exercise_id)
                                public.screen_name(m.full_name) as name, e.name as exercise, l.weight_kg as weight, l.reps, l.logged_at
                           from public.set_logs l
                           join public.members m on m.id = l.member_id
                           join public.exercises e on e.id = l.exercise_id
                          where m.gym_id = v_gym.id and m.show_on_screens and m.archived_at is null
                            and l.logged_at >= v_week and l.weight_kg > 0
                            and l.weight_kg > coalesce((select max(o.weight_kg) from public.set_logs o
                                                         where o.member_id = l.member_id and o.exercise_id = l.exercise_id
                                                           and o.logged_at < v_week), 0)
                            and exists (select 1 from public.set_logs o where o.member_id = l.member_id
                                         and o.exercise_id = l.exercise_id and o.logged_at < v_week)
                          order by l.member_id, l.exercise_id, l.weight_kg desc, l.logged_at desc
                          limit 12) y)
               when 'occupancy' then (
                 select to_jsonb(o) from public.gym_occupancy(v_gym.id) o)
               else null
             end)
           order by s.position, s.created_at), '[]')
    into v_slides
    from public.screen_slides s
   where s.gym_id = v_gym.id and s.is_active
     and (s.screen_ids is null or v_screen.id = any (s.screen_ids))
     and (s.starts_on is null or s.starts_on <= v_today)
     and (s.ends_on is null or s.ends_on >= v_today)
     and (s.weekdays is null or cardinality(s.weekdays) = 0 or extract(dow from v_today)::smallint = any (s.weekdays))
     and (s.time_from is null or v_now::time >= s.time_from)
     and (s.time_to is null or v_now::time < s.time_to);

  return jsonb_build_object(
    'screen', jsonb_build_object('id', v_screen.id, 'name', v_screen.name, 'orientation', v_screen.orientation),
    'gym', jsonb_build_object('name', v_gym.name, 'timezone', v_gym.timezone),
    'slides', v_slides,
    'at', now()
  );
end;
$$;

-- Owners preview the feed of one of their screens.
create function public.screen_preview(p_screen_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
  v_gym   uuid;
begin
  select token, gym_id into v_token, v_gym from public.screens where id = p_screen_id;
  if not found then raise exception 'Screen not found' using errcode = 'P0002'; end if;
  perform public.require_manager(v_gym);
  return public.screen_feed(v_token);
end;
$$;

revoke execute on function public.screen_feed(text) from public, anon, authenticated;
revoke execute on function public.screen_preview(uuid) from public, anon;
grant execute on function public.screen_preview(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.screen_feed(text) to service_role;
  end if;
end;
$$;

insert into public.features (key, name, description, rollout) values
  ('screens', 'Gymix Screens', 'TVs at the gym with classes, leaderboards, records, occupancy and the gym''s own announcements.', 'lab');
