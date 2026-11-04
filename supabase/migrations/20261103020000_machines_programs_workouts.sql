-- Phase 3: exercise library, gym machines, trainer/self programs, workout logging.
--
-- `exercises` is a shared catalog (seeded from free-exercise-db, public domain).
-- Images are stored as paths relative to an image host the app configures, so
-- the library can be re-hosted or swapped for a licensed one without a migration.
--
-- A gym's "available" exercises = exercises linked to its machines + bodyweight
-- exercises. Programs are built from those so members train on what the gym has.

-- ---------------------------------------------------------------------------
-- Exercise library & machines
-- ---------------------------------------------------------------------------

create table public.exercises (
  id                 text primary key,
  name               text not null,
  category           text,
  equipment          text,
  level              text,
  force              text,
  mechanic           text,
  primary_muscles    text[] not null default '{}',
  secondary_muscles  text[] not null default '{}',
  instructions       text[] not null default '{}',
  image_paths        text[] not null default '{}',
  source             text not null default 'free-exercise-db'
);

create index exercises_primary_muscles_idx on public.exercises using gin (primary_muscles);

create table public.gym_machines (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 2 and 80),
  description  text check (char_length(description) <= 500),
  -- Owner's own photo, in the gym-media storage bucket.
  photo_path   text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index gym_machines_gym_idx on public.gym_machines (gym_id);

create table public.machine_exercises (
  machine_id   uuid not null references public.gym_machines (id) on delete cascade,
  exercise_id  text not null references public.exercises (id) on delete cascade,
  primary key (machine_id, exercise_id)
);

create view public.gym_exercises with (security_invoker = true) as
select g.id as gym_id, e.*
from public.gyms g
join public.exercises e
  on e.equipment = 'body only'
  or exists (
    select 1 from public.machine_exercises me
    join public.gym_machines gm on gm.id = me.machine_id
    where gm.gym_id = g.id and me.exercise_id = e.id
  );

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------

-- What a program from a trainer costs (0 = free). The owner decides.
alter table public.gyms
  add column program_price_usd numeric(10, 2) not null default 0 check (program_price_usd >= 0);
grant update (program_price_usd) on public.gyms to authenticated;
grant select (program_price_usd) on public.gyms to authenticated;

create type public.program_goal as enum ('lose_fat', 'build_muscle', 'strength', 'general_fitness', 'rehab');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');

create table public.program_requests (
  id                    uuid primary key default gen_random_uuid(),
  gym_id                uuid not null references public.gyms (id) on delete cascade,
  member_id             uuid not null references public.members (id) on delete cascade,
  goal                  public.program_goal not null,
  days_per_week         integer not null check (days_per_week between 1 and 7),
  experience            public.experience_level not null,
  injuries              text check (char_length(injuries) <= 500),
  notes                 text check (char_length(notes) <= 1000),
  preferred_trainer_id  uuid references public.profiles (id) on delete set null,
  trainer_id            uuid references public.profiles (id) on delete set null,
  status                text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  invoice_id            uuid references public.invoices (id) on delete set null,
  program_id            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index program_requests_gym_status_idx on public.program_requests (gym_id, status);

create table public.programs (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  -- null for templates
  member_id   uuid references public.members (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 80),
  notes       text check (char_length(notes) <= 2000),
  kind        text not null check (kind in ('trainer', 'self', 'template')),
  -- Trainer programs start as drafts (inactive) and become active when sent.
  is_active   boolean not null default false,
  request_id  uuid references public.program_requests (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((kind = 'template') = (member_id is null))
);

create index programs_member_idx on public.programs (member_id);
create index programs_gym_kind_idx on public.programs (gym_id, kind);

alter table public.program_requests
  add constraint program_requests_program_fkey foreign key (program_id) references public.programs (id) on delete set null;

create table public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  position    integer not null default 0,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now()
);

create index program_days_program_idx on public.program_days (program_id, position);

create table public.program_exercises (
  id                uuid primary key default gen_random_uuid(),
  day_id            uuid not null references public.program_days (id) on delete cascade,
  position          integer not null default 0,
  exercise_id       text not null references public.exercises (id),
  sets              integer not null default 3 check (sets between 1 and 20),
  reps              text not null default '10' check (char_length(reps) between 1 and 20),
  target_weight_kg  numeric(6, 2) check (target_weight_kg >= 0),
  rest_seconds      integer not null default 90 check (rest_seconds between 0 and 900),
  notes             text check (char_length(notes) <= 300),
  -- Set when the member swapped the trainer's choice; the trainer sees both.
  swapped_from      text references public.exercises (id),
  swapped_at        timestamptz
);

create index program_exercises_day_idx on public.program_exercises (day_id, position);

-- ---------------------------------------------------------------------------
-- Workout logging
-- ---------------------------------------------------------------------------

create table public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  program_id   uuid references public.programs (id) on delete set null,
  day_id       uuid references public.program_days (id) on delete set null,
  day_name     text check (char_length(day_name) <= 60),
  notes        text check (char_length(notes) <= 1000),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index workout_sessions_member_idx on public.workout_sessions (member_id, started_at desc);

create table public.set_logs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workout_sessions (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  exercise_id  text not null references public.exercises (id),
  set_number   integer not null check (set_number between 1 and 50),
  weight_kg    numeric(6, 2) not null default 0 check (weight_kg >= 0),
  reps         integer not null check (reps between 0 and 500),
  logged_at    timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);

create index set_logs_member_exercise_idx on public.set_logs (member_id, exercise_id, logged_at desc);

-- Personal bests per member and exercise.
create view public.exercise_bests with (security_invoker = true) as
select
  member_id,
  exercise_id,
  max(weight_kg)                                    as best_weight_kg,
  max(reps) filter (where weight_kg = 0)            as best_bodyweight_reps,
  max(round(weight_kg * (1 + reps / 30.0), 1))      as best_est_1rm_kg,
  max(logged_at)                                    as last_logged_at,
  count(distinct session_id)                        as sessions
from public.set_logs
where reps > 0
group by member_id, exercise_id;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- Staff who build programs and manage machines.
create function public.can_coach(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_gym_role(p_gym_id, array['owner', 'manager', 'trainer']::public.gym_role[])
$$;

create function public.can_view_program(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.programs p
    where p.id = p_program_id
      and (public.is_gym_staff(p.gym_id) or (p.member_id is not null and public.is_my_member(p.member_id)))
  )
$$;

-- Coaches edit any program in their gym; members edit only programs they built themselves.
create function public.can_edit_program(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.programs p
    where p.id = p_program_id
      and (public.can_coach(p.gym_id) or (p.kind = 'self' and public.is_my_member(p.member_id)))
  )
$$;

create function public.day_program(p_day_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select program_id from public.program_days where id = p_day_id
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.exercises         enable row level security;
alter table public.gym_machines      enable row level security;
alter table public.machine_exercises enable row level security;
alter table public.program_requests  enable row level security;
alter table public.programs          enable row level security;
alter table public.program_days      enable row level security;
alter table public.program_exercises enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.set_logs          enable row level security;

revoke all on public.exercises, public.gym_machines, public.machine_exercises, public.program_requests,
              public.programs, public.program_days, public.program_exercises,
              public.workout_sessions, public.set_logs,
              public.gym_exercises, public.exercise_bests from anon;
revoke insert, update, delete on public.exercises, public.gym_machines, public.machine_exercises,
              public.program_requests, public.programs, public.program_days, public.program_exercises,
              public.workout_sessions, public.set_logs from authenticated;

grant insert (gym_id, name, description, photo_path, created_by) on public.gym_machines to authenticated;
grant update (name, description, photo_path) on public.gym_machines to authenticated;
grant delete on public.gym_machines to authenticated;
grant insert, delete on public.machine_exercises to authenticated;

grant insert (gym_id, member_id, name, notes, kind, is_active, created_by) on public.programs to authenticated;
grant update (name, notes, is_active) on public.programs to authenticated;
grant delete on public.programs to authenticated;
grant insert (program_id, position, name) on public.program_days to authenticated;
grant update (position, name) on public.program_days to authenticated;
grant delete on public.program_days to authenticated;
grant insert (day_id, position, exercise_id, sets, reps, target_weight_kg, rest_seconds, notes)
  on public.program_exercises to authenticated;
grant update (position, exercise_id, sets, reps, target_weight_kg, rest_seconds, notes)
  on public.program_exercises to authenticated;
grant delete on public.program_exercises to authenticated;

grant insert (gym_id, member_id, program_id, day_id, day_name, notes) on public.workout_sessions to authenticated;
grant update (finished_at, notes) on public.workout_sessions to authenticated;
grant delete on public.workout_sessions to authenticated;
grant insert (session_id, member_id, exercise_id, set_number, weight_kg, reps) on public.set_logs to authenticated;
grant update (weight_kg, reps) on public.set_logs to authenticated;
grant delete on public.set_logs to authenticated;

create policy exercises_select on public.exercises for select to authenticated using (true);

create policy machines_select on public.gym_machines for select
  using (public.my_gym_role(gym_id) is not null);
create policy machines_insert on public.gym_machines for insert
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]) and created_by = auth.uid());
create policy machines_update on public.gym_machines for update
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy machines_delete on public.gym_machines for delete
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));

create function public.machine_gym(p_machine_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select gym_id from public.gym_machines where id = p_machine_id
$$;

create policy machine_exercises_select on public.machine_exercises for select
  using (public.my_gym_role(public.machine_gym(machine_id)) is not null);
create policy machine_exercises_insert on public.machine_exercises for insert
  with check (public.has_gym_role(public.machine_gym(machine_id), array['owner', 'manager']::public.gym_role[]));
create policy machine_exercises_delete on public.machine_exercises for delete
  using (public.has_gym_role(public.machine_gym(machine_id), array['owner', 'manager']::public.gym_role[]));

create policy requests_select on public.program_requests for select
  using (public.can_coach(gym_id) or public.is_my_member(member_id));

create policy programs_select on public.programs for select
  using (public.is_gym_staff(gym_id) or (member_id is not null and public.is_my_member(member_id)));
create policy programs_insert on public.programs for insert
  with check (
    created_by = auth.uid()
    and (
      (kind in ('trainer', 'template') and public.can_coach(gym_id))
      or (kind = 'self' and public.is_my_member(member_id)
          and exists (select 1 from public.members m where m.id = member_id and m.gym_id = programs.gym_id))
    )
  );
create policy programs_update on public.programs for update
  using (public.can_edit_program(id)) with check (public.can_edit_program(id));
create policy programs_delete on public.programs for delete
  using (public.can_edit_program(id));

create policy days_select on public.program_days for select using (public.can_view_program(program_id));
create policy days_insert on public.program_days for insert with check (public.can_edit_program(program_id));
create policy days_update on public.program_days for update
  using (public.can_edit_program(program_id)) with check (public.can_edit_program(program_id));
create policy days_delete on public.program_days for delete using (public.can_edit_program(program_id));

create policy pe_select on public.program_exercises for select
  using (public.can_view_program(public.day_program(day_id)));
create policy pe_insert on public.program_exercises for insert
  with check (public.can_edit_program(public.day_program(day_id)));
create policy pe_update on public.program_exercises for update
  using (public.can_edit_program(public.day_program(day_id)))
  with check (public.can_edit_program(public.day_program(day_id)));
create policy pe_delete on public.program_exercises for delete
  using (public.can_edit_program(public.day_program(day_id)));

-- Members log their own workouts; staff can read them (trainers follow progress).
create function public.is_my_member_at(p_member_id uuid, p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members where id = p_member_id and gym_id = p_gym_id and user_id = auth.uid())
$$;

create policy sessions_select on public.workout_sessions for select
  using (public.is_gym_staff(gym_id) or public.is_my_member(member_id));
create policy sessions_insert on public.workout_sessions for insert
  with check (public.is_my_member_at(member_id, gym_id));
create policy sessions_update on public.workout_sessions for update
  using (public.is_my_member(member_id)) with check (public.is_my_member(member_id));
create policy sessions_delete on public.workout_sessions for delete
  using (public.is_my_member(member_id));

create function public.session_member(p_session_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select member_id from public.workout_sessions where id = p_session_id
$$;

create function public.session_gym(p_session_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select gym_id from public.workout_sessions where id = p_session_id
$$;

create policy sets_select on public.set_logs for select
  using (public.is_my_member(member_id) or public.is_gym_staff(public.session_gym(session_id)));
create policy sets_insert on public.set_logs for insert
  with check (public.is_my_member(member_id) and public.session_member(session_id) = member_id);
create policy sets_update on public.set_logs for update
  using (public.is_my_member(member_id)) with check (public.is_my_member(member_id));
create policy sets_delete on public.set_logs for delete
  using (public.is_my_member(member_id));

-- ---------------------------------------------------------------------------
-- Program operations
-- ---------------------------------------------------------------------------

create function public.touch_program()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger programs_touch before update on public.programs
  for each row execute function public.touch_program();
create trigger program_requests_touch before update on public.program_requests
  for each row execute function public.touch_program();

-- Member asks for a program. If the gym charges for programs, an invoice is
-- created at the same time.
create function public.request_program(
  p_gym_id                uuid,
  p_goal                  public.program_goal,
  p_days_per_week         integer,
  p_experience            public.experience_level,
  p_injuries              text default null,
  p_notes                 text default null,
  p_preferred_trainer_id  uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_member_id  uuid;
  v_price      numeric;
  v_number     integer;
  v_invoice_id uuid;
  v_id         uuid;
begin
  select id into v_member_id from public.members where gym_id = p_gym_id and user_id = auth.uid();
  if v_member_id is null then
    raise exception 'Only members of this gym can request a program' using errcode = '42501';
  end if;
  if exists (select 1 from public.program_requests
              where member_id = v_member_id and status in ('open', 'in_progress')) then
    raise exception 'You already have a program request in progress' using errcode = '22023';
  end if;
  if p_preferred_trainer_id is not null and not exists (
    select 1 from public.gym_users where gym_id = p_gym_id and user_id = p_preferred_trainer_id
      and role in ('owner', 'manager', 'trainer')
  ) then
    raise exception 'That trainer isn''t at this gym' using errcode = '22023';
  end if;

  select program_price_usd into v_price from public.gyms where id = p_gym_id;
  if v_price > 0 then
    update public.gyms set next_invoice_number = next_invoice_number + 1
     where id = p_gym_id returning next_invoice_number - 1 into v_number;
    insert into public.invoices (gym_id, member_id, number, description, amount_usd, issued_on, created_by)
    values (p_gym_id, v_member_id, v_number, 'Personal training program', v_price,
            public.gym_today(p_gym_id), auth.uid())
    returning id into v_invoice_id;
  end if;

  insert into public.program_requests (gym_id, member_id, goal, days_per_week, experience, injuries, notes,
                                       preferred_trainer_id, invoice_id)
  values (p_gym_id, v_member_id, p_goal, p_days_per_week, p_experience,
          nullif(trim(p_injuries), ''), nullif(trim(p_notes), ''), p_preferred_trainer_id, v_invoice_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Copies a program's days and exercises into a new program. Internal.
create function public.copy_program(p_source_id uuid, p_target_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  d record;
  v_day_id uuid;
begin
  for d in select * from public.program_days where program_id = p_source_id order by position loop
    insert into public.program_days (program_id, position, name)
    values (p_target_id, d.position, d.name) returning id into v_day_id;
    insert into public.program_exercises (day_id, position, exercise_id, sets, reps, target_weight_kg, rest_seconds, notes)
    select v_day_id, position, exercise_id, sets, reps, target_weight_kg, rest_seconds, notes
      from public.program_exercises where day_id = d.id;
  end loop;
end;
$$;

-- Coach starts a program for a member: from a request and/or a template.
-- Returns the new (draft) program's id.
create function public.create_member_program(
  p_member_id    uuid,
  p_name         text,
  p_request_id   uuid default null,
  p_template_id  uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym_id  uuid;
  v_req     public.program_requests;
  v_id      uuid;
begin
  select gym_id into v_gym_id from public.members where id = p_member_id;
  if v_gym_id is null or not public.can_coach(v_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_request_id is not null then
    select * into v_req from public.program_requests where id = p_request_id for update;
    if v_req.id is null or v_req.member_id <> p_member_id then
      raise exception 'Request not found' using errcode = 'P0002';
    end if;
    if v_req.status not in ('open', 'in_progress') then
      raise exception 'This request is already closed' using errcode = '22023';
    end if;
  end if;

  if p_template_id is not null and not exists (
    select 1 from public.programs where id = p_template_id and gym_id = v_gym_id
  ) then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;

  insert into public.programs (gym_id, member_id, name, kind, request_id, created_by)
  values (v_gym_id, p_member_id, coalesce(nullif(trim(p_name), ''), 'Training program'), 'trainer', p_request_id, auth.uid())
  returning id into v_id;

  if p_template_id is not null then
    perform public.copy_program(p_template_id, v_id);
  end if;

  if p_request_id is not null then
    update public.program_requests
       set status = 'in_progress', trainer_id = auth.uid(), program_id = v_id
     where id = p_request_id;
  end if;
  return v_id;
end;
$$;

-- Saves a program as a reusable template (coaches only).
create function public.save_as_template(p_program_id uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_id     uuid;
begin
  select gym_id into v_gym_id from public.programs where id = p_program_id;
  if v_gym_id is null or not public.can_coach(v_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.programs (gym_id, member_id, name, kind, is_active, created_by)
  values (v_gym_id, null, coalesce(nullif(trim(p_name), ''), 'Template'), 'template', true, auth.uid())
  returning id into v_id;
  perform public.copy_program(p_program_id, v_id);
  return v_id;
end;
$$;

-- Sends a trainer's draft to the member: activates it, retires their previous
-- trainer program and closes the request.
create function public.publish_program(p_program_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.programs;
begin
  select * into v_p from public.programs where id = p_program_id for update;
  if v_p.id is null or v_p.kind <> 'trainer' or not public.can_coach(v_p.gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.program_exercises pe join public.program_days d on d.id = pe.day_id
                  where d.program_id = p_program_id) then
    raise exception 'Add at least one exercise before sending the program' using errcode = '22023';
  end if;

  update public.programs set is_active = false
   where member_id = v_p.member_id and kind = 'trainer' and id <> v_p.id and is_active;
  update public.programs set is_active = true where id = v_p.id;
  update public.program_requests set status = 'done' where id = v_p.request_id;
end;
$$;

-- Member swaps an exercise in their own program (trainer's or self-built) for
-- another exercise this gym has. Swapping back to the original clears the flag.
create function public.swap_program_exercise(p_program_exercise_id uuid, p_exercise_id text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_pe      public.program_exercises;
  v_program public.programs;
begin
  select * into v_pe from public.program_exercises where id = p_program_exercise_id for update;
  if v_pe.id is null then
    raise exception 'Exercise not found' using errcode = 'P0002';
  end if;
  select p.* into v_program from public.programs p join public.program_days d on d.program_id = p.id where d.id = v_pe.day_id;

  if not (public.is_my_member(v_program.member_id) or public.can_coach(v_program.gym_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.gym_exercises where gym_id = v_program.gym_id and id = p_exercise_id) then
    raise exception 'This gym doesn''t have the equipment for that exercise' using errcode = '22023';
  end if;

  update public.program_exercises
     set exercise_id  = p_exercise_id,
         swapped_from = case when coalesce(v_pe.swapped_from, v_pe.exercise_id) = p_exercise_id then null
                             else coalesce(v_pe.swapped_from, v_pe.exercise_id) end,
         swapped_at   = case when coalesce(v_pe.swapped_from, v_pe.exercise_id) = p_exercise_id then null else now() end
   where id = v_pe.id;
end;
$$;

-- Names of the gym's coaches, for members choosing a preferred trainer
-- (members can't read the staff roster itself).
create function public.gym_coaches(p_gym_id uuid)
returns table (id uuid, full_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name
    from public.gym_users gu
    join public.profiles p on p.id = gu.user_id
   where gu.gym_id = p_gym_id
     and gu.role in ('owner', 'manager', 'trainer')
     and public.my_gym_role(p_gym_id) is not null
   order by p.full_name
$$;

-- Coach closes a request without a program (e.g. member changed their mind).
create function public.cancel_program_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.program_requests;
begin
  select * into v_req from public.program_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if not (public.can_coach(v_req.gym_id) or public.is_my_member(v_req.member_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_req.status not in ('open', 'in_progress') then
    raise exception 'This request is already closed' using errcode = '22023';
  end if;
  update public.program_requests set status = 'cancelled' where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage for machine photos (only on Supabase, which has the storage schema)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('gym-media', 'gym-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  -- Files live under <gym_id>/...; owners and managers of that gym manage them.
  execute $p$
    create policy gym_media_write on storage.objects for insert to authenticated
      with check (bucket_id = 'gym-media'
                  and public.has_gym_role(((storage.foldername(name))[1])::uuid, array['owner', 'manager']::public.gym_role[]))
  $p$;
  execute $p$
    create policy gym_media_delete on storage.objects for delete to authenticated
      using (bucket_id = 'gym-media'
             and public.has_gym_role(((storage.foldername(name))[1])::uuid, array['owner', 'manager']::public.gym_role[]))
  $p$;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.copy_program(uuid, uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.request_program(uuid, public.program_goal, integer, public.experience_level, text, text, uuid)',
    'public.create_member_program(uuid, text, uuid, uuid)',
    'public.save_as_template(uuid, text)',
    'public.publish_program(uuid)',
    'public.swap_program_exercise(uuid, text)',
    'public.cancel_program_request(uuid)',
    'public.gym_coaches(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
