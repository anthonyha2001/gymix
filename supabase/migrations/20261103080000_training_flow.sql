-- Training flow: a workout keeps its own exercise list (from a program day, added
-- by hand, or added by tapping a machine), so members can train without a program.
-- Plus a per-gym "tap simulator" for testing NFC taps without stickers.

create table public.workout_exercises (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.workout_sessions (id) on delete cascade,
  member_id            uuid not null references public.members (id) on delete cascade,
  exercise_id          text not null references public.exercises (id),
  position             integer not null default 0,
  -- Targets (sets/reps/weight) when it came from a program day.
  program_exercise_id  uuid references public.program_exercises (id) on delete set null,
  machine_id           uuid references public.gym_machines (id) on delete set null,
  added_via            text not null default 'manual' check (added_via in ('program', 'manual', 'machine')),
  created_at           timestamptz not null default now(),
  unique (session_id, exercise_id)
);

create index workout_exercises_session_idx on public.workout_exercises (session_id, position);

alter table public.workout_exercises enable row level security;
revoke all on public.workout_exercises from anon;
revoke insert, update, delete on public.workout_exercises from authenticated;
grant insert (session_id, member_id, exercise_id, position, program_exercise_id, machine_id, added_via)
  on public.workout_exercises to authenticated;
grant delete on public.workout_exercises to authenticated;

create policy wex_select on public.workout_exercises for select
  using (public.is_my_member(member_id) or public.is_gym_staff(public.session_gym(session_id)));
create policy wex_insert on public.workout_exercises for insert
  with check (public.is_my_member(member_id) and public.session_member(session_id) = member_id);
create policy wex_delete on public.workout_exercises for delete
  using (public.is_my_member(member_id));

-- Tap simulator: on while testing; owners switch it off before going live.
alter table public.gyms add column tap_simulator boolean not null default true;
grant select (tap_simulator), update (tap_simulator) on public.gyms to authenticated;

-- Simulated entrance tap (double-space in the member portal). Same rules as a
-- real sticker tap, but only while the gym has the simulator switched on.
create function public.simulated_check_in(p_gym_id uuid)
returns table (
  allowed boolean, already_in boolean, reason text, member_id uuid, full_name text,
  plan_name text, ends_on date, visits_left integer, balance_usd numeric
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member_id uuid := public.my_member_id(p_gym_id);
begin
  if v_member_id is null then
    raise exception 'Your account isn''t linked to a membership at this gym' using errcode = '42501';
  end if;
  if not (select tap_simulator from public.gyms where id = p_gym_id) then
    raise exception 'The tap simulator is switched off for this gym' using errcode = '42501';
  end if;
  return query select * from public.record_check_in(p_gym_id, v_member_id, 'tap');
end;
$$;

revoke execute on function public.simulated_check_in(uuid) from public, anon;
grant execute on function public.simulated_check_in(uuid) to authenticated;
