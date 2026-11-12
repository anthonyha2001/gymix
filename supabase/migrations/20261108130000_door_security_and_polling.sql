-- Door openings, part 2: security and running cost.
--
-- Security: a door sticker link copied off the wall could be opened from
-- anywhere by a member. Gyms can now require the phone to be at the gym: the
-- tap sends the phone's location and the door only opens within a radius of
-- the gym (set once by the owner, standing at the gym). Members are also
-- limited to 12 openings in 10 minutes.
--
-- Cost: ZKTeco terminals and the Gymix Bridge ask for work every 2 seconds.
-- Each of those calls is now one database call (access_zk_poll,
-- access_bridge_poll) instead of four or more.

-- ---------------------------------------------------------------------------
-- Where the gym is, for "phone must be at the gym"
-- ---------------------------------------------------------------------------
alter table public.gyms
  add column door_lat      double precision check (door_lat between -90 and 90),
  add column door_lng      double precision check (door_lng between -180 and 180),
  add column door_radius_m integer check (door_radius_m between 30 and 2000),
  add constraint gyms_door_location_check check ((door_lat is null) = (door_lng is null) and (door_lat is null) = (door_radius_m is null));
grant select (door_lat, door_lng, door_radius_m) on public.gyms to authenticated;

-- Owner or manager sets the gym's location (null: anyone with the link may open).
create function public.set_door_location(p_gym_id uuid, p_lat double precision, p_lng double precision, p_radius_m integer default 150)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_manager(p_gym_id);
  if p_lat is null or p_lng is null then
    update public.gyms set door_lat = null, door_lng = null, door_radius_m = null where id = p_gym_id;
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

-- Metres between two points (haversine).
create function public.distance_m(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision)
returns double precision
language sql immutable set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)))
$$;

-- Does this door's gym want the phone's location? (So the phone only asks
-- for location where it's needed.)
create function public.door_needs_location(p_token text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and coalesce((
    select g.door_lat is not null from public.access_devices d join public.gyms g on g.id = d.gym_id where d.tap_token = p_token), false)
$$;

-- ---------------------------------------------------------------------------
-- The member's tap, now with location and a rate limit
-- ---------------------------------------------------------------------------
drop function public.door_tap(text);

create function public.door_tap(p_token text, p_lat double precision default null, p_lng double precision default null, p_accuracy_m double precision default null)
returns table (
  allowed boolean, already_in boolean, reason text, full_name text, plan_name text,
  ends_on date, visits_left integer, door_name text, device_id uuid, command_id bigint
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_dev     public.access_devices;
  v_gym     public.gyms;
  v_member  public.members;
  v_res     record;
  v_plan    uuid;
  v_allowed boolean;
  v_reason  text;
  v_cmd     bigint;
  v_zone    text;
  v_away    double precision;
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

  -- The phone must be at the gym, when the gym asks for it. The phone's own
  -- accuracy is allowed for (up to 150 m), as indoor locations drift.
  select * into v_gym from public.gyms where id = v_dev.gym_id;
  if v_gym.door_lat is not null then
    if p_lat is null or p_lng is null then
      raise exception 'Turn on location for this site: the door only opens when your phone is at the gym.' using errcode = '22023';
    end if;
    v_away := public.distance_m(v_gym.door_lat, v_gym.door_lng, p_lat, p_lng) - least(greatest(coalesce(p_accuracy_m, 0), 0), 150);
    if v_away > v_gym.door_radius_m then
      raise exception 'Your phone isn''t at the gym. The door only opens when you''re at the door.' using errcode = '22023';
    end if;
  end if;

  -- No more than 12 openings in 10 minutes for one member.
  if (select count(*) from public.access_commands c
       where c.member_id = v_member.id and c.kind = 'open_door' and c.created_at > now() - interval '10 minutes') >= 12 then
    raise exception 'Too many door openings. Please wait a few minutes or ask the front desk.' using errcode = '22023';
  end if;

  if v_dev.direction = 'out' then
    -- Leaving: open for any member, nothing to check in.
    v_allowed := true;
    select null::boolean as already_in, null::text as plan_name, null::date as ends_on, null::integer as visits_left into v_res;
  else
    -- A door in a zone the member's plan doesn't cover: refused before any
    -- check-in, so no visit is used. (A plan without zones opens every door.)
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
      select null::boolean as already_in, null::text as plan_name, null::date as ends_on, null::integer as visits_left into v_res;
    else
      -- The same rules as the front desk: active, not frozen, visits left, paid.
      select * into v_res from public.record_check_in(v_dev.gym_id, v_member.id, 'tap');
      v_allowed := v_res.allowed;
      v_reason := v_res.reason;
    end if;
  end if;

  if v_allowed then
    -- Tapping twice quickly opens once.
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
-- One database call per device poll
-- ---------------------------------------------------------------------------
-- A ZKTeco terminal asking for work (/iclock/getrequest): note it, and hand
-- out its commands. Nothing for unknown or paused devices.
create function public.access_zk_poll(p_serial text, p_info jsonb default null)
returns setof public.access_commands
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.access_devices
   where serial_number = p_serial and vendor = 'zkteco' and is_active;
  if v_id is null then return; end if;
  perform public.access_device_seen(v_id, p_info);
  return query select * from public.access_take_commands(v_id, 20);
end;
$$;

-- The Gymix Bridge asking for work: its devices (with logins) and their
-- commands, or null for a wrong token.
create function public.access_bridge_poll(p_token text, p_version text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_bridge   public.access_bridges;
  v_devices  jsonb;
  v_commands jsonb;
begin
  select * into v_bridge from public.access_bridges where token = p_token;
  if not found then return null; end if;
  if v_bridge.last_seen_at is null or v_bridge.last_seen_at < now() - interval '15 seconds'
     or v_bridge.version is distinct from left(p_version, 40) then
    update public.access_bridges set last_seen_at = now(), version = left(p_version, 40) where gym_id = v_bridge.gym_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'name', d.name, 'host', d.host, 'username', d.username, 'door_no', d.door_no,
           'event_token', d.event_token, 'password', coalesce(s.password, '')) order by d.name), '[]')
    into v_devices
    from public.access_devices d
    left join public.access_device_secrets s on s.device_id = d.id
   where d.gym_id = v_bridge.gym_id and d.vendor = 'hikvision' and d.connection = 'bridge'
     and d.is_active and d.host is not null;

  select coalesce(jsonb_agg(to_jsonb(c) order by (c.kind = 'open_door') desc, c.id), '[]')
    into v_commands
    from public.access_devices d
    cross join lateral public.access_take_commands(d.id, 25) c
   where d.gym_id = v_bridge.gym_id and d.vendor = 'hikvision' and d.connection = 'bridge'
     and d.is_active and d.host is not null;

  return jsonb_build_object('gym_id', v_bridge.gym_id, 'devices', v_devices, 'commands', v_commands);
end;
$$;

revoke execute on function public.set_door_location(uuid, double precision, double precision, integer) from public, anon;
revoke execute on function public.door_needs_location(text) from public, anon;
revoke execute on function public.door_tap(text, double precision, double precision, double precision) from public, anon;
revoke execute on function public.access_zk_poll(text, jsonb) from public, anon, authenticated;
revoke execute on function public.access_bridge_poll(text, text) from public, anon, authenticated;
grant execute on function public.set_door_location(uuid, double precision, double precision, integer) to authenticated;
grant execute on function public.door_needs_location(text) to authenticated;
grant execute on function public.door_tap(text, double precision, double precision, double precision) to authenticated;
grant execute on function public.distance_m(double precision, double precision, double precision, double precision) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.access_zk_poll(text, jsonb) to service_role;
    grant execute on function public.access_bridge_poll(text, text) to service_role;
  end if;
end;
$$;
