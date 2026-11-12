-- Monthly challenges: the gym posts a challenge ("Most visits in November"),
-- members swipe to join, and a live leaderboard ranks everyone who joined.
-- Scores come from what Gymix already records, so nobody types numbers in:
--   visits    days at the gym (allowed check-ins, one per day)
--   workouts  finished workouts with at least one logged set
--   volume    kilograms lifted (weight x reps of every logged set)
--   classes   classes attended
-- A challenge may have a target ("12 visits"): everyone who reaches it
-- completes it, and the top three get medals when it ends.

create table public.challenges (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 2 and 60),
  description  text check (char_length(description) <= 300),
  metric       text not null check (metric in ('visits', 'workouts', 'volume', 'classes')),
  target       numeric(12, 0) check (target > 0 and target <= 100000000),
  prize        text check (char_length(prize) <= 120),
  starts_on    date not null,
  ends_on      date not null,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 92)
);
create index challenges_gym_idx on public.challenges (gym_id, ends_on desc);

-- Who joined (or swiped it away). Only "joined" members are ranked.
create table public.challenge_entries (
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  status        text not null check (status in ('joined', 'skipped')),
  updated_at    timestamptz not null default now(),
  primary key (challenge_id, member_id)
);
create index challenge_entries_member_idx on public.challenge_entries (member_id);

alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;

create policy challenges_select on public.challenges for select to authenticated
  using (public.is_gym_staff(gym_id) or public.my_member_id(gym_id) is not null);
create policy challenges_insert on public.challenges for insert to authenticated
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy challenges_update on public.challenges for update to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy challenges_delete on public.challenges for delete to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
revoke insert, update on public.challenges from authenticated;
grant insert (gym_id, title, description, metric, target, prize, starts_on, ends_on) on public.challenges to authenticated;
grant update (title, description, metric, target, prize, starts_on, ends_on) on public.challenges to authenticated;

create policy challenge_entries_select on public.challenge_entries for select to authenticated
  using (public.is_gym_staff(gym_id) or member_id = public.my_member_id(gym_id));
revoke insert, update, delete on public.challenge_entries from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Scores
-- ---------------------------------------------------------------------------
-- Every joined member's score, from the gym's own records, in the gym's timezone.
create function public.challenge_scores(p_challenge_id uuid)
returns table (member_id uuid, score numeric, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with ch as (
    select c.metric, c.starts_on, c.ends_on, g.timezone as tz
      from public.challenges c join public.gyms g on g.id = c.gym_id
     where c.id = p_challenge_id
  )
  select e.member_id,
         coalesce(case ch.metric
           when 'visits' then (
             select count(distinct (k.checked_in_at at time zone ch.tz)::date)
               from public.checkins k
              where k.member_id = e.member_id and k.allowed
                and (k.checked_in_at at time zone ch.tz)::date between ch.starts_on and ch.ends_on)
           when 'workouts' then (
             select count(*)
               from public.workout_sessions w
              where w.member_id = e.member_id and w.finished_at is not null
                and (w.started_at at time zone ch.tz)::date between ch.starts_on and ch.ends_on
                and exists (select 1 from public.set_logs s where s.session_id = w.id))
           when 'volume' then (
             select round(sum(s.weight_kg * s.reps))
               from public.set_logs s
              where s.member_id = e.member_id
                and (s.logged_at at time zone ch.tz)::date between ch.starts_on and ch.ends_on)
           when 'classes' then (
             select count(*)
               from public.class_bookings b
              where b.member_id = e.member_id and b.status = 'attended'
                and b.session_date between ch.starts_on and ch.ends_on)
         end, 0)::numeric,
         e.updated_at
    from public.challenge_entries e cross join ch
   where e.challenge_id = p_challenge_id and e.status = 'joined'
$$;

-- The leaderboard. Staff see full names; members see first names and an
-- initial ("Nour K."), and only their own row is marked as theirs.
create function public.challenge_board(p_challenge_id uuid, p_limit integer default 50)
returns table (rank integer, member_id uuid, name text, score numeric, completed boolean, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ch    public.challenges;
  v_staff boolean;
  v_me    uuid;
begin
  select * into v_ch from public.challenges where id = p_challenge_id;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  v_staff := public.is_gym_staff(v_ch.gym_id);
  v_me := public.my_member_id(v_ch.gym_id);
  if not v_staff and v_me is null then raise exception 'Not allowed' using errcode = '42501'; end if;

  return query
  with ranked as (
    select s.member_id, s.score,
           rank() over (order by s.score desc)::integer as rk,
           row_number() over (order by s.score desc, s.joined_at) as rn
      from public.challenge_scores(p_challenge_id) s
  )
  select r.rk,
         case when v_staff or r.member_id = v_me then r.member_id end,
         case when v_staff then m.full_name
              else split_part(trim(m.full_name), ' ', 1)
                   || coalesce(' ' || nullif(left(split_part(trim(m.full_name), ' ', 2), 1), '') || '.', '') end,
         r.score,
         v_ch.target is not null and r.score >= v_ch.target,
         r.member_id is not distinct from v_me
    from ranked r join public.members m on m.id = r.member_id
   where r.rn <= greatest(1, least(p_limit, 500)) or r.member_id = v_me
   order by r.rn;
end;
$$;

-- ---------------------------------------------------------------------------
-- The member's side
-- ---------------------------------------------------------------------------
-- Challenges for the member's portal: running and upcoming ones, and those
-- that ended in the last 45 days, with the member's own status, score and rank
-- and the top three.
create function public.member_challenges(p_gym_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me     uuid := public.my_member_id(p_gym_id);
  v_today  date := public.gym_today(p_gym_id);
  v_out    jsonb := '[]';
  v_ch     public.challenges;
  v_status text;
  v_mine   record;
  v_count  integer;
  v_top    jsonb;
begin
  if v_me is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  for v_ch in
    select * from public.challenges c
     where c.gym_id = p_gym_id and c.ends_on >= v_today - 45
     order by case when c.starts_on <= v_today and c.ends_on >= v_today then 0 when c.starts_on > v_today then 1 else 2 end,
              case when c.ends_on >= v_today then c.ends_on end, c.ends_on desc
  loop
    select e.status into v_status from public.challenge_entries e where e.challenge_id = v_ch.id and e.member_id = v_me;
    select count(*) into v_count from public.challenge_entries e where e.challenge_id = v_ch.id and e.status = 'joined';
    select b.rank, b.score, b.completed into v_mine from public.challenge_board(v_ch.id, 3) b where b.is_me;
    select coalesce(jsonb_agg(jsonb_build_object('rank', b.rank, 'name', b.name, 'score', b.score, 'me', b.is_me) order by b.rank), '[]')
      into v_top from public.challenge_board(v_ch.id, 3) b where b.rank <= 3;
    v_out := v_out || jsonb_build_object(
      'id', v_ch.id, 'title', v_ch.title, 'description', v_ch.description, 'metric', v_ch.metric,
      'target', v_ch.target, 'prize', v_ch.prize, 'starts_on', v_ch.starts_on, 'ends_on', v_ch.ends_on,
      'state', case when v_ch.starts_on > v_today then 'upcoming' when v_ch.ends_on < v_today then 'ended' else 'active' end,
      'days_left', greatest(0, v_ch.ends_on - v_today + 1),
      'status', v_status, 'participants', v_count,
      'score', v_mine.score, 'rank', v_mine.rank, 'completed', coalesce(v_mine.completed, false),
      'top', v_top);
  end loop;
  return v_out;
end;
$$;

-- Join (or swipe away) a challenge. Ended challenges can't be joined.
create function public.challenge_set_entry(p_challenge_id uuid, p_join boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ch public.challenges;
  v_me uuid;
begin
  select * into v_ch from public.challenges where id = p_challenge_id;
  if not found then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  v_me := public.my_member_id(v_ch.gym_id);
  if v_me is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_join and v_ch.ends_on < public.gym_today(v_ch.gym_id) then
    raise exception 'This challenge has ended.' using errcode = '22023';
  end if;
  insert into public.challenge_entries (challenge_id, member_id, gym_id, status)
  values (v_ch.id, v_me, v_ch.gym_id, case when p_join then 'joined' else 'skipped' end)
  on conflict (challenge_id, member_id) do update set status = excluded.status, updated_at = now();
end;
$$;

-- A new challenge: tell every member who has an account.
create function public.challenges_announce()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (gym_id, user_id, kind, title, body, link, dedupe_key)
  select new.gym_id, m.user_id, 'challenge', left('New challenge: ' || new.title, 120),
         left(coalesce(new.prize, coalesce(new.description, 'Swipe right to join.')), 300),
         '/portal/challenges', 'challenge:' || new.id || ':' || m.user_id
    from public.members m
   where m.gym_id = new.gym_id and m.user_id is not null and m.archived_at is null
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
create trigger challenges_announce after insert on public.challenges
  for each row execute function public.challenges_announce();

revoke execute on function public.challenge_scores(uuid) from public, anon, authenticated;
revoke execute on function public.challenges_announce() from public, anon, authenticated;
revoke execute on function public.challenge_board(uuid, integer) from public, anon;
revoke execute on function public.member_challenges(uuid) from public, anon;
revoke execute on function public.challenge_set_entry(uuid, boolean) from public, anon;
grant execute on function public.challenge_board(uuid, integer) to authenticated;
grant execute on function public.member_challenges(uuid) to authenticated;
grant execute on function public.challenge_set_entry(uuid, boolean) to authenticated;

insert into public.features (key, name, description, rollout) values
  ('challenges', 'Monthly challenges', 'The gym posts challenges (visits, workouts, kg lifted, classes); members swipe to join and climb a live leaderboard.', 'all');
