-- Opening a door from Gymix.
--   * Staff (owner, manager, front desk) press "Open door" in the dashboard.
--   * A member taps the door's own NFC sticker (/d/<tap_token>) with their
--     phone: they are checked in and, if allowed through that door, it opens.
-- An opening jumps ahead of everything else queued for the device, and
-- devices now ask for work every 2 seconds, so the door opens in about 1 to 3
-- seconds (at once for Hikvision devices Gymix reaches directly).
-- An opening that isn't collected within 15 seconds is dropped: a door must
-- never open long after the person walked away.

alter table public.access_commands drop constraint access_commands_kind_check;
alter table public.access_commands add constraint access_commands_kind_check
  check (kind in ('upsert_user', 'revoke_user', 'push_biometric', 'clear_users', 'sync_time', 'reboot', 'open_door'));
alter table public.access_commands
  add column expires_at   timestamptz,
  add column requested_by uuid references public.profiles (id) on delete set null;
create index access_commands_open_idx on public.access_commands (device_id, created_at desc) where kind = 'open_door';

-- The secret in the door's NFC sticker link. Each door has its own.
alter table public.access_devices
  add column tap_token text not null unique default replace(gen_random_uuid()::text, '-', '');

-- ---------------------------------------------------------------------------
-- The queue: openings first, never late
-- ---------------------------------------------------------------------------
create or replace function public.access_take_commands(p_device_id uuid, p_limit integer default 20)
returns setof public.access_commands
language plpgsql security definer set search_path = ''
as $$
begin
  -- Openings nobody collected in time are dropped, never sent late.
  update public.access_commands
     set status = 'failed', result = 'The door didn''t collect it in time (is the device online?)', done_at = now()
   where device_id = p_device_id and status = 'queued' and expires_at < now();

  update public.access_commands
     set status = 'failed', result = coalesce(result, 'The device never confirmed this command'), done_at = now()
   where device_id = p_device_id and status = 'sent' and expires_at is null
     and attempts >= 5 and sent_at < now() - interval '2 minutes';

  return query
  update public.access_commands c
     set status = 'sent', attempts = c.attempts + 1, sent_at = now()
   where c.id in (
     select q.id from public.access_commands q
      where q.device_id = p_device_id
        and (q.status = 'queued'
             -- Resent if unconfirmed, except openings: one try only.
             or (q.status = 'sent' and q.expires_at is null and q.sent_at < now() - interval '2 minutes'))
      order by (q.kind = 'open_door') desc, q.id
      limit greatest(1, least(p_limit, 200))
      for update skip locked)
  returning c.*;
end;
$$;

-- Devices now call every 2 seconds: only write "last seen" every 15 seconds
-- (or when the device reports something new), not on every call.
create or replace function public.access_device_seen(p_device_id uuid, p_info jsonb default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev public.access_devices;
begin
  update public.access_devices
     set last_seen_at = now(), info = case when p_info is null then info else info || p_info end
   where id = p_device_id
     and (last_seen_at is null or last_seen_at < now() - interval '15 seconds'
          or (p_info is not null and not (info @> p_info)))
  returning * into v_dev;
  if not found then
    select * into v_dev from public.access_devices where id = p_device_id;
  end if;
  if v_dev.id is not null and v_dev.is_active
     and (v_dev.last_reconciled_on is null or v_dev.last_reconciled_on < public.gym_today(v_dev.gym_id)) then
    perform public.access_sync_device(p_device_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: the doors, and opening one
-- ---------------------------------------------------------------------------
-- The gym's doors for the "Open door" buttons (front desk can't read devices).
create function public.access_doors(p_gym_id uuid)
returns table (id uuid, name text, zone_name text, direction text, connection text, last_seen_at timestamptz, is_active boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_billing(p_gym_id);
  return query
  select d.id, d.name, z.name, d.direction, d.connection, d.last_seen_at, d.is_active
    from public.access_devices d
    left join public.access_zones z on z.id = d.zone_id
   where d.gym_id = p_gym_id
   order by d.is_active desc, d.name;
end;
$$;

create function public.access_open_door(p_device_id uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev public.access_devices;
  v_id  bigint;
begin
  select * into v_dev from public.access_devices where id = p_device_id;
  if not found then raise exception 'Door not found' using errcode = 'P0002'; end if;
  perform public.require_billing(v_dev.gym_id);
  if not 'access_control' = any (public.gym_features(v_dev.gym_id)) then
    raise exception 'Door access isn''t switched on for this gym.' using errcode = '22023';
  end if;
  if not v_dev.is_active then
    raise exception 'This door is paused. Switch it back on first.' using errcode = '22023';
  end if;
  insert into public.access_commands (device_id, gym_id, kind, payload, expires_at, requested_by)
  values (v_dev.id, v_dev.gym_id, 'open_door', '{"seconds": 5}', now() + interval '15 seconds', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- How an opening went: waiting (not collected yet), sent (the device has it,
-- no confirmation yet), opened, or failed. For the person who asked, or staff.
create function public.access_open_status(p_command_id bigint)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_c public.access_commands;
begin
  select * into v_c from public.access_commands where id = p_command_id and kind = 'open_door';
  if not found then raise exception 'Not found' using errcode = 'P0002'; end if;
  if v_c.requested_by is distinct from auth.uid() and not public.can_handle_billing(v_c.gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return case
    when v_c.status = 'done' then 'opened'
    when v_c.status = 'failed' then 'failed'
    when v_c.status = 'queued' and v_c.expires_at < now() then 'failed'
    when v_c.status = 'sent' then 'sent'
    else 'waiting'
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Members: tap the door's sticker
-- ---------------------------------------------------------------------------
create function public.door_tap(p_token text)
returns table (
  allowed boolean, already_in boolean, reason text, full_name text, plan_name text,
  ends_on date, visits_left integer, door_name text, device_id uuid, command_id bigint
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_dev     public.access_devices;
  v_member  public.members;
  v_res     record;
  v_plan    uuid;
  v_allowed boolean;
  v_reason  text;
  v_cmd     bigint;
  v_zone    text;
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

revoke execute on function public.access_doors(uuid) from public, anon;
revoke execute on function public.access_open_door(uuid) from public, anon;
revoke execute on function public.access_open_status(bigint) from public, anon;
revoke execute on function public.door_tap(text) from public, anon;
grant execute on function public.access_doors(uuid) to authenticated;
grant execute on function public.access_open_door(uuid) to authenticated;
grant execute on function public.access_open_status(bigint) to authenticated;
grant execute on function public.door_tap(text) to authenticated;
