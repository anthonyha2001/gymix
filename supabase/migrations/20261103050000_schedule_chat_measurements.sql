-- Phase 4: class schedule & bookings, PT sessions, member↔staff chat, body measurements.

-- ---------------------------------------------------------------------------
-- Classes (weekly timetable) and bookings
-- ---------------------------------------------------------------------------

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 60),
  description   text check (char_length(description) <= 500),
  trainer_id    uuid references public.profiles (id) on delete set null,
  -- 0 = Sunday … 6 = Saturday (same as JavaScript's getDay()).
  weekday       smallint not null check (weekday between 0 and 6),
  start_time    time not null,
  duration_min  integer not null default 60 check (duration_min between 10 and 240),
  capacity      integer not null default 20 check (capacity between 1 and 500),
  location      text check (char_length(location) <= 60),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index classes_gym_idx on public.classes (gym_id, weekday, start_time);

create table public.class_bookings (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  class_id      uuid not null references public.classes (id) on delete cascade,
  session_date  date not null,
  member_id     uuid not null references public.members (id) on delete cascade,
  status        text not null check (status in ('booked', 'waitlist', 'cancelled', 'attended', 'no_show')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (class_id, session_date, member_id)
);

create index class_bookings_session_idx on public.class_bookings (class_id, session_date, status);
create index class_bookings_member_idx on public.class_bookings (member_id, session_date);

create trigger class_bookings_touch before update on public.class_bookings
  for each row execute function public.touch_program();

-- ---------------------------------------------------------------------------
-- PT sessions
-- ---------------------------------------------------------------------------

create table public.pt_sessions (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  trainer_id    uuid not null references public.profiles (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  starts_at     timestamptz not null,
  duration_min  integer not null default 60 check (duration_min between 15 and 180),
  status        text not null check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'done')),
  note          text check (char_length(note) <= 500),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index pt_sessions_trainer_idx on public.pt_sessions (trainer_id, starts_at);
create index pt_sessions_member_idx on public.pt_sessions (member_id, starts_at);

create trigger pt_sessions_touch before update on public.pt_sessions
  for each row execute function public.touch_program();

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms (id) on delete cascade,
  member_id        uuid not null references public.members (id) on delete cascade,
  staff_id         uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz,
  unique (member_id, staff_id)
);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid references public.profiles (id) on delete set null,
  body             text not null check (char_length(trim(body)) between 1 and 2000),
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Body measurements
-- ---------------------------------------------------------------------------

create table public.body_measurements (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete cascade,
  measured_on     date not null,
  weight_kg       numeric(5, 1) check (weight_kg between 20 and 400),
  body_fat_pct    numeric(4, 1) check (body_fat_pct between 2 and 70),
  muscle_mass_kg  numeric(5, 1) check (muscle_mass_kg between 5 and 150),
  waist_cm        numeric(5, 1) check (waist_cm between 30 and 250),
  chest_cm        numeric(5, 1) check (chest_cm between 40 and 250),
  hips_cm         numeric(5, 1) check (hips_cm between 40 and 250),
  arm_cm          numeric(4, 1) check (arm_cm between 10 and 80),
  thigh_cm        numeric(4, 1) check (thigh_cm between 20 and 120),
  notes           text check (char_length(notes) <= 500),
  -- 'manual' today; 'inbody' / 'scale' once scale integrations exist.
  source          text not null default 'manual' check (source in ('manual', 'inbody', 'scale')),
  recorded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (coalesce(weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm) is not null)
);

create index body_measurements_member_idx on public.body_measurements (member_id, measured_on);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The caller's member record at a gym (null if none).
create function public.my_member_id(p_gym_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.members where gym_id = p_gym_id and user_id = auth.uid()
$$;

create function public.is_coach_of(p_gym_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.gym_users where gym_id = p_gym_id and user_id = p_user_id
                   and role in ('owner', 'manager', 'trainer'))
$$;

create function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    left join public.members m on m.id = c.member_id
    where c.id = p_conversation_id and (c.staff_id = auth.uid() or m.user_id = auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.classes            enable row level security;
alter table public.class_bookings     enable row level security;
alter table public.pt_sessions        enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.body_measurements  enable row level security;

revoke all on public.classes, public.class_bookings, public.pt_sessions, public.conversations,
              public.messages, public.body_measurements from anon;
revoke insert, update, delete on public.classes, public.class_bookings, public.pt_sessions, public.conversations,
              public.messages, public.body_measurements from authenticated;

grant insert (gym_id, name, description, trainer_id, weekday, start_time, duration_min, capacity, location)
  on public.classes to authenticated;
grant update (name, description, trainer_id, weekday, start_time, duration_min, capacity, location, is_active)
  on public.classes to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant insert (gym_id, member_id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, chest_cm, hips_cm,
              arm_cm, thigh_cm, notes, recorded_by) on public.body_measurements to authenticated;
grant update (measured_on, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm, notes)
  on public.body_measurements to authenticated;
grant delete on public.body_measurements to authenticated;

create policy classes_select on public.classes for select using (public.my_gym_role(gym_id) is not null);
create policy classes_insert on public.classes for insert
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy classes_update on public.classes for update
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));

create policy bookings_select on public.class_bookings for select
  using (public.is_gym_staff(gym_id) or public.is_my_member(member_id));

create policy pt_select on public.pt_sessions for select
  using (public.is_gym_staff(gym_id) or public.is_my_member(member_id));

-- Chat is private to the two people in it (not even the gym owner).
create policy conversations_select on public.conversations for select
  using (public.is_conversation_participant(id));
create policy messages_select on public.messages for select
  using (public.is_conversation_participant(conversation_id));
create policy messages_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

create policy measurements_select on public.body_measurements for select
  using (public.is_gym_staff(gym_id) or public.is_my_member(member_id));
create policy measurements_insert on public.body_measurements for insert
  with check (
    recorded_by = auth.uid()
    and (public.is_my_member_at(member_id, gym_id)
         or (public.can_coach(gym_id) and exists (select 1 from public.members m where m.id = member_id and m.gym_id = body_measurements.gym_id)))
  );
create policy measurements_update on public.body_measurements for update
  using (recorded_by = auth.uid() or public.can_coach(gym_id))
  with check (recorded_by = auth.uid() or public.can_coach(gym_id));
create policy measurements_delete on public.body_measurements for delete
  using (recorded_by = auth.uid() or public.can_coach(gym_id));

-- ---------------------------------------------------------------------------
-- Class booking
-- ---------------------------------------------------------------------------

-- Books a class on a date for the caller (member) or, for staff, for p_member_id.
-- Full classes put the member on the waitlist. Returns 'booked' or 'waitlist'.
create function public.book_class(p_class_id uuid, p_date date, p_member_id uuid default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_class   public.classes;
  v_member  uuid;
  v_today   date;
  v_taken   integer;
  v_status  text;
  v_existing public.class_bookings;
begin
  -- Lock the class so two people can't take the last spot at once.
  select * into v_class from public.classes where id = p_class_id for update;
  if v_class.id is null or not v_class.is_active then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;

  if p_member_id is null then
    v_member := public.my_member_id(v_class.gym_id);
    if v_member is null then
      raise exception 'Only members of this gym can book' using errcode = '42501';
    end if;
  else
    if not (public.can_handle_billing(v_class.gym_id) or public.can_coach(v_class.gym_id)) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    select id into v_member from public.members where id = p_member_id and gym_id = v_class.gym_id;
    if v_member is null then
      raise exception 'Member not found' using errcode = 'P0002';
    end if;
  end if;

  v_today := public.gym_today(v_class.gym_id);
  if p_date < v_today or p_date > v_today + 14 then
    raise exception 'You can book up to two weeks ahead' using errcode = '22023';
  end if;
  if extract(dow from p_date)::integer <> v_class.weekday then
    raise exception 'This class doesn''t run on that day' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships ms
    where ms.member_id = v_member and ms.cancelled_at is null and public.membership_rank(ms, p_date) = 2
  ) then
    raise exception 'An active membership is needed to book classes' using errcode = '22023';
  end if;

  select * into v_existing from public.class_bookings
   where class_id = p_class_id and session_date = p_date and member_id = v_member;
  if v_existing.id is not null and v_existing.status in ('booked', 'waitlist', 'attended') then
    raise exception 'Already booked' using errcode = '22023';
  end if;

  select count(*) into v_taken from public.class_bookings
   where class_id = p_class_id and session_date = p_date and status in ('booked', 'attended');
  v_status := case when v_taken < v_class.capacity then 'booked' else 'waitlist' end;

  if v_existing.id is not null then
    update public.class_bookings set status = v_status, created_at = now() where id = v_existing.id;
  else
    insert into public.class_bookings (gym_id, class_id, session_date, member_id, status)
    values (v_class.gym_id, p_class_id, p_date, v_member, v_status);
  end if;
  return v_status;
end;
$$;

-- Cancels a booking (member: their own; staff: anyone's). Frees the spot for
-- the first person on the waitlist.
create function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_b public.class_bookings;
  v_next uuid;
begin
  select * into v_b from public.class_bookings where id = p_booking_id;
  if v_b.id is null then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if not (public.is_my_member(v_b.member_id) or public.can_handle_billing(v_b.gym_id) or public.can_coach(v_b.gym_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_b.status not in ('booked', 'waitlist') then
    raise exception 'This booking can''t be cancelled' using errcode = '22023';
  end if;

  perform 1 from public.classes where id = v_b.class_id for update;
  update public.class_bookings set status = 'cancelled' where id = v_b.id;

  if v_b.status = 'booked' then
    select id into v_next from public.class_bookings
     where class_id = v_b.class_id and session_date = v_b.session_date and status = 'waitlist'
     order by created_at limit 1;
    if v_next is not null then
      update public.class_bookings set status = 'booked' where id = v_next;
    end if;
  end if;
end;
$$;

create function public.mark_attendance(p_booking_id uuid, p_attended boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_b public.class_bookings;
begin
  select * into v_b from public.class_bookings where id = p_booking_id;
  if v_b.id is null then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if not (public.can_coach(v_b.gym_id) or public.can_handle_billing(v_b.gym_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_b.status not in ('booked', 'attended', 'no_show') then
    raise exception 'Only booked members can be marked' using errcode = '22023';
  end if;
  update public.class_bookings set status = case when p_attended then 'attended' else 'no_show' end where id = v_b.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- PT sessions
-- ---------------------------------------------------------------------------

create function public.trainer_is_free(p_trainer_id uuid, p_starts_at timestamptz, p_duration integer, p_except uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.pt_sessions s
    where s.trainer_id = p_trainer_id and s.status = 'confirmed' and s.id is distinct from p_except
      and tstzrange(s.starts_at, s.starts_at + make_interval(mins => s.duration_min))
       && tstzrange(p_starts_at, p_starts_at + make_interval(mins => p_duration))
  )
$$;

-- Member asks a trainer for a session (status 'requested').
create function public.request_pt_session(
  p_gym_id uuid, p_trainer_id uuid, p_starts_at timestamptz, p_duration integer default 60, p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid := public.my_member_id(p_gym_id);
  v_id uuid;
begin
  if v_member is null then
    raise exception 'Only members of this gym can request sessions' using errcode = '42501';
  end if;
  if not public.is_coach_of(p_gym_id, p_trainer_id) then
    raise exception 'That trainer isn''t at this gym' using errcode = '22023';
  end if;
  if p_starts_at < now() then
    raise exception 'Pick a time in the future' using errcode = '22023';
  end if;
  insert into public.pt_sessions (gym_id, trainer_id, member_id, starts_at, duration_min, status, note, created_by)
  values (p_gym_id, p_trainer_id, v_member, p_starts_at, coalesce(p_duration, 60), 'requested', nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Staff books a confirmed session directly.
create function public.schedule_pt_session(
  p_member_id uuid, p_trainer_id uuid, p_starts_at timestamptz, p_duration integer default 60, p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym uuid;
  v_id uuid;
begin
  select gym_id into v_gym from public.members where id = p_member_id;
  if v_gym is null or not (public.can_coach(v_gym) or public.can_handle_billing(v_gym)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.is_coach_of(v_gym, p_trainer_id) then
    raise exception 'That trainer isn''t at this gym' using errcode = '22023';
  end if;
  if not public.trainer_is_free(p_trainer_id, p_starts_at, coalesce(p_duration, 60)) then
    raise exception 'The trainer already has a session at that time' using errcode = '22023';
  end if;
  insert into public.pt_sessions (gym_id, trainer_id, member_id, starts_at, duration_min, status, note, created_by)
  values (v_gym, p_trainer_id, p_member_id, p_starts_at, coalesce(p_duration, 60), 'confirmed', nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- p_action: 'confirm' | 'decline' | 'done' (the trainer or a manager) | 'cancel' (either side).
create function public.update_pt_session(p_session_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_s public.pt_sessions;
  v_staff boolean;
begin
  select * into v_s from public.pt_sessions where id = p_session_id for update;
  if v_s.id is null then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;
  v_staff := v_s.trainer_id = auth.uid() or public.has_gym_role(v_s.gym_id, array['owner', 'manager']::public.gym_role[]);

  if p_action = 'cancel' then
    if not (v_staff or public.is_my_member(v_s.member_id)) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if v_s.status not in ('requested', 'confirmed') then
      raise exception 'This session can''t be cancelled' using errcode = '22023';
    end if;
    update public.pt_sessions set status = 'cancelled' where id = v_s.id;
    return;
  end if;

  if not v_staff then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  case p_action
    when 'confirm' then
      if v_s.status <> 'requested' then
        raise exception 'Only requests can be confirmed' using errcode = '22023';
      end if;
      if not public.trainer_is_free(v_s.trainer_id, v_s.starts_at, v_s.duration_min, v_s.id) then
        raise exception 'You already have a session at that time' using errcode = '22023';
      end if;
      update public.pt_sessions set status = 'confirmed' where id = v_s.id;
    when 'decline' then
      if v_s.status <> 'requested' then
        raise exception 'Only requests can be declined' using errcode = '22023';
      end if;
      update public.pt_sessions set status = 'declined' where id = v_s.id;
    when 'done' then
      if v_s.status <> 'confirmed' then
        raise exception 'Only confirmed sessions can be completed' using errcode = '22023';
      end if;
      update public.pt_sessions set status = 'done' where id = v_s.id;
    else
      raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

-- Gets or creates the conversation between a member and a staff member.
-- Members pass the staff id; staff pass the member id.
create function public.open_conversation(p_gym_id uuid, p_staff_id uuid default null, p_member_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid;
  v_staff  uuid;
  v_id     uuid;
begin
  if p_member_id is null then
    v_member := public.my_member_id(p_gym_id);
    v_staff := p_staff_id;
    if v_member is null then
      raise exception 'Only members of this gym can start a chat' using errcode = '42501';
    end if;
    if not public.is_coach_of(p_gym_id, v_staff) then
      raise exception 'You can message the gym''s trainers and managers' using errcode = '22023';
    end if;
  else
    if not public.is_gym_staff(p_gym_id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    select id into v_member from public.members where id = p_member_id and gym_id = p_gym_id and user_id is not null;
    if v_member is null then
      raise exception 'This member has no portal account to chat with' using errcode = '22023';
    end if;
    v_staff := auth.uid();
  end if;

  select id into v_id from public.conversations where member_id = v_member and staff_id = v_staff;
  if v_id is null then
    insert into public.conversations (gym_id, member_id, staff_id) values (p_gym_id, v_member, v_staff)
    on conflict (member_id, staff_id) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations where member_id = v_member and staff_id = v_staff;
    end if;
  end if;
  return v_id;
end;
$$;

create function public.touch_conversation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.messages set read_at = now()
   where conversation_id = p_conversation_id and read_at is null and sender_id is distinct from auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.touch_conversation() from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.book_class(uuid, date, uuid)',
    'public.cancel_booking(uuid)',
    'public.mark_attendance(uuid, boolean)',
    'public.request_pt_session(uuid, uuid, timestamptz, integer, text)',
    'public.schedule_pt_session(uuid, uuid, timestamptz, integer, text)',
    'public.update_pt_session(uuid, text)',
    'public.open_conversation(uuid, uuid, uuid)',
    'public.mark_conversation_read(uuid)',
    'public.my_member_id(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Spots taken / waitlist size per class session, for anyone in the gym
-- (members can't read other people's bookings, only these counts).
create function public.class_spots(p_gym_id uuid, p_from date, p_to date)
returns table (class_id uuid, session_date date, taken integer, waiting integer)
language sql stable security definer set search_path = ''
as $$
  select b.class_id, b.session_date,
         (count(*) filter (where b.status in ('booked', 'attended')))::integer,
         (count(*) filter (where b.status = 'waitlist'))::integer
    from public.class_bookings b
   where b.gym_id = p_gym_id and b.session_date between p_from and p_to
     and public.my_gym_role(p_gym_id) is not null
   group by b.class_id, b.session_date
$$;

revoke execute on function public.class_spots(uuid, date, date) from public, anon;
grant execute on function public.class_spots(uuid, date, date) to authenticated;
