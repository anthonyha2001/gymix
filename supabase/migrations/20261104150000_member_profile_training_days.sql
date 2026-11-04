-- Member profile and training plan.
-- 1. Profile photo, language and notification choices on profiles.
-- 2. Training days: the weekdays a member plans to train, each optionally tied
--    to a program day. Used for today's workout, the weekly goal and reminders.
-- 3. Reminders on training days, and a notification for personal records.

alter table public.profiles
  add column avatar_path text check (char_length(avatar_path) <= 300),
  add column language text not null default 'en' check (language in ('en')),
  add column notify_prefs jsonb not null default '{"classes": true, "payments": true, "messages": true, "training": true}';
grant update (avatar_path, language, notify_prefs) on public.profiles to authenticated;

create table public.member_training_days (
  member_id       uuid not null references public.members (id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6),
  program_day_id  uuid references public.program_days (id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (member_id, weekday)
);

alter table public.member_training_days enable row level security;
revoke all on public.member_training_days from anon;
grant select, insert, update, delete on public.member_training_days to authenticated;

create policy training_days_select on public.member_training_days for select
  using (public.is_my_member(member_id)
         or exists (select 1 from public.members m where m.id = member_id and public.is_gym_staff(m.gym_id)));
create policy training_days_write on public.member_training_days for all
  using (public.is_my_member(member_id))
  with check (public.is_my_member(member_id));

-- Is this notification kind switched on for the signed-in user?
create function public.wants_notification(p_kind text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (notify_prefs ->> p_kind)::boolean from public.profiles where id = auth.uid()), true)
$$;

-- Member: today's training-day reminder (once a day, if they haven't trained yet).
create function public.make_training_reminder(p_gym_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid := public.my_member_id(p_gym_id);
  v_today  date := public.gym_today(p_gym_id);
  v_day    text;
begin
  if v_member is null or not public.wants_notification('training') then
    return;
  end if;
  select coalesce(pd.name, 'Training day') into v_day
    from public.member_training_days td
    left join public.program_days pd on pd.id = td.program_day_id
   where td.member_id = v_member and td.weekday = extract(dow from v_today);
  if v_day is null then
    return;
  end if;
  if exists (select 1 from public.workout_sessions w
              where w.member_id = v_member and (w.started_at at time zone 'Asia/Beirut')::date = v_today) then
    return;
  end if;
  perform public.notify(p_gym_id, auth.uid(), 'reminder', 'Today: ' || v_day,
    'It''s one of your training days. Tap to start your workout.', '/portal/train',
    'train:' || v_member || ':' || v_today);
end;
$$;

-- Member: a personal record was just logged (once per exercise per day).
create function public.note_personal_record(p_gym_id uuid, p_exercise text, p_weight numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid := public.my_member_id(p_gym_id);
begin
  if v_member is null or not public.wants_notification('training') then
    return;
  end if;
  perform public.notify(p_gym_id, auth.uid(), 'record', 'New personal record',
    left(p_exercise, 80) || ': ' || to_char(p_weight, 'FM9990.##') || ' kg', '/portal/progress?tab=records',
    'pr:' || v_member || ':' || md5(p_exercise) || ':' || public.gym_today(p_gym_id));
end;
$$;

revoke execute on function public.wants_notification(text) from public, anon;
revoke execute on function public.make_training_reminder(uuid) from public, anon;
revoke execute on function public.note_personal_record(uuid, text, numeric) from public, anon;
grant execute on function public.wants_notification(text) to authenticated;
grant execute on function public.make_training_reminder(uuid) to authenticated;
grant execute on function public.note_personal_record(uuid, text, numeric) to authenticated;
