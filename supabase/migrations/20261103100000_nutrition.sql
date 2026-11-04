-- Nutrition: members ask for a diet plan, a dietitian builds it (targets +
-- meals) and sends it; the member sees it in the portal.
-- Also: the owner chooses which portal pages members can see.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- Owners can add dietitians; managers too.
create or replace function public.can_assign_role(p_gym_id uuid, p_role public.gym_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case public.my_gym_role(p_gym_id)
    when 'owner'      then p_role <> 'owner'
    when 'manager'    then p_role in ('front_desk', 'trainer', 'dietitian', 'member')
    when 'front_desk' then p_role = 'member'
    else false
  end
$$;

-- Build nutrition plans.
create function public.can_diet(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_gym_role(p_gym_id, array['owner', 'manager', 'dietitian']::public.gym_role[])
$$;

-- Names and roles of a gym's staff, for anyone in the gym (members can't read
-- staff profiles directly).
create function public.gym_staff_names(p_gym_id uuid)
returns table (id uuid, full_name text, role public.gym_role)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name, gu.role
    from public.gym_users gu
    join public.profiles p on p.id = gu.user_id
   where gu.gym_id = p_gym_id
     and gu.role <> 'member'
     and public.my_gym_role(p_gym_id) is not null
   order by p.full_name
$$;

-- ---------------------------------------------------------------------------
-- Portal pages the owner switches on or off
-- ---------------------------------------------------------------------------

-- Sections hidden from members, e.g. {'nutrition','messages'}.
alter table public.gyms add column portal_hidden text[] not null default '{}'
  check (portal_hidden <@ array['train', 'programs', 'nutrition', 'machines', 'schedule', 'progress', 'history', 'messages']);
grant select (portal_hidden), update (portal_hidden) on public.gyms to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.nutrition_requests (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  goal          text not null check (goal in ('lose_fat', 'build_muscle', 'maintain', 'health', 'performance')),
  weight_kg     numeric(5, 1) check (weight_kg between 20 and 400),
  height_cm     numeric(5, 1) check (height_cm between 90 and 250),
  activity      text not null default 'moderate' check (activity in ('low', 'moderate', 'high')),
  allergies     text check (char_length(allergies) <= 500),
  preferences   text check (char_length(preferences) <= 500),
  notes         text check (char_length(notes) <= 1000),
  dietitian_id  uuid references public.profiles (id) on delete set null,
  status        text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  plan_id       uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index nutrition_requests_gym_status_idx on public.nutrition_requests (gym_id, status);
create unique index nutrition_requests_one_open on public.nutrition_requests (member_id)
  where status in ('open', 'in_progress');

create table public.nutrition_plans (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  dietitian_id  uuid references public.profiles (id) on delete set null,
  request_id    uuid references public.nutrition_requests (id) on delete set null,
  name          text not null default 'Nutrition plan' check (char_length(name) between 1 and 80),
  status        text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  calories      integer check (calories between 800 and 6000),
  protein_g     integer check (protein_g between 0 and 500),
  carbs_g       integer check (carbs_g between 0 and 1000),
  fat_g         integer check (fat_g between 0 and 400),
  water_l       numeric(3, 1) check (water_l between 0 and 10),
  guidelines    text check (char_length(guidelines) <= 2000),
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index nutrition_plans_member_idx on public.nutrition_plans (member_id, status);
create unique index nutrition_plans_one_active on public.nutrition_plans (member_id) where status = 'active';

alter table public.nutrition_requests
  add constraint nutrition_requests_plan_fkey foreign key (plan_id) references public.nutrition_plans (id) on delete set null;

create table public.nutrition_meals (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.nutrition_plans (id) on delete cascade,
  position    integer not null default 0,
  name        text not null check (char_length(name) between 1 and 60),
  time_label  text check (char_length(time_label) <= 20),
  items       text not null default '' check (char_length(items) <= 2000),
  calories    integer check (calories between 0 and 3000),
  created_at  timestamptz not null default now()
);
create index nutrition_meals_plan_idx on public.nutrition_meals (plan_id, position);

create trigger nutrition_requests_touch before update on public.nutrition_requests
  for each row execute function public.touch_updated_at();
create trigger nutrition_plans_touch before update on public.nutrition_plans
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers + RLS
-- ---------------------------------------------------------------------------

create function public.nutrition_plan_gym(p_plan_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select gym_id from public.nutrition_plans where id = p_plan_id
$$;

-- Staff see every plan in their gym; the member sees their own once sent.
create function public.can_view_nutrition_plan(p_plan_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.nutrition_plans p
     where p.id = p_plan_id
       and (public.is_gym_staff(p.gym_id) or (p.status <> 'draft' and public.is_my_member(p.member_id)))
  )
$$;

alter table public.nutrition_requests enable row level security;
alter table public.nutrition_plans    enable row level security;
alter table public.nutrition_meals    enable row level security;

revoke all on public.nutrition_requests, public.nutrition_plans, public.nutrition_meals from anon, authenticated;
grant select on public.nutrition_requests, public.nutrition_plans, public.nutrition_meals to authenticated;
grant insert, delete on public.nutrition_meals to authenticated;
grant update (name, calories, protein_g, carbs_g, fat_g, water_l, guidelines) on public.nutrition_plans to authenticated;
grant update (position, name, time_label, items, calories) on public.nutrition_meals to authenticated;
grant delete on public.nutrition_plans to authenticated;

create policy nutrition_requests_select on public.nutrition_requests for select
  using (public.can_diet(gym_id) or public.is_my_member(member_id));

create policy nutrition_plans_select on public.nutrition_plans for select
  using (public.is_gym_staff(gym_id) or (status <> 'draft' and public.is_my_member(member_id)));
create policy nutrition_plans_update on public.nutrition_plans for update
  using (public.can_diet(gym_id)) with check (public.can_diet(gym_id));
create policy nutrition_plans_delete on public.nutrition_plans for delete
  using (public.can_diet(gym_id));

create policy nutrition_meals_select on public.nutrition_meals for select
  using (public.can_view_nutrition_plan(plan_id));
create policy nutrition_meals_insert on public.nutrition_meals for insert
  with check (public.can_diet(public.nutrition_plan_gym(plan_id)));
create policy nutrition_meals_update on public.nutrition_meals for update
  using (public.can_diet(public.nutrition_plan_gym(plan_id)))
  with check (public.can_diet(public.nutrition_plan_gym(plan_id)));
create policy nutrition_meals_delete on public.nutrition_meals for delete
  using (public.can_diet(public.nutrition_plan_gym(plan_id)));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Member asks for a nutrition plan (one open request at a time).
create function public.request_nutrition_plan(
  p_gym_id      uuid,
  p_goal        text,
  p_weight_kg   numeric default null,
  p_height_cm   numeric default null,
  p_activity    text default 'moderate',
  p_allergies   text default null,
  p_preferences text default null,
  p_notes       text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_member_id uuid;
  v_id        uuid;
begin
  select id into v_member_id from public.members where gym_id = p_gym_id and user_id = auth.uid();
  if v_member_id is null then
    raise exception 'Only members of this gym can request a nutrition plan' using errcode = '42501';
  end if;
  if exists (select 1 from public.nutrition_requests where member_id = v_member_id and status in ('open', 'in_progress')) then
    raise exception 'You already have a nutrition request in progress' using errcode = '22023';
  end if;
  insert into public.nutrition_requests (gym_id, member_id, goal, weight_kg, height_cm, activity, allergies, preferences, notes)
  values (p_gym_id, v_member_id, p_goal, p_weight_kg, p_height_cm, coalesce(p_activity, 'moderate'),
          nullif(trim(p_allergies), ''), nullif(trim(p_preferences), ''), nullif(trim(p_notes), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Member withdraws their own open request; a dietitian can close any request.
create function public.cancel_nutrition_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.nutrition_requests;
begin
  select * into v_req from public.nutrition_requests where id = p_request_id for update;
  if v_req.id is null or not (public.can_diet(v_req.gym_id) or public.is_my_member(v_req.member_id)) then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if v_req.status not in ('open', 'in_progress') then
    raise exception 'This request is already closed' using errcode = '22023';
  end if;
  update public.nutrition_requests set status = 'cancelled' where id = p_request_id;
end;
$$;

-- Dietitian starts a draft plan for a member (optionally answering a request),
-- with four standard meals to fill in. Returns the plan id.
create function public.start_nutrition_plan(p_member_id uuid, p_request_id uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_req    public.nutrition_requests;
  v_name   text;
  v_id     uuid;
begin
  select gym_id into v_gym_id from public.members where id = p_member_id;
  if v_gym_id is null or not public.can_diet(v_gym_id) then
    raise exception 'Only dietitians, managers and owners can build nutrition plans' using errcode = '42501';
  end if;

  if p_request_id is not null then
    select * into v_req from public.nutrition_requests where id = p_request_id for update;
    if v_req.id is null or v_req.member_id <> p_member_id then
      raise exception 'Request not found' using errcode = '22023';
    end if;
    if v_req.status = 'in_progress' and v_req.plan_id is not null then
      return v_req.plan_id;  -- already being built: reopen it
    end if;
    if v_req.status <> 'open' then
      raise exception 'This request is already closed' using errcode = '22023';
    end if;
  end if;

  v_name := case v_req.goal
    when 'lose_fat'     then 'Fat loss plan'
    when 'build_muscle' then 'Muscle gain plan'
    when 'maintain'     then 'Maintenance plan'
    when 'performance'  then 'Performance plan'
    else 'Healthy eating plan' end;

  insert into public.nutrition_plans (gym_id, member_id, dietitian_id, request_id, name)
  values (v_gym_id, p_member_id, auth.uid(), p_request_id, v_name)
  returning id into v_id;

  insert into public.nutrition_meals (plan_id, position, name, time_label) values
    (v_id, 0, 'Breakfast', '08:00'),
    (v_id, 1, 'Lunch', '13:00'),
    (v_id, 2, 'Snack', '16:30'),
    (v_id, 3, 'Dinner', '20:00');

  if p_request_id is not null then
    update public.nutrition_requests set status = 'in_progress', dietitian_id = auth.uid(), plan_id = v_id
     where id = p_request_id;
  end if;
  return v_id;
end;
$$;

-- Sends a draft to the member: it becomes their active plan (the previous one
-- is archived) and its request is done.
create function public.send_nutrition_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.nutrition_plans;
begin
  select * into v_plan from public.nutrition_plans where id = p_plan_id for update;
  if v_plan.id is null or not public.can_diet(v_plan.gym_id) then
    raise exception 'Plan not found' using errcode = '42501';
  end if;
  if v_plan.status = 'archived' then
    raise exception 'This plan is archived' using errcode = '22023';
  end if;
  if not exists (select 1 from public.nutrition_meals where plan_id = p_plan_id and trim(items) <> '') then
    raise exception 'Add at least one meal before sending' using errcode = '22023';
  end if;
  update public.nutrition_plans set status = 'archived'
   where member_id = v_plan.member_id and status = 'active' and id <> p_plan_id;
  update public.nutrition_plans set status = 'active', sent_at = coalesce(sent_at, now()) where id = p_plan_id;
  update public.nutrition_requests set status = 'done' where id = v_plan.request_id;
  perform public.log_activity(v_plan.gym_id, 'nutrition_plan.sent', 'Sent nutrition plan "' || v_plan.name || '"',
    jsonb_build_object('member_id', v_plan.member_id, 'plan_id', p_plan_id));
end;
$$;

-- Archives an active plan (the member no longer sees it as current).
create function public.archive_nutrition_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym uuid := public.nutrition_plan_gym(p_plan_id);
begin
  if v_gym is null or not public.can_diet(v_gym) then
    raise exception 'Plan not found' using errcode = '42501';
  end if;
  update public.nutrition_plans set status = 'archived' where id = p_plan_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.can_diet(uuid)',
    'public.gym_staff_names(uuid)',
    'public.nutrition_plan_gym(uuid)',
    'public.can_view_nutrition_plan(uuid)',
    'public.request_nutrition_plan(uuid, text, numeric, numeric, text, text, text, text)',
    'public.cancel_nutrition_request(uuid)',
    'public.start_nutrition_plan(uuid, uuid)',
    'public.send_nutrition_plan(uuid)',
    'public.archive_nutrition_plan(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
