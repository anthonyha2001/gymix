-- Sharing a program with a friend: a link (/p/<token>) shown as a QR code or
-- sent with the phone's share sheet (AirDrop on iPhone). The friend sees the
-- program and, if they're a member of the same gym, adds a copy to their own
-- programs. Anyone else sees it with the gym's name, so it brings the gym new
-- members.
--
-- The gym decides (Settings → Member app):
--   off   members can't share programs
--   own   members can share programs they built themselves (default)
--   all   also programs from trainers (which may be paid work)

alter table public.gyms
  add column program_sharing text not null default 'own' check (program_sharing in ('off', 'own', 'all'));

create table public.program_shares (
  token       text primary key,
  program_id  uuid not null references public.programs (id) on delete cascade,
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  copies      integer not null default 0
);
create index program_shares_program_idx on public.program_shares (program_id);
alter table public.program_shares enable row level security;
-- No policies: only the functions below touch it.

-- A share link for one of my programs (the same one for 30 days).
create function public.share_program(p_program_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.programs%rowtype;
  v_mode text;
  v_token text;
begin
  select p.* into v_p from public.programs p
    join public.members m on m.id = p.member_id
   where p.id = p_program_id and m.user_id = auth.uid();
  if v_p.id is null then
    raise exception 'Not your program';
  end if;
  select program_sharing into v_mode from public.gyms where id = v_p.gym_id;
  if v_mode = 'off' or (v_mode = 'own' and v_p.kind <> 'self') then
    raise exception 'Your gym doesn''t allow sharing this program';
  end if;
  select token into v_token from public.program_shares
   where program_id = v_p.id and expires_at > now() + interval '1 day'
   order by created_at desc limit 1;
  if v_token is null then
    v_token := substr(md5(random()::text || clock_timestamp()::text || v_p.id::text), 1, 16);
    insert into public.program_shares (token, program_id, gym_id, created_by) values (v_token, v_p.id, v_p.gym_id, auth.uid());
  end if;
  return v_token;
end;
$$;
revoke execute on function public.share_program(uuid) from public, anon;
grant execute on function public.share_program(uuid) to authenticated;

-- What a share link shows (anyone with the link, signed in or not): the
-- program's days and exercises, who shared it (first name) and the gym. And
-- whether the viewer can add it (a member of the same gym).
create function public.shared_program(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.program_shares%rowtype;
  v_p public.programs%rowtype;
  v_mode text;
begin
  select * into v_s from public.program_shares where token = p_token and expires_at > now();
  if v_s.token is null then
    return null;
  end if;
  select * into v_p from public.programs where id = v_s.program_id;
  select program_sharing into v_mode from public.gyms where id = v_s.gym_id;
  if v_mode = 'off' or (v_mode = 'own' and v_p.kind <> 'self') then
    return null;
  end if;
  return jsonb_build_object(
    'name', v_p.name,
    'notes', v_p.notes,
    'gym', (select name from public.gyms where id = v_s.gym_id),
    'by', (select split_part(coalesce(full_name, ''), ' ', 1) from public.profiles where id = v_s.created_by),
    'from_trainer', v_p.kind = 'trainer',
    'can_add', exists (select 1 from public.members m where m.gym_id = v_s.gym_id and m.user_id = auth.uid() and m.archived_at is null),
    'signed_in', auth.uid() is not null,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', d.name,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object('name', e.name, 'sets', pe.sets, 'reps', pe.reps, 'muscles', e.primary_muscles, 'image', e.image_paths[1]) order by pe.position)
          from public.program_exercises pe join public.exercises e on e.id = pe.exercise_id
          where pe.day_id = d.id
        ), '[]'::jsonb)
      ) order by d.position)
      from public.program_days d where d.program_id = v_p.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.shared_program(text) from public;
grant execute on function public.shared_program(text) to anon, authenticated;

-- Adds a copy of a shared program to my programs (members of the same gym).
create function public.copy_shared_program(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.program_shares%rowtype;
  v_p public.programs%rowtype;
  v_member uuid;
  v_new uuid;
  v_day record;
  v_new_day uuid;
begin
  if public.shared_program(p_token) is null then
    raise exception 'This link has expired';
  end if;
  select * into v_s from public.program_shares where token = p_token;
  select * into v_p from public.programs where id = v_s.program_id;
  select id into v_member from public.members
   where gym_id = v_s.gym_id and user_id = auth.uid() and archived_at is null limit 1;
  if v_member is null then
    raise exception 'Only members of % can add this program', (select name from public.gyms where id = v_s.gym_id);
  end if;

  insert into public.programs (gym_id, member_id, name, notes, kind, is_active, created_by)
  values (v_s.gym_id, v_member, left(v_p.name, 80), v_p.notes, 'self', true, auth.uid())
  returning id into v_new;
  for v_day in select * from public.program_days where program_id = v_p.id order by position loop
    insert into public.program_days (program_id, position, name) values (v_new, v_day.position, v_day.name) returning id into v_new_day;
    insert into public.program_exercises (day_id, position, exercise_id, sets, reps, target_weight_kg, rest_seconds, notes)
    select v_new_day, position, exercise_id, sets, reps, null, rest_seconds, notes
      from public.program_exercises where day_id = v_day.id;
  end loop;
  update public.program_shares set copies = copies + 1 where token = p_token;
  return v_new;
end;
$$;
revoke execute on function public.copy_shared_program(text) from public, anon;
grant execute on function public.copy_shared_program(text) to authenticated;

grant update (program_sharing) on public.gyms to authenticated;
