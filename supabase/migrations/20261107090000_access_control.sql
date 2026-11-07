-- Door access control with ZKTeco and Hikvision devices.
--
-- Gymix decides who may open which door; devices are kept in step with it.
--   * Each member gets an access PIN (their user number on every device) and
--     may have a card number.
--   * Zones group doors ("Main entrance", "Ladies area", "Pool"). A plan that
--     lists zones only opens those; a plan without zones opens every door.
--   * access_valid_until() is the rule: the member's current membership end
--     date while they may enter that device, null when they may not (no
--     active membership, frozen, visits used up, unpaid, archived, wrong zone).
--   * access_grants remembers what each device was last told. Whenever the
--     answer changes (a sale, a payment, a freeze, a new day) a command is
--     queued in access_commands; devices collect it (ZKTeco push protocol,
--     the Gymix Bridge) or Gymix sends it (Hikvision reachable directly).
--   * Door events land in access_events; entries become check-ins.
--   * Fingerprint and face templates enrolled on a ZKTeco device are kept in
--     access_biometrics, so a member enrols once and every door knows them,
--     and a renewal after expiry restores them.

-- ---------------------------------------------------------------------------
-- Check-ins can now come from a door device or a reception kiosk.
-- ---------------------------------------------------------------------------
alter table public.checkins drop constraint checkins_source_check;
alter table public.checkins add constraint checkins_source_check
  check (source in ('desk', 'tap', 'device', 'kiosk'));

-- ---------------------------------------------------------------------------
-- Member credentials
-- ---------------------------------------------------------------------------
alter table public.members
  add column access_pin  integer check (access_pin between 1 and 999999999),
  add column access_card text check (access_card ~ '^[0-9]{1,20}$');

create unique index members_gym_access_pin_unique on public.members (gym_id, access_pin) where access_pin is not null;
create unique index members_gym_access_card_unique on public.members (gym_id, access_card) where access_card is not null;

-- Existing members get numbers in the order they joined.
with numbered as (
  select id, row_number() over (partition by gym_id order by created_at, id) as n from public.members
)
update public.members m set access_pin = numbered.n from numbered where numbered.id = m.id;

-- New members get the next number in their gym.
create function public.assign_access_pin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.access_pin is null then
    perform pg_advisory_xact_lock(hashtext('access_pin:' || new.gym_id::text));
    select coalesce(max(access_pin), 0) + 1 into new.access_pin from public.members where gym_id = new.gym_id;
  end if;
  return new;
end;
$$;
create trigger members_assign_access_pin before insert on public.members
  for each row execute function public.assign_access_pin();

-- ---------------------------------------------------------------------------
-- Zones, devices and their secrets
-- ---------------------------------------------------------------------------
create table public.access_zones (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  unique (gym_id, name)
);

create table public.plan_access_zones (
  plan_id  uuid not null references public.membership_plans (id) on delete cascade,
  zone_id  uuid not null references public.access_zones (id) on delete cascade,
  primary key (plan_id, zone_id)
);

create table public.access_devices (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references public.gyms (id) on delete cascade,
  vendor              text not null check (vendor in ('zkteco', 'hikvision')),
  name                text not null check (char_length(trim(name)) between 1 and 60),
  zone_id             uuid references public.access_zones (id) on delete set null,
  -- Entrance, exit, or both (one reader each side): used for live occupancy.
  direction           text not null default 'in' check (direction in ('in', 'out', 'both')),
  -- ZKTeco: the serial number it sends with every request. Hikvision: optional.
  serial_number       text unique check (serial_number ~ '^[A-Za-z0-9_-]{4,40}$'),
  -- ZKTeco devices call Gymix ('push'); Hikvision is reached directly over
  -- the internet ('direct') or through the Gymix Bridge on the gym's network.
  connection          text not null check (connection in ('push', 'direct', 'bridge')),
  host                text check (host ~ '^https?://[^\s/]+$'),
  username            text not null default 'admin' check (char_length(username) <= 40),
  door_no             integer not null default 1 check (door_no between 1 and 8),
  -- Secret in the URL Hikvision posts its events to.
  event_token         text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  is_active           boolean not null default true,
  last_seen_at        timestamptz,
  last_error          text check (char_length(last_error) <= 500),
  last_reconciled_on  date,
  info                jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  check ((vendor = 'zkteco') = (connection = 'push')),
  check (vendor <> 'zkteco' or serial_number is not null),
  check (connection <> 'direct' or host is not null)
);
create index access_devices_gym_idx on public.access_devices (gym_id);

-- Device passwords (Hikvision). No policies: only the server reads them.
create table public.access_device_secrets (
  device_id  uuid primary key references public.access_devices (id) on delete cascade,
  password   text not null check (char_length(password) between 1 and 64)
);

-- One Gymix Bridge per gym: the program on the gym's computer that talks to
-- Hikvision devices on the local network. Its token is a secret.
create table public.access_bridges (
  gym_id        uuid primary key references public.gyms (id) on delete cascade,
  token         text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  last_seen_at  timestamptz,
  version       text check (char_length(version) <= 40),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- What each device was told, the command queue, events and templates
-- ---------------------------------------------------------------------------
create table public.access_grants (
  device_id    uuid not null references public.access_devices (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  -- Null: the member was removed from (or blocked on) this device.
  valid_until  date,
  sent_name    text,
  sent_card    text,
  updated_at   timestamptz not null default now(),
  primary key (device_id, member_id)
);
create index access_grants_member_idx on public.access_grants (member_id);

create table public.access_commands (
  id          bigint generated always as identity primary key,
  device_id   uuid not null references public.access_devices (id) on delete cascade,
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  member_id   uuid references public.members (id) on delete cascade,
  kind        text not null check (kind in ('upsert_user', 'revoke_user', 'push_biometric', 'clear_users', 'sync_time', 'reboot')),
  payload     jsonb not null default '{}',
  status      text not null default 'queued' check (status in ('queued', 'sent', 'done', 'failed')),
  attempts    integer not null default 0,
  result      text check (char_length(result) <= 500),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  done_at     timestamptz
);
create index access_commands_queue_idx on public.access_commands (device_id, status, id);

create table public.access_events (
  id           bigint generated always as identity primary key,
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  device_id    uuid not null references public.access_devices (id) on delete cascade,
  member_id    uuid references public.members (id) on delete set null,
  pin          text,
  direction    text not null check (direction in ('in', 'out')),
  granted      boolean not null,
  method       text not null default 'unknown' check (method in ('face', 'fingerprint', 'card', 'pin', 'palm', 'qr', 'unknown')),
  occurred_at  timestamptz not null,
  outcome      text,
  checkin_id   uuid references public.checkins (id) on delete set null,
  raw          jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  unique (device_id, pin, occurred_at, direction)
);
create index access_events_gym_time_idx on public.access_events (gym_id, occurred_at desc);

create table public.access_biometrics (
  id                uuid primary key default gen_random_uuid(),
  gym_id            uuid not null references public.gyms (id) on delete cascade,
  member_id         uuid not null references public.members (id) on delete cascade,
  -- ZKTeco record type as the device names it: FP (fingerprint), FACE, BIODATA.
  kind              text not null check (kind in ('FP', 'FACE', 'BIODATA')),
  slot              text not null check (char_length(slot) <= 20),
  fields            jsonb not null,
  source_device_id  uuid references public.access_devices (id) on delete set null,
  updated_at        timestamptz not null default now(),
  unique (member_id, kind, slot)
);

alter table public.access_zones enable row level security;
alter table public.plan_access_zones enable row level security;
alter table public.access_devices enable row level security;
alter table public.access_device_secrets enable row level security;
alter table public.access_bridges enable row level security;
alter table public.access_grants enable row level security;
alter table public.access_commands enable row level security;
alter table public.access_events enable row level security;
alter table public.access_biometrics enable row level security;

-- Staff see zones (plans show them); owners and managers run the hardware.
create policy access_zones_select on public.access_zones for select to authenticated
  using (public.is_gym_staff(gym_id));
create policy access_zones_write on public.access_zones for all to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));

create policy plan_access_zones_select on public.plan_access_zones for select to authenticated
  using (exists (select 1 from public.access_zones z where z.id = zone_id and public.is_gym_staff(z.gym_id)));
create policy plan_access_zones_write on public.plan_access_zones for all to authenticated
  using (exists (select 1 from public.access_zones z where z.id = zone_id
                  and public.has_gym_role(z.gym_id, array['owner', 'manager']::public.gym_role[])))
  with check (
    exists (select 1 from public.access_zones z join public.membership_plans p on p.id = plan_id and p.gym_id = z.gym_id
             where z.id = zone_id and public.has_gym_role(z.gym_id, array['owner', 'manager']::public.gym_role[])));

create policy access_devices_select on public.access_devices for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy access_devices_insert on public.access_devices for insert to authenticated
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[])
              and (zone_id is null or exists (select 1 from public.access_zones z where z.id = zone_id and z.gym_id = access_devices.gym_id)));
create policy access_devices_update on public.access_devices for update to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[])
              and (zone_id is null or exists (select 1 from public.access_zones z where z.id = zone_id and z.gym_id = access_devices.gym_id)));
create policy access_devices_delete on public.access_devices for delete to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
-- Only these columns can be set from the dashboard; the rest is the server's.
revoke insert, update on public.access_devices from authenticated;
grant insert (gym_id, vendor, name, zone_id, direction, serial_number, connection, host, username, door_no, is_active)
  on public.access_devices to authenticated;
grant update (name, zone_id, direction, serial_number, host, username, door_no, is_active) on public.access_devices to authenticated;

create policy access_commands_select on public.access_commands for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy access_grants_select on public.access_grants for select to authenticated
  using (public.can_handle_billing(gym_id));
create policy access_events_select on public.access_events for select to authenticated
  using (public.can_handle_billing(gym_id));
-- access_device_secrets, access_bridges and access_biometrics: no policies.

-- Card numbers are set through set_member_access_card() (which checks the
-- role and duplicates); PINs are automatic. Direct edits are refused.
create function public.guard_access_credentials()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.access_pin is distinct from old.access_pin or new.access_card is distinct from old.access_card)
     and current_user in ('authenticated', 'anon') then
    raise exception 'Use the Access card field to change door credentials' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger members_guard_access_credentials before update on public.members
  for each row execute function public.guard_access_credentials();

-- ---------------------------------------------------------------------------
-- The rule: until when may this member open this device? (null = not now)
-- ---------------------------------------------------------------------------
create function public.access_valid_until(p_member_id uuid, p_device_id uuid)
returns date
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_member  public.members;
  v_dev     public.access_devices;
  v_ms      public.memberships;
  v_today   date;
begin
  select * into v_member from public.members where id = p_member_id;
  select * into v_dev from public.access_devices where id = p_device_id;
  if v_member.id is null or v_dev.id is null or v_member.gym_id <> v_dev.gym_id then
    return null;
  end if;
  if v_member.archived_at is not null or v_member.unpaid_frozen_at is not null
     or public.overdue_balance(v_member.id) > 0 then
    return null;
  end if;

  v_today := public.gym_today(v_member.gym_id);
  select * into v_ms from public.memberships ms
   where ms.member_id = v_member.id and ms.cancelled_at is null
   order by public.membership_rank(ms, v_today) desc, ms.ends_on desc
   limit 1;
  -- Rank 2: running today, not frozen, visits left.
  if v_ms.id is null or public.membership_rank(v_ms, v_today) < 2 then
    return null;
  end if;

  if v_dev.zone_id is not null and v_ms.plan_id is not null
     and exists (select 1 from public.plan_access_zones z where z.plan_id = v_ms.plan_id)
     and not exists (select 1 from public.plan_access_zones z where z.plan_id = v_ms.plan_id and z.zone_id = v_dev.zone_id) then
    return null;
  end if;
  return v_ms.ends_on;
end;
$$;

-- ---------------------------------------------------------------------------
-- Keeping devices in step
-- ---------------------------------------------------------------------------

-- Compares what one device should know about one member with what it was last
-- told, and queues the difference (replacing anything not yet sent).
create function public.access_sync_one(p_member_id uuid, p_device_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev     public.access_devices;
  v_member  public.members;
  v_grant   public.access_grants;
  v_until   date;
begin
  select * into v_dev from public.access_devices where id = p_device_id and is_active;
  if not found then return; end if;
  select * into v_member from public.members where id = p_member_id and gym_id = v_dev.gym_id;
  if not found or v_member.access_pin is null then return; end if;

  v_until := public.access_valid_until(p_member_id, p_device_id);
  select * into v_grant from public.access_grants where device_id = p_device_id and member_id = p_member_id;

  if not found then
    if v_until is null then return; end if;  -- never on the device, nothing to remove
  elsif v_grant.valid_until is not distinct from v_until
        and (v_until is null or (v_grant.sent_name is not distinct from v_member.full_name
                                 and v_grant.sent_card is not distinct from v_member.access_card)) then
    return;  -- already up to date
  end if;

  insert into public.access_grants (device_id, member_id, gym_id, valid_until, sent_name, sent_card, updated_at)
  values (p_device_id, p_member_id, v_dev.gym_id, v_until, v_member.full_name, v_member.access_card, now())
  on conflict (device_id, member_id) do update
    set valid_until = excluded.valid_until, sent_name = excluded.sent_name,
        sent_card = excluded.sent_card, updated_at = now();

  delete from public.access_commands
   where device_id = p_device_id and member_id = p_member_id and status = 'queued'
     and kind in ('upsert_user', 'revoke_user', 'push_biometric');

  if v_until is not null then
    insert into public.access_commands (device_id, gym_id, member_id, kind, payload)
    values (p_device_id, v_dev.gym_id, p_member_id, 'upsert_user',
            jsonb_build_object('pin', v_member.access_pin::text, 'name', v_member.full_name,
                               'card', v_member.access_card,
                               'valid_from', public.gym_today(v_dev.gym_id), 'valid_until', v_until));
    -- ZKTeco: give the device the member's fingerprints and face as well.
    if v_dev.vendor = 'zkteco' then
      insert into public.access_commands (device_id, gym_id, member_id, kind, payload)
      select p_device_id, v_dev.gym_id, p_member_id, 'push_biometric',
             jsonb_build_object('pin', v_member.access_pin::text, 'kind', b.kind, 'fields', b.fields)
        from public.access_biometrics b where b.member_id = p_member_id
       order by b.kind, b.slot;
    end if;
  else
    insert into public.access_commands (device_id, gym_id, member_id, kind, payload)
    values (p_device_id, v_dev.gym_id, p_member_id, 'revoke_user',
            jsonb_build_object('pin', v_member.access_pin::text, 'name', v_member.full_name));
  end if;
end;
$$;

create function public.access_sync_member(p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev uuid;
begin
  for v_dev in
    select d.id from public.access_devices d join public.members m on m.gym_id = d.gym_id
     where m.id = p_member_id and d.is_active
  loop
    perform public.access_sync_one(p_member_id, v_dev);
  end loop;
end;
$$;

-- Every member against one device (a new device, a new day, "sync now").
create function public.access_sync_device(p_device_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev     public.access_devices;
  v_member  uuid;
  v_before  bigint;
  v_after   bigint;
begin
  select * into v_dev from public.access_devices where id = p_device_id and is_active;
  if not found then return 0; end if;
  select count(*) into v_before from public.access_commands where device_id = p_device_id and status = 'queued';
  for v_member in
    select m.id from public.members m where m.gym_id = v_dev.gym_id and m.access_pin is not null
    union
    select g.member_id from public.access_grants g where g.device_id = p_device_id
  loop
    perform public.access_sync_one(v_member, p_device_id);
  end loop;
  update public.access_devices set last_reconciled_on = public.gym_today(v_dev.gym_id) where id = p_device_id;
  select count(*) into v_after from public.access_commands where device_id = p_device_id and status = 'queued';
  return greatest(v_after - v_before, 0);
end;
$$;

-- A device checked in: note it, and once a day bring it up to date (memberships
-- end and invoices fall overdue without anything changing in the database).
create function public.access_device_seen(p_device_id uuid, p_info jsonb default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev public.access_devices;
begin
  update public.access_devices
     set last_seen_at = now(), info = case when p_info is null then info else info || p_info end
   where id = p_device_id
  returning * into v_dev;
  if found and v_dev.is_active
     and (v_dev.last_reconciled_on is null or v_dev.last_reconciled_on < public.gym_today(v_dev.gym_id)) then
    perform public.access_sync_device(p_device_id);
  end if;
end;
$$;

-- Hands out the next commands for a device and marks them sent. Commands sent
-- but never confirmed are offered again after two minutes, five times at most.
create function public.access_take_commands(p_device_id uuid, p_limit integer default 20)
returns setof public.access_commands
language plpgsql security definer set search_path = ''
as $$
begin
  update public.access_commands
     set status = 'failed', result = coalesce(result, 'The device never confirmed this command'), done_at = now()
   where device_id = p_device_id and status = 'sent' and attempts >= 5 and sent_at < now() - interval '2 minutes';

  return query
  update public.access_commands c
     set status = 'sent', attempts = c.attempts + 1, sent_at = now()
   where c.id in (
     select q.id from public.access_commands q
      where q.device_id = p_device_id
        and (q.status = 'queued' or (q.status = 'sent' and q.sent_at < now() - interval '2 minutes'))
      order by q.id
      limit greatest(1, least(p_limit, 200))
      for update skip locked)
  returning c.*;
end;
$$;

create function public.access_command_done(p_device_id uuid, p_command_id bigint, p_ok boolean, p_result text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.access_commands
     set status = case when p_ok then 'done' else 'failed' end,
         result = left(p_result, 500), done_at = now()
   where id = p_command_id and device_id = p_device_id and status in ('sent', 'queued');
  if not p_ok then
    update public.access_devices set last_error = left(coalesce(p_result, 'A command failed'), 500) where id = p_device_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Events from the door
-- ---------------------------------------------------------------------------
create function public.access_ingest_event(
  p_device_id  uuid,
  p_pin        text,
  p_at         timestamptz,
  p_direction  text,
  p_granted    boolean,
  p_method     text default 'unknown',
  p_raw        jsonb default '{}'
)
returns text
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_dev      public.access_devices;
  v_member   public.members;
  v_event    bigint;
  v_res      record;
  v_checkin  uuid;
  v_outcome  text;
  v_dir      text := case when p_direction = 'out' then 'out' else 'in' end;
begin
  select * into v_dev from public.access_devices where id = p_device_id;
  if not found then
    raise exception 'Unknown device' using errcode = 'P0002';
  end if;
  if p_pin ~ '^[0-9]{1,9}$' then
    select * into v_member from public.members m where m.gym_id = v_dev.gym_id and m.access_pin = p_pin::integer;
  end if;

  insert into public.access_events (gym_id, device_id, member_id, pin, direction, granted, method, occurred_at, raw)
  values (v_dev.gym_id, v_dev.id, v_member.id, nullif(p_pin, ''), v_dir, coalesce(p_granted, false),
          case when p_method in ('face', 'fingerprint', 'card', 'pin', 'palm', 'qr') then p_method else 'unknown' end,
          coalesce(p_at, now()), coalesce(p_raw, '{}'))
  on conflict (device_id, pin, occurred_at, direction) do nothing
  returning id into v_event;
  if v_event is null then return 'duplicate'; end if;

  update public.access_devices set last_seen_at = now() where id = v_dev.id;

  if v_member.id is null then
    v_outcome := 'unknown_member';
  elsif v_dir = 'out' then
    v_outcome := 'exit';
  elsif not coalesce(p_granted, false) then
    v_outcome := 'denied_by_device';
  else
    select * into v_res from public.record_check_in(v_dev.gym_id, v_member.id, 'device');
    if v_res.already_in then
      v_outcome := 'already_in';
    else
      select c.id into v_checkin from public.checkins c
       where c.member_id = v_member.id order by c.checked_in_at desc limit 1;
      -- Events a device uploads after being offline keep their real time.
      if p_at < now() - interval '2 minutes' then
        update public.checkins set checked_in_at = p_at where id = v_checkin;
      end if;
      v_outcome := case when v_res.allowed then 'checked_in' else 'refused' end;
    end if;
    -- The device let someone in that Gymix wouldn't: it is out of date.
    if not v_res.allowed then
      perform public.access_sync_member(v_member.id);
    end if;
  end if;

  update public.access_events set outcome = v_outcome, checkin_id = v_checkin where id = v_event;
  return v_outcome;
end;
$$;

-- A fingerprint or face enrolled on a ZKTeco device: keep it and share it
-- with the gym's other ZKTeco devices that already know the member.
create function public.access_save_biometric(p_device_id uuid, p_pin text, p_kind text, p_slot text, p_fields jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev     public.access_devices;
  v_member  public.members;
begin
  select * into v_dev from public.access_devices where id = p_device_id;
  if not found or p_pin !~ '^[0-9]{1,9}$' or p_kind not in ('FP', 'FACE', 'BIODATA') then return false; end if;
  select * into v_member from public.members m where m.gym_id = v_dev.gym_id and m.access_pin = p_pin::integer;
  if not found then return false; end if;

  insert into public.access_biometrics (gym_id, member_id, kind, slot, fields, source_device_id, updated_at)
  values (v_dev.gym_id, v_member.id, p_kind, coalesce(nullif(p_slot, ''), '0'), p_fields, v_dev.id, now())
  on conflict (member_id, kind, slot) do update
    set fields = excluded.fields, source_device_id = excluded.source_device_id, updated_at = now();

  insert into public.access_commands (device_id, gym_id, member_id, kind, payload)
  select d.id, d.gym_id, v_member.id, 'push_biometric',
         jsonb_build_object('pin', p_pin, 'kind', p_kind, 'fields', p_fields)
    from public.access_devices d
    join public.access_grants g on g.device_id = d.id and g.member_id = v_member.id and g.valid_until is not null
   where d.gym_id = v_dev.gym_id and d.vendor = 'zkteco' and d.is_active and d.id <> v_dev.id;
  return true;
end;
$$;

-- A card enrolled on a device becomes the member's card everywhere.
create function public.access_save_card(p_device_id uuid, p_pin text, p_card text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev public.access_devices;
begin
  select * into v_dev from public.access_devices where id = p_device_id;
  if not found or p_pin !~ '^[0-9]{1,9}$' or coalesce(p_card, '') !~ '^[0-9]{1,20}$' or p_card ~ '^0+$' then return false; end if;
  update public.members m set access_card = p_card
   where m.gym_id = v_dev.gym_id and m.access_pin = p_pin::integer and m.access_card is distinct from p_card
     and not exists (select 1 from public.members o where o.gym_id = v_dev.gym_id and o.access_card = p_card);
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard actions
-- ---------------------------------------------------------------------------
create function public.set_member_access_card(p_member_id uuid, p_card text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym   uuid;
  v_card  text := nullif(regexp_replace(coalesce(p_card, ''), '\s', '', 'g'), '');
begin
  select gym_id into v_gym from public.members where id = p_member_id;
  if not found then raise exception 'Member not found' using errcode = 'P0002'; end if;
  perform public.require_billing(v_gym);
  if v_card is not null and v_card !~ '^[0-9]{1,20}$' then
    raise exception 'A card number is digits only (up to 20).' using errcode = '22023';
  end if;
  if v_card is not null and exists (select 1 from public.members where gym_id = v_gym and access_card = v_card and id <> p_member_id) then
    raise exception 'Another member already has this card.' using errcode = '22023';
  end if;
  update public.members set access_card = v_card where id = p_member_id;
end;
$$;

create function public.set_access_device_password(p_device_id uuid, p_password text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym uuid;
begin
  select gym_id into v_gym from public.access_devices where id = p_device_id;
  if not found then raise exception 'Device not found' using errcode = 'P0002'; end if;
  perform public.require_manager(v_gym);
  if coalesce(p_password, '') = '' then
    delete from public.access_device_secrets where device_id = p_device_id;
  else
    insert into public.access_device_secrets (device_id, password) values (p_device_id, p_password)
    on conflict (device_id) do update set password = excluded.password;
  end if;
end;
$$;

-- "Send everyone again": forget what the device was told and queue it all.
create function public.resync_access_device(p_device_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym uuid;
begin
  select gym_id into v_gym from public.access_devices where id = p_device_id;
  if not found then raise exception 'Device not found' using errcode = 'P0002'; end if;
  perform public.require_manager(v_gym);
  delete from public.access_commands where device_id = p_device_id and status in ('queued', 'sent');
  delete from public.access_grants where device_id = p_device_id;
  update public.access_devices set last_error = null where id = p_device_id;
  return public.access_sync_device(p_device_id);
end;
$$;

-- The gym's bridge token (created on first ask), for the bridge's setup.
create function public.access_bridge_token(p_gym_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
begin
  perform public.require_manager(p_gym_id);
  insert into public.access_bridges (gym_id) values (p_gym_id) on conflict (gym_id) do nothing;
  select token into v_token from public.access_bridges where gym_id = p_gym_id;
  return v_token;
end;
$$;

create function public.access_bridge_status(p_gym_id uuid)
returns table (last_seen_at timestamptz, version text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_manager(p_gym_id);
  return query select b.last_seen_at, b.version from public.access_bridges b where b.gym_id = p_gym_id;
end;
$$;

-- What each device holds, for the dashboard.
create function public.access_device_counts(p_gym_id uuid)
returns table (device_id uuid, granted integer, pending integer, failed integer, biometrics integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_manager(p_gym_id);
  return query
  select d.id,
         (select count(*)::integer from public.access_grants g where g.device_id = d.id and g.valid_until is not null),
         (select count(*)::integer from public.access_commands c where c.device_id = d.id and c.status in ('queued', 'sent')),
         (select count(*)::integer from public.access_commands c where c.device_id = d.id and c.status = 'failed'
                                                             and c.done_at > now() - interval '7 days'),
         (select count(*)::integer from public.access_biometrics b where b.gym_id = d.gym_id)
    from public.access_devices d where d.gym_id = p_gym_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: anything that can change who may enter
-- ---------------------------------------------------------------------------
create function public.access_on_member_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.access_sync_member(coalesce(new.member_id, old.member_id));
  return null;
end;
$$;
create trigger memberships_access_sync after insert or update or delete on public.memberships
  for each row execute function public.access_on_member_change();
create trigger payments_access_sync after insert or delete on public.payments
  for each row execute function public.access_on_member_change();
create trigger invoices_access_sync after insert or update of voided_at, amount_usd, discount_usd, issued_on on public.invoices
  for each row execute function public.access_on_member_change();

create function public.access_on_member_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.access_sync_member(new.id);
  return null;
end;
$$;
create trigger members_access_sync after update of full_name, access_card, unpaid_frozen_at, archived_at on public.members
  for each row execute function public.access_on_member_row();

create function public.access_on_device_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.zone_id is distinct from old.zone_id or (new.is_active and not old.is_active) then
    perform public.access_sync_device(new.id);
  end if;
  return null;
end;
$$;
create trigger access_devices_sync after insert or update of zone_id, is_active on public.access_devices
  for each row execute function public.access_on_device_change();

create function public.access_on_plan_zones()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid;
begin
  for v_member in
    select distinct ms.member_id from public.memberships ms
     where ms.plan_id = coalesce(new.plan_id, old.plan_id) and ms.cancelled_at is null
  loop
    perform public.access_sync_member(v_member);
  end loop;
  return null;
end;
$$;
create trigger plan_access_zones_sync after insert or delete on public.plan_access_zones
  for each row execute function public.access_on_plan_zones();

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function public.assign_access_pin() from public, anon, authenticated;
revoke execute on function public.access_valid_until(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.access_sync_one(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.access_sync_member(uuid) from public, anon, authenticated;
revoke execute on function public.access_sync_device(uuid) from public, anon, authenticated;
revoke execute on function public.access_device_seen(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.access_take_commands(uuid, integer) from public, anon, authenticated;
revoke execute on function public.access_command_done(uuid, bigint, boolean, text) from public, anon, authenticated;
revoke execute on function public.access_ingest_event(uuid, text, timestamptz, text, boolean, text, jsonb) from public, anon, authenticated;
revoke execute on function public.access_save_biometric(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.access_save_card(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.access_on_member_change() from public, anon, authenticated;
revoke execute on function public.access_on_member_row() from public, anon, authenticated;
revoke execute on function public.access_on_device_change() from public, anon, authenticated;
revoke execute on function public.access_on_plan_zones() from public, anon, authenticated;
revoke execute on function public.set_member_access_card(uuid, text) from public, anon;
revoke execute on function public.set_access_device_password(uuid, text) from public, anon;
revoke execute on function public.resync_access_device(uuid) from public, anon;
revoke execute on function public.access_bridge_token(uuid) from public, anon;
revoke execute on function public.access_bridge_status(uuid) from public, anon;
revoke execute on function public.access_device_counts(uuid) from public, anon;
grant execute on function public.set_member_access_card(uuid, text) to authenticated;
grant execute on function public.set_access_device_password(uuid, text) to authenticated;
grant execute on function public.resync_access_device(uuid) to authenticated;
grant execute on function public.access_bridge_token(uuid) to authenticated;
grant execute on function public.access_bridge_status(uuid) to authenticated;
grant execute on function public.access_device_counts(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.access_sync_member(uuid) to service_role;
    grant execute on function public.access_sync_device(uuid) to service_role;
    grant execute on function public.access_device_seen(uuid, jsonb) to service_role;
    grant execute on function public.access_take_commands(uuid, integer) to service_role;
    grant execute on function public.access_command_done(uuid, bigint, boolean, text) to service_role;
    grant execute on function public.access_ingest_event(uuid, text, timestamptz, text, boolean, text, jsonb) to service_role;
    grant execute on function public.access_save_biometric(uuid, text, text, text, jsonb) to service_role;
    grant execute on function public.access_save_card(uuid, text, text) to service_role;
  end if;
end;
$$;

insert into public.features (key, name, description, rollout) values
  ('access_control', 'Door access (ZKTeco and Hikvision)',
   'Members synced to door devices, access by zone, entries recorded as check-ins, expired members revoked.', 'lab');
