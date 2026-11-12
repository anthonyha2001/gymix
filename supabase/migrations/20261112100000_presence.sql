-- Knowing when members leave, so "people in the gym now" is right.
--
--   * Every door sticker tap is now a door event: the entrance sticker records
--     an entry, the exit sticker an exit; a sticker on a door used both ways
--     records an exit when the member is already inside (10+ minutes).
--   * Any exit (sticker or exit reader) marks the member's visit as ended
--     (checkins.left_at); coming back in reopens it.
--   * While the member app is open, gyms with a location set check from time
--     to time whether a member counted inside is still at the gym
--     (presence_ping): still there keeps them counted (checkins.seen_at) even
--     past the usual visit length; clearly far away ends the visit.
--   * The live count: members checked in who haven't left, within the usual
--     visit length (four hours when the gym records exits), or confirmed at
--     the gym in the last 30 minutes.

-- ---------------------------------------------------------------------------
-- The gym's location is its own setting now (Settings → map), shown on the
-- Gymix map. "Phone must be at the gym" is a switch that uses it: on when
-- door_radius_m is set. (door_lat / door_lng hold the gym's location.)
-- ---------------------------------------------------------------------------
alter table public.gyms drop constraint gyms_door_location_check;
alter table public.gyms
  add constraint gyms_location_check check ((door_lat is null) = (door_lng is null) and (door_radius_m is null or door_lat is not null)),
  add column address text check (char_length(address) <= 200);
grant select (address) on public.gyms to authenticated;

-- Owner or manager: where the gym is. Null clears it (and switches the
-- "phone must be at the gym" check off, which needs it).
create function public.set_gym_location(p_gym_id uuid, p_lat double precision, p_lng double precision, p_address text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_manager(p_gym_id);
  if p_lat is null or p_lng is null then
    update public.gyms set door_lat = null, door_lng = null, door_radius_m = null, address = null where id = p_gym_id;
    return;
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 or (p_lat = 0 and p_lng = 0) then
    raise exception 'That location doesn''t look right.' using errcode = '22023';
  end if;
  update public.gyms
     set door_lat = p_lat, door_lng = p_lng, address = nullif(left(trim(coalesce(p_address, '')), 200), '')
   where id = p_gym_id;
end;
$$;

-- "Phone must be at the gym": with a location, sets it (and the distance);
-- without one, switches the check off and keeps the gym's location.
create or replace function public.set_door_location(p_gym_id uuid, p_lat double precision, p_lng double precision, p_radius_m integer default 150)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_manager(p_gym_id);
  if p_lat is null or p_lng is null then
    update public.gyms set door_radius_m = null where id = p_gym_id;
    return;
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 or (p_lat = 0 and p_lng = 0) then
    raise exception 'That location doesn''t look right.' using errcode = '22023';
  end if;
  if p_radius_m is null or p_radius_m not between 30 and 2000 then
    raise exception 'Choose a distance between 30 m and 2 km.' using errcode = '22023';
  end if;
  update public.gyms set door_lat = p_lat, door_lng = p_lng, door_radius_m = p_radius_m where id = p_gym_id;
end;
$$;

create or replace function public.door_needs_location(p_token text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and coalesce((
    select g.door_radius_m is not null from public.access_devices d join public.gyms g on g.id = d.gym_id where d.tap_token = p_token), false)
$$;

alter table public.checkins
  add column left_at   timestamptz,
  add column left_how  text check (left_how in ('door', 'sticker', 'location')),
  add column seen_at   timestamptz;
create index checkins_gym_open_idx on public.checkins (gym_id, checked_in_at desc) where allowed and left_at is null;

alter table public.access_events drop constraint access_events_method_check;
alter table public.access_events add constraint access_events_method_check
  check (method in ('face', 'fingerprint', 'card', 'pin', 'palm', 'qr', 'phone', 'unknown'));

-- The member's visit still open: their latest allowed check-in in the last
-- six hours that hasn't ended.
create function public.open_visit(p_member_id uuid, p_at timestamptz default now())
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.checkins c
   where c.member_id = p_member_id and c.allowed and c.left_at is null
     and c.checked_in_at <= p_at and c.checked_in_at > p_at - interval '6 hours'
   order by c.checked_in_at desc limit 1
$$;

-- Door events end and reopen visits.
create function public.access_events_presence()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.member_id is null then return new; end if;
  if new.direction = 'out' then
    update public.checkins
       set left_at = new.occurred_at, left_how = case when new.method = 'phone' then 'sticker' else 'door' end
     where id = public.open_visit(new.member_id, new.occurred_at);
  elsif new.granted then
    -- Back in after stepping out: the visit is open again.
    update public.checkins
       set left_at = null, left_how = null
     where id = (select c.id from public.checkins c
                  where c.member_id = new.member_id and c.allowed and c.left_at is not null
                    and c.checked_in_at > new.occurred_at - interval '4 hours'
                  order by c.checked_in_at desc limit 1);
  end if;
  return new;
end;
$$;
create trigger access_events_presence after insert on public.access_events
  for each row execute function public.access_events_presence();

-- ---------------------------------------------------------------------------
-- Door sticker taps become door events
-- ---------------------------------------------------------------------------
create or replace function public.door_tap(p_token text, p_lat double precision default null, p_lng double precision default null, p_accuracy_m double precision default null)
returns table (
  allowed boolean, already_in boolean, reason text, full_name text, plan_name text,
  ends_on date, visits_left integer, door_name text, device_id uuid, command_id bigint
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_dev      public.access_devices;
  v_gym      public.gyms;
  v_member   public.members;
  v_res      record;
  v_plan     uuid;
  v_allowed  boolean;
  v_reason   text;
  v_cmd      bigint;
  v_zone     text;
  v_away     double precision;
  v_leaving  boolean;
  v_visit    uuid;
  v_outcome  text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select * into v_dev from public.access_devices d where d.tap_token = p_token;
  if not found then
    raise exception 'This door sticker is no longer valid. Ask the front desk.' using errcode = 'P0002';
  end if;
  if not v_dev.is_active or not 'access_control' = any (public.gym_features(v_dev.gym_id)) then
    raise exception 'This door is switched off right now. Ask the front desk.' using errcode = '22023';
  end if;
  select * into v_member from public.members m
   where m.gym_id = v_dev.gym_id and m.user_id = auth.uid() and m.archived_at is null;
  if not found then
    raise exception 'Your account isn''t linked to a membership at this gym. Ask the front desk.' using errcode = 'P0002';
  end if;

  select * into v_gym from public.gyms where id = v_dev.gym_id;
  if v_gym.door_radius_m is not null then
    if p_lat is null or p_lng is null then
      raise exception 'Turn on location for this site: the door only opens when your phone is at the gym.' using errcode = '22023';
    end if;
    v_away := public.distance_m(v_gym.door_lat, v_gym.door_lng, p_lat, p_lng) - least(greatest(coalesce(p_accuracy_m, 0), 0), 150);
    if v_away > v_gym.door_radius_m then
      raise exception 'Your phone isn''t at the gym. The door only opens when you''re at the door.' using errcode = '22023';
    end if;
  end if;

  if (select count(*) from public.access_commands c
       where c.member_id = v_member.id and c.kind = 'open_door' and c.created_at > now() - interval '10 minutes') >= 12 then
    raise exception 'Too many door openings. Please wait a few minutes or ask the front desk.' using errcode = '22023';
  end if;

  -- Leaving: an exit door, or a two-way door while already inside for a while.
  v_visit := public.open_visit(v_member.id);
  v_leaving := v_dev.direction = 'out'
    or (v_dev.direction = 'both' and v_visit is not null
        and (select c.checked_in_at from public.checkins c where c.id = v_visit) < now() - interval '10 minutes');

  if v_leaving then
    v_allowed := true;
    v_outcome := 'exit';
    select null::boolean as already_in, null::text as plan_name, null::date as ends_on, null::integer as visits_left into v_res;
  else
    select ms.plan_id into v_plan from public.memberships ms
     where ms.member_id = v_member.id and ms.cancelled_at is null
     order by public.membership_rank(ms, public.gym_today(v_dev.gym_id)) desc, ms.ends_on desc
     limit 1;
    if v_dev.zone_id is not null and v_plan is not null
       and exists (select 1 from public.plan_access_zones z where z.plan_id = v_plan)
       and not exists (select 1 from public.plan_access_zones z where z.plan_id = v_plan and z.zone_id = v_dev.zone_id) then
      select z.name into v_zone from public.access_zones z where z.id = v_dev.zone_id;
      v_allowed := false;
      v_reason := 'Your membership doesn''t include ' || v_zone;
      v_outcome := 'refused';
      select null::boolean as already_in, null::text as plan_name, null::date as ends_on, null::integer as visits_left into v_res;
    else
      select * into v_res from public.record_check_in(v_dev.gym_id, v_member.id, 'tap');
      v_allowed := v_res.allowed;
      v_reason := v_res.reason;
      v_outcome := case when not v_res.allowed then 'refused' when v_res.already_in then 'already_in' else 'checked_in' end;
    end if;
  end if;

  -- The tap, on the door's record (entries, exits, and the live count).
  insert into public.access_events (gym_id, device_id, member_id, pin, direction, granted, method, occurred_at, outcome, checkin_id, raw)
  values (v_dev.gym_id, v_dev.id, v_member.id, v_member.access_pin::text, case when v_leaving then 'out' else 'in' end,
          v_allowed, 'phone', clock_timestamp(), v_outcome,
          case when v_leaving then v_visit else (select c.id from public.checkins c where c.member_id = v_member.id order by c.checked_in_at desc limit 1) end,
          jsonb_build_object('source', 'sticker'))
  on conflict do nothing;

  if v_allowed then
    select c.id into v_cmd from public.access_commands c
     where c.device_id = v_dev.id and c.kind = 'open_door' and c.requested_by = auth.uid()
       and c.status in ('queued', 'sent') and c.created_at > now() - interval '5 seconds'
     order by c.id desc limit 1;
    if v_cmd is null then
      insert into public.access_commands (device_id, gym_id, member_id, kind, payload, expires_at, requested_by)
      values (v_dev.id, v_dev.gym_id, v_member.id, 'open_door', '{"seconds": 5}', now() + interval '15 seconds', auth.uid())
      returning id into v_cmd;
    end if;
  end if;

  return query select v_allowed, coalesce(v_res.already_in, false), v_reason, v_member.full_name,
                      v_res.plan_name, v_res.ends_on, v_res.visits_left, v_dev.name, v_dev.id, v_cmd;
end;
$$;

-- ---------------------------------------------------------------------------
-- Is the member still at the gym? (Member app, while open.)
-- ---------------------------------------------------------------------------
-- 'here'    within the gym's radius: the visit is confirmed (and reopened)
-- 'left'    clearly far away (beyond twice the radius, at least 300 m): ended
-- 'unsure'  in between, or a vague location: nothing changes
-- 'not_in'  no visit in the last six hours
-- 'off'     the gym hasn't set its location
create function public.presence_ping(p_gym_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m double precision default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_me    uuid := public.my_member_id(p_gym_id);
  v_gym   public.gyms;
  v_visit public.checkins;
  v_acc   double precision := least(greatest(coalesce(p_accuracy_m, 0), 0), 150);
  v_dist  double precision;
begin
  if v_me is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  if v_gym.door_radius_m is null then return 'off'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return 'unsure';
  end if;

  select * into v_visit from public.checkins c
   where c.member_id = v_me and c.allowed and c.checked_in_at > now() - interval '6 hours'
   order by c.checked_in_at desc limit 1;
  if not found then return 'not_in'; end if;
  -- Left through a door: the door knows better than a location.
  if v_visit.left_at is not null and v_visit.left_how in ('door', 'sticker') then return 'not_in'; end if;

  v_dist := public.distance_m(v_gym.door_lat, v_gym.door_lng, p_lat, p_lng);
  if v_dist - v_acc <= v_gym.door_radius_m then
    update public.checkins
       set seen_at = now(), left_at = null, left_how = null
     where id = v_visit.id and (seen_at is null or seen_at < now() - interval '4 minutes' or left_at is not null);
    return 'here';
  end if;
  if v_dist - v_acc > greatest(v_gym.door_radius_m * 2, 300) then
    update public.checkins set left_at = now(), left_how = 'location' where id = v_visit.id and left_at is null;
    return 'left';
  end if;
  return 'unsure';
end;
$$;

-- ---------------------------------------------------------------------------
-- The live count, using exits and location checks
-- ---------------------------------------------------------------------------
create or replace function public.gym_occupancy(p_gym_id uuid)
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
  v_window    interval;
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

  -- 2. Visits: checked in and not left. Where exits are recorded (doors,
  -- exit stickers), a visit lasts until the exit (four hours at most);
  -- otherwise the usual visit length. A location check at the gym in the
  -- last 30 minutes keeps a visit counted either way.
  if v_people is null then
    v_window := make_interval(mins => v_gym.avg_visit_minutes);
    select count(distinct c.member_id)::integer into v_people from public.checkins c
     where c.gym_id = p_gym_id and c.allowed and c.left_at is null
       and (
         -- Within the usual visit length (desk, sticker, kiosk check-ins).
         c.checked_in_at > now() - v_window
         -- Came in through a door reader today: readers catch exits, so the
         -- visit lasts until they badge out (four hours at most).
         or (c.checked_in_at > now() - interval '4 hours'
             and exists (select 1 from public.access_events e
                          where e.gym_id = p_gym_id and e.member_id = c.member_id and e.direction = 'in' and e.granted
                            and e.method <> 'phone' and e.occurred_at >= v_midnight))
         -- Seen at the gym by the app in the last 30 minutes.
         or (c.seen_at > now() - interval '30 minutes' and c.checked_in_at > now() - interval '6 hours'));
    v_method := case when v_out > 0 then 'doors' else 'checkins' end;
  end if;

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

revoke execute on function public.set_gym_location(uuid, double precision, double precision, text) from public, anon;
grant execute on function public.set_gym_location(uuid, double precision, double precision, text) to authenticated;
revoke execute on function public.open_visit(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.access_events_presence() from public, anon, authenticated;
revoke execute on function public.presence_ping(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.presence_ping(uuid, double precision, double precision, double precision) to authenticated;
