-- Live occupancy: how many people are in the gym right now, and the usual
-- busy hours, for staff and members. The best available source wins:
--   1. a people-counting sensor that reported in the last 15 minutes
--      (a running count, or entries/exits since midnight);
--   2. entry and exit doors (access_events): members whose last door event
--      today was an entry, at most four hours old (people who leave without
--      badging out don't stay "in" forever);
--   3. check-ins: members who checked in within the gym's usual visit length.

alter table public.gyms
  add column capacity integer check (capacity between 1 and 10000),
  add column avg_visit_minutes integer not null default 75 check (avg_visit_minutes between 15 and 300);
grant select (capacity, avg_visit_minutes) on public.gyms to authenticated;
grant update (capacity, avg_visit_minutes) on public.gyms to authenticated;

create table public.occupancy_sensors (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 1 and 60),
  token            text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  last_reading_at  timestamptz,
  created_at       timestamptz not null default now()
);
create index occupancy_sensors_gym_idx on public.occupancy_sensors (gym_id);

create table public.occupancy_readings (
  id          bigint generated always as identity primary key,
  sensor_id   uuid not null references public.occupancy_sensors (id) on delete cascade,
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  at          timestamptz not null default now(),
  entered     integer not null default 0 check (entered between 0 and 10000),
  exited      integer not null default 0 check (exited between 0 and 10000),
  -- A sensor that knows the number inside sends it directly.
  people      integer check (people between 0 and 10000)
);
create index occupancy_readings_gym_at_idx on public.occupancy_readings (gym_id, at desc);

alter table public.occupancy_sensors enable row level security;
alter table public.occupancy_readings enable row level security;
create policy occupancy_sensors_select on public.occupancy_sensors for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy occupancy_sensors_insert on public.occupancy_sensors for insert to authenticated
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy occupancy_sensors_delete on public.occupancy_sensors for delete to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
revoke update on public.occupancy_sensors from authenticated;
grant update (name) on public.occupancy_sensors to authenticated;
create policy occupancy_sensors_update on public.occupancy_sensors for update to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
-- occupancy_readings: written by the server, read through gym_occupancy().

-- Staff of the gym, or one of its members.
create function public.can_see_occupancy(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_gym_staff(p_gym_id)
      or exists (select 1 from public.members m where m.gym_id = p_gym_id and m.user_id = auth.uid())
$$;

-- People in the gym right now, and how the number was worked out.
create function public.gym_occupancy(p_gym_id uuid)
returns table (
  people         integer,
  method         text,
  capacity       integer,
  level          text,
  usual_now      numeric,
  entries_today  integer,
  exits_today    integer
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_gym       public.gyms;
  v_midnight  timestamptz;
  v_people    integer;
  v_method    text;
  v_usual     numeric;
  v_ref       numeric;
  v_in        integer;
  v_out       integer;
begin
  if auth.uid() is not null and not public.can_see_occupancy(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  if not found then return; end if;
  v_midnight := (date_trunc('day', now() at time zone v_gym.timezone)) at time zone v_gym.timezone;

  -- 1. A sensor heard from in the last 15 minutes.
  if exists (select 1 from public.occupancy_sensors s where s.gym_id = p_gym_id and s.last_reading_at > now() - interval '15 minutes') then
    select r.people into v_people from public.occupancy_readings r
     where r.gym_id = p_gym_id and r.people is not null and r.at > now() - interval '15 minutes'
     order by r.at desc limit 1;
    if v_people is null then
      select greatest(coalesce(sum(r.entered - r.exited), 0), 0)::integer into v_people
        from public.occupancy_readings r where r.gym_id = p_gym_id and r.at >= v_midnight;
    end if;
    v_method := 'sensor';
  end if;

  select count(*) filter (where e.direction = 'in' and e.granted), count(*) filter (where e.direction = 'out')
    into v_in, v_out
    from public.access_events e where e.gym_id = p_gym_id and e.occurred_at >= v_midnight;

  -- 2. Doors that see people leave.
  if v_people is null and v_out > 0 then
    select count(*)::integer into v_people from (
      select distinct on (e.member_id) e.direction, e.occurred_at
        from public.access_events e
       where e.gym_id = p_gym_id and e.member_id is not null and e.occurred_at >= v_midnight
         and (e.direction = 'out' or e.granted)
       order by e.member_id, e.occurred_at desc
    ) last_event
    where last_event.direction = 'in' and last_event.occurred_at > now() - interval '4 hours';
    v_method := 'doors';
  end if;

  -- 3. Recent check-ins.
  if v_people is null then
    select count(distinct c.member_id)::integer into v_people from public.checkins c
     where c.gym_id = p_gym_id and c.allowed
       and c.checked_in_at > now() - make_interval(mins => v_gym.avg_visit_minutes);
    v_method := 'checkins';
  end if;

  -- How busy it usually is at this hour on this weekday, from the last 8 weeks.
  -- Without a set capacity, compare with the busiest usual hour (one pass).
  select max(b.people) filter (where b.weekday = extract(dow from now() at time zone v_gym.timezone)::integer
                                 and b.hour = extract(hour from now() at time zone v_gym.timezone)::integer),
         max(b.people)
    into v_usual, v_ref
    from public.gym_busy_hours(p_gym_id) b;
  v_ref := coalesce(v_gym.capacity::numeric, v_ref);

  return query select
    v_people,
    v_method,
    v_gym.capacity,
    case
      when v_ref is null or v_ref = 0 then case when v_people = 0 then 'quiet' else 'moderate' end
      when v_people >= v_ref * 0.95 then case when v_gym.capacity is not null then 'full' else 'busy' end
      when v_people >= v_ref * 0.70 then 'busy'
      when v_people >= v_ref * 0.35 then 'moderate'
      else 'quiet'
    end,
    v_usual,
    coalesce(v_in, 0),
    coalesce(v_out, 0);
end;
$$;

-- Usual number of people in the gym for each weekday (0 = Sunday) and hour,
-- averaged over the last 8 weeks: check-ins still within the usual visit
-- length at the middle of that hour.
create function public.gym_busy_hours(p_gym_id uuid)
returns table (weekday integer, hour integer, people numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_gym public.gyms;
begin
  if auth.uid() is not null and not public.can_see_occupancy(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  if not found then return; end if;
  return query
  with slots as (
    select gs as local_mid
      from generate_series(
        date_trunc('hour', (now() at time zone v_gym.timezone) - interval '56 days') + interval '30 minutes',
        (now() at time zone v_gym.timezone),
        interval '1 hour') gs
  ),
  counted as (
    select s.local_mid,
           (select count(*) from public.checkins c
             where c.gym_id = p_gym_id and c.allowed
               and c.checked_in_at <= (s.local_mid at time zone v_gym.timezone)
               and c.checked_in_at > (s.local_mid at time zone v_gym.timezone) - make_interval(mins => v_gym.avg_visit_minutes)) as n
      from slots s
  )
  select extract(dow from local_mid)::integer, extract(hour from local_mid)::integer, round(avg(n), 1)
    from counted
   group by 1, 2
   order by 1, 2;
end;
$$;

-- People inside per hour today so far (for the chart).
create function public.gym_occupancy_today(p_gym_id uuid)
returns table (hour integer, people integer)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_gym public.gyms;
begin
  if auth.uid() is not null and not public.can_see_occupancy(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  if not found then return; end if;
  return query
  select h::integer,
         (select count(distinct c.member_id)::integer from public.checkins c
           where c.gym_id = p_gym_id and c.allowed
             and c.checked_in_at <= ((date_trunc('day', now() at time zone v_gym.timezone) + make_interval(hours => h, mins => 30)) at time zone v_gym.timezone)
             and c.checked_in_at > ((date_trunc('day', now() at time zone v_gym.timezone) + make_interval(hours => h, mins => 30)) at time zone v_gym.timezone)
                                   - make_interval(mins => v_gym.avg_visit_minutes))
    from generate_series(0, extract(hour from now() at time zone v_gym.timezone)::integer) h;
end;
$$;

-- Server only: a sensor's reading (token from its URL).
create function public.occupancy_ingest(p_token text, p_entered integer, p_exited integer, p_people integer default null, p_at timestamptz default null)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_sensor public.occupancy_sensors;
begin
  select * into v_sensor from public.occupancy_sensors where token = p_token;
  if not found then return false; end if;
  if coalesce(p_entered, 0) < 0 or coalesce(p_exited, 0) < 0 or coalesce(p_people, 0) < 0 then
    raise exception 'Counts can''t be negative' using errcode = '22023';
  end if;
  insert into public.occupancy_readings (sensor_id, gym_id, at, entered, exited, people)
  -- (least() skips nulls, so a missing count must stay null explicitly.)
  values (v_sensor.id, v_sensor.gym_id, coalesce(p_at, now()), least(coalesce(p_entered, 0), 10000), least(coalesce(p_exited, 0), 10000),
          case when p_people is null then null else least(p_people, 10000) end);
  update public.occupancy_sensors set last_reading_at = now() where id = v_sensor.id;
  return true;
end;
$$;

revoke execute on function public.can_see_occupancy(uuid) from public, anon;
revoke execute on function public.gym_occupancy(uuid) from public, anon;
revoke execute on function public.gym_busy_hours(uuid) from public, anon;
revoke execute on function public.gym_occupancy_today(uuid) from public, anon;
revoke execute on function public.occupancy_ingest(text, integer, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.gym_occupancy(uuid) to authenticated;
grant execute on function public.gym_busy_hours(uuid) to authenticated;
grant execute on function public.gym_occupancy_today(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.gym_occupancy(uuid) to service_role;
    grant execute on function public.gym_busy_hours(uuid) to service_role;
    grant execute on function public.occupancy_ingest(text, integer, integer, integer, timestamptz) to service_role;
  end if;
end;
$$;

insert into public.features (key, name, description, rollout) values
  ('live_occupancy', 'Live occupancy', 'People in the gym right now and the usual busy hours, for staff and members.', 'lab');
