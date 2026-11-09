-- Hands-on demo: each visitor gets a private sample gym in the real app,
-- signed in as its owner (and able to switch to a sample member), deleted
-- after 24 hours. Sample gyms never send WhatsApp messages and are left out of
-- the super admin's gym list.

alter table public.gyms add column demo_expires_at timestamptz;
create index gyms_demo_idx on public.gyms (demo_expires_at) where demo_expires_at is not null;

-- The two sign-ins of each sample gym, so they can be deleted with it.
create table public.demo_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gym_id  uuid not null references public.gyms (id) on delete cascade,
  role    text not null check (role in ('owner', 'member'))
);
alter table public.demo_users enable row level security;
revoke all on public.demo_users from anon, authenticated;

-- One row per demo started (hashed address), to limit how many one visitor
-- can start. Kept a day.
create table public.demo_starts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index demo_starts_idx on public.demo_starts (ip_hash, created_at desc);
alter table public.demo_starts enable row level security;
revoke all on public.demo_starts from anon, authenticated;

-- Builds the sample gym for two fresh users (created by the app). Runs the
-- app's own functions as the owner, so the data follows the same rules as
-- real use, then dates the history back. Server only.
create function public.create_demo_gym(p_owner uuid, p_member_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev_sub text := current_setting('request.jwt.claim.sub', true);
  v_gym      uuid;
  v_tz       text;
  v_today    date;
  v_plans    jsonb := '{}';
  v_plan     uuid;
  v_member   uuid;
  v_invoice  uuid;
  v_ms       uuid;
  v_you      uuid;
  v_conv     uuid;
  v_prog     uuid;
  v_day      uuid;
  v_session  uuid;
  v_class    uuid;
  v_i        integer;
  v_start    date;
  v_ex       text;
  v_names    text[] := array[
    'Rami Haddad', 'Lea Khoury', 'Joe Nassar', 'Maya Saad', 'Karl Bou Khalil', 'Nadine Azar',
    'Elie Fares', 'Rita Moussa', 'Charbel Daher', 'Sara Hamdan', 'Omar Itani', 'Yara Chahine',
    'Hadi Sleiman', 'Christelle Abi Nader', 'Marc Rizk', 'Jana Kassab', 'Tarek Mansour', 'Zeina Hayek',
    'Fadi Germanos', 'Lynn Tannous', 'Ali Zein', 'Mira Gemayel', 'Georges Saliba', 'Dana Ghandour'];
  v_methods  public.payment_method[] := array['cash_usd', 'whish', 'cash_usd', 'omt', 'card', 'cash_usd', 'bank_transfer']::public.payment_method[];
  v_ids      uuid[] := '{}';
begin
  -- Act as the owner for the app's functions (restored at the end).
  perform set_config('request.jwt.claim.sub', p_owner::text, true);

  v_gym := public.create_gym('Atlas Fitness');
  update public.gyms
     set demo_expires_at = now() + interval '24 hours', capacity = 60, renewal_reminder_days = 3,
         equipment = array['body only', 'dumbbell', 'barbell', 'cable', 'kettlebells', 'e-z curl bar', 'bands', 'medicine ball', 'foam roll'],
         trial_ends_at = (now() + interval '14 days')::date
   where id = v_gym
  returning timezone into v_tz;
  v_today := public.gym_today(v_gym);
  insert into public.demo_users (user_id, gym_id, role) values (p_owner, v_gym, 'owner'), (p_member_user, v_gym, 'member');

  -- Plans.
  insert into public.membership_plans (gym_id, name, description, price_usd, period, period_count, visit_limit) values
    (v_gym, 'Monthly', 'Unlimited gym access', 45, 'month', 1, null),
    (v_gym, '3 Months', 'Save $15', 120, 'month', 3, null),
    (v_gym, 'Yearly', 'Best value', 420, 'year', 1, null),
    (v_gym, '10 Visits', 'Valid two months', 60, 'month', 2, 10),
    (v_gym, 'Student Monthly', 'With a student card', 35, 'month', 1, null);
  select jsonb_object_agg(name, id) into v_plans from public.membership_plans where gym_id = v_gym;

  -- Members and their memberships: paid, ending soon, expired, owing, paused…
  for v_i in 1 .. array_length(v_names, 1) loop
    insert into public.members (gym_id, full_name, phone, created_by, created_at)
    values (v_gym, v_names[v_i], '+961 70 ' || lpad((100000 + v_i * 7919 % 900000)::text, 6, '0'), p_owner, now() - make_interval(days => 40 + v_i))
    returning id into v_member;
    v_ids := v_ids || v_member;

    v_plan := (v_plans ->> case
      when v_i = 21 then 'Yearly' when v_i = 22 then '10 Visits' when v_i = 23 then '3 Months'
      when v_i in (6, 12) then 'Student Monthly' else 'Monthly' end)::uuid;
    v_start := case
      when v_i <= 14 then v_today - (v_i * 2)            -- active, paid
      when v_i in (15, 16) then v_today - 28 + 1         -- ends in 2 days
      when v_i = 17 then v_today - 40                    -- expired 10 days ago
      when v_i = 18 then v_today - 55                    -- expired 25 days ago
      when v_i = 19 then v_today - 1                     -- owes part of it
      when v_i = 20 then v_today - 10                    -- paused
      when v_i = 21 then v_today - 120
      when v_i = 22 then v_today - 12
      when v_i = 23 then v_today - 30
      else null end;                                     -- 24: new, no membership yet
    continue when v_start is null;

    v_invoice := public.sell_membership(
      v_member, v_plan, v_start, 0,
      case when v_i = 19 then 20 else (select price_usd from public.membership_plans where id = v_plan) end,
      v_methods[1 + v_i % array_length(v_methods, 1)], null);
    update public.invoices set issued_on = v_start where id = v_invoice;
    update public.payments set paid_at = (v_start + time '10:30') at time zone v_tz where invoice_id = v_invoice;
    if v_i = 20 then
      update public.memberships set frozen_on = v_today - 3 where member_id = v_member;
    end if;
  end loop;

  -- The sample member the visitor can switch to.
  insert into public.members (gym_id, user_id, full_name, phone, email, created_by, created_at)
  values (v_gym, p_member_user, 'Karim Aoun', '+961 71 000 001', null, p_owner, now() - interval '90 days')
  returning id into v_you;
  insert into public.gym_users (gym_id, user_id, role) values (v_gym, p_member_user, 'member');
  v_invoice := public.sell_membership(v_you, (v_plans ->> 'Monthly')::uuid, v_today - 9, 0, 45, 'whish', null);
  update public.invoices set issued_on = v_today - 9 where id = v_invoice;
  update public.payments set paid_at = ((v_today - 9) + time '18:05') at time zone v_tz where invoice_id = v_invoice;
  v_ids := v_ids || v_you;

  -- Three weeks of check-ins, busier in the evening, plus people in right now.
  insert into public.checkins (gym_id, member_id, membership_id, allowed, source, checked_in_by, checked_in_at)
  select v_gym, ms.member_id, ms.id, true, (array['tap', 'desk', 'tap'])[1 + (random() * 2)::int], p_owner,
         ((v_today - d) + make_time((array[6, 7, 8, 12, 17, 18, 19, 20, 21])[1 + (random() * 8)::int], (random() * 59)::int, 0)) at time zone v_tz
    from public.memberships ms
    cross join generate_series(1, 21) d
   where ms.gym_id = v_gym and ms.cancelled_at is null and ms.frozen_on is null
     and (v_today - d) between ms.starts_on and ms.ends_on
     and random() < 0.5;
  insert into public.checkins (gym_id, member_id, membership_id, allowed, source, checked_in_by, checked_in_at)
  select v_gym, ms.member_id, ms.id, true, 'tap', p_owner, now() - make_interval(mins => (random() * 70)::int)
    from public.memberships ms
   where ms.gym_id = v_gym and ms.cancelled_at is null and ms.frozen_on is null and v_today between ms.starts_on and ms.ends_on
   order by random() limit 9;
  -- A refused entry: the expired member tried this morning.
  insert into public.checkins (gym_id, member_id, allowed, reason, source, checked_in_by, checked_in_at)
  values (v_gym, v_ids[17], false, 'Membership expired', 'tap', p_owner, now() - interval '2 hours');

  -- Weekly classes, with bookings for the coming week.
  insert into public.classes (gym_id, name, description, weekday, start_time, duration_min, capacity, location) values
    (v_gym, 'Spinning', 'High-energy indoor cycling.', 1, '18:00', 45, 16, 'Studio A'),
    (v_gym, 'HIIT', 'Short, intense intervals.', 2, '19:00', 40, 20, 'Main floor'),
    (v_gym, 'Yoga', 'Mobility and breathing.', 3, '08:00', 60, 14, 'Studio B'),
    (v_gym, 'Boxing', 'Pads, bags and footwork.', 4, '19:30', 60, 12, 'Ring'),
    (v_gym, 'Pilates', 'Core and posture.', 6, '10:00', 50, 12, 'Studio B'),
    (v_gym, 'CrossFit WOD', 'Workout of the day.', 0, '11:00', 60, 18, 'Main floor');
  for v_class in select id from public.classes where gym_id = v_gym loop
    for v_i in 1 .. 4 + (random() * 6)::int loop
      begin
        perform public.book_class(
          v_class,
          v_today + (((select weekday from public.classes where id = v_class) - extract(dow from v_today)::int + 7) % 7),
          v_ids[1 + (random() * 13)::int]);
      exception when others then null; -- a member already booked: skip
      end;
    end loop;
  end loop;

  -- Equipment.
  insert into public.gym_machines (gym_id, name, description, created_by) values
    (v_gym, 'Leg press', 'Plate-loaded, 45 degrees. Keep your lower back on the pad.', p_owner),
    (v_gym, 'Cable crossover', 'Two adjustable pulleys for chest, back and arms.', p_owner),
    (v_gym, 'Smith machine', 'Guided bar for squats and presses. Lock it with a twist.', p_owner),
    (v_gym, 'Rowing machine', 'Push with the legs first, then pull with the arms.', p_owner);

  -- A trainer program for the sample member, with workouts logged.
  insert into public.programs (gym_id, member_id, name, notes, kind, is_active, created_by)
  values (v_gym, null, 'Beginner full body', 'A template to copy for new members.', 'template', true, p_owner)
  returning id into v_prog;
  insert into public.program_days (program_id, position, name) values (v_prog, 1, 'Full body') returning id into v_day;
  insert into public.program_exercises (day_id, position, exercise_id, sets, reps, rest_seconds)
  select v_day, x.n, e.id, 3, 12, 60
    from unnest(array['Leg Press', 'Dumbbell Shoulder Press', 'Bent Over Barbell Row', 'Plank']) with ordinality as x(name, n)
    join public.exercises e on e.name = x.name;
  insert into public.programs (gym_id, member_id, name, notes, kind, is_active, created_by)
  values (v_gym, v_you, 'Strength foundations', 'Three days a week. Add 2.5 kg when every set feels easy.', 'trainer', true, p_owner)
  returning id into v_prog;
  for v_i in 1 .. 3 loop
    insert into public.program_days (program_id, position, name)
    values (v_prog, v_i, (array['Day A: Push', 'Day B: Pull', 'Day C: Legs'])[v_i])
    returning id into v_day;
    insert into public.program_exercises (day_id, position, exercise_id, sets, reps, target_weight_kg, rest_seconds)
    select v_day, x.n, e.id, 3, case when x.name = 'Plank' then 1 else 10 end,
           case x.name when 'Barbell Bench Press - Medium Grip' then 60 when 'Dumbbell Shoulder Press' then 18
             when 'Bent Over Barbell Row' then 40 when 'Dumbbell Bicep Curl' then 12 when 'Barbell Squat' then 70
             when 'Leg Press' then 120 end,
           90
      from unnest(case v_i
        when 1 then array['Barbell Bench Press - Medium Grip', 'Dumbbell Shoulder Press', 'Plank']
        when 2 then array['Pullups', 'Bent Over Barbell Row', 'Dumbbell Bicep Curl']
        else array['Barbell Squat', 'Leg Press', 'Plank'] end) with ordinality as x(name, n)
      join public.exercises e on e.name = x.name;
    insert into public.member_training_days (member_id, weekday, program_day_id) values (v_you, (array[1, 3, 5])[v_i], v_day);
  end loop;
  -- Six past workouts on the first day, getting stronger: personal records.
  select id into v_day from public.program_days where program_id = v_prog order by position limit 1;
  select e.id into v_ex from public.exercises e where e.name = 'Barbell Bench Press - Medium Grip';
  if v_ex is not null then
    for v_i in 1 .. 6 loop
      insert into public.workout_sessions (gym_id, member_id, program_id, day_id, day_name, started_at, finished_at)
      values (v_gym, v_you, v_prog, v_day, 'Day A: Push',
              ((v_today - (7 * (7 - v_i))) + time '18:10') at time zone v_tz,
              ((v_today - (7 * (7 - v_i))) + time '19:05') at time zone v_tz)
      returning id into v_session;
      insert into public.workout_exercises (session_id, member_id, exercise_id, position) values (v_session, v_you, v_ex, 1);
      insert into public.set_logs (session_id, member_id, exercise_id, set_number, weight_kg, reps, logged_at)
      select v_session, v_you, v_ex, s, 50 + v_i * 2.5, 10 - (s - 1), ((v_today - (7 * (7 - v_i))) + time '18:20') at time zone v_tz
        from generate_series(1, 3) s;
    end loop;
  end if;

  -- Body measurements over three months.
  insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, source, recorded_by)
  select v_gym, v_you, v_today - (30 * (3 - n)), 86 - n * 1.6, 24 - n * 1.3, 34 + n * 0.5, 94 - n * 1.5, 'inbody', p_owner
    from generate_series(0, 3) n;

  -- Shop: products, and a week of sales.
  insert into public.products (gym_id, name, category, barcode, price_usd, cost_usd, track_stock, stock, low_stock_at) values
    (v_gym, 'Whey protein 2 lb', 'Supplements', '6291100000011', 55, 38, true, 9, 3),
    (v_gym, 'Creatine 300 g', 'Supplements', '6291100000028', 30, 18, true, 2, 3),
    (v_gym, 'Protein bar', 'Snacks', '6291100000035', 3, 1.6, true, 46, 10),
    (v_gym, 'Water 500 ml', 'Drinks', '6291100000042', 1, 0.3, true, 120, 24),
    (v_gym, 'Energy drink', 'Drinks', '6291100000059', 2.5, 1.2, true, 34, 12),
    (v_gym, 'Atlas T-shirt', 'Merch', '6291100000066', 18, 7, true, 15, 5),
    (v_gym, 'Shaker bottle', 'Merch', '6291100000073', 8, 3, true, 11, 4),
    (v_gym, 'Day pass', 'Services', null, 10, 0, false, 0, 0);
  for v_i in 1 .. 26 loop
    perform public.pos_checkout(
      v_gym,
      jsonb_build_array(jsonb_build_object(
        'product_id', (select id from public.products where gym_id = v_gym and name = (array['Water 500 ml', 'Protein bar', 'Energy drink', 'Whey protein 2 lb', 'Water 500 ml', 'Day pass', 'Protein bar'])[1 + v_i % 7]),
        'quantity', 1 + v_i % 3)),
      case when v_i % 5 = 0 then 'account' when v_i % 3 = 0 then 'card' else 'cash_usd' end,
      case when v_i % 5 = 0 then v_ids[1 + v_i % 14] else null end,
      0, null);
  end loop;
  update public.sales s
     set created_at = s.created_at - make_interval(days => (s.number % 7), hours => (s.number % 9))
   where s.gym_id = v_gym;

  -- A chat between the owner and the sample member.
  insert into public.conversations (gym_id, member_id, staff_id, last_message_at)
  values (v_gym, v_you, p_owner, now() - interval '20 minutes')
  returning id into v_conv;
  insert into public.messages (conversation_id, sender_id, body, created_at, read_at) values
    (v_conv, p_member_user, 'Hi! Can I switch my Thursday session to Friday this week?', now() - interval '3 hours', now() - interval '2 hours'),
    (v_conv, p_owner, 'Of course, Friday at 6 works. See you then!', now() - interval '2 hours', now() - interval '1 hour'),
    (v_conv, p_member_user, 'Perfect, thanks. Also, is the whey back in stock?', now() - interval '20 minutes', null);

  -- The TV in the lobby.
  insert into public.screens (gym_id, name) values (v_gym, 'Lobby TV');
  insert into public.screen_slides (gym_id, kind, title, body, theme, position) values
    (v_gym, 'announcement', 'New: Boxing on Thursdays', 'Thursdays at 7:30 pm in the ring. Book in the Atlas app.', 'lime', 1),
    (v_gym, 'schedule', null, null, 'dark', 2),
    (v_gym, 'leaderboard', null, null, 'dark', 3),
    (v_gym, 'promo', 'Bring a friend', 'Their first week is free when you train together.', 'light', 4);

  -- Staff invites waiting to be accepted.
  insert into public.invites (gym_id, email, role, invited_by) values
    (v_gym, 'coach.sami@example.com', 'trainer', p_owner),
    (v_gym, 'desk.lara@example.com', 'front_desk', p_owner);

  perform set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
  return v_gym;
end;
$$;
revoke all on function public.create_demo_gym(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_demo_gym(uuid, uuid) to service_role;

-- Sample gyms past their 24 hours, with their sign-ins (the app deletes the
-- users, which removes the gym data through the gym's deletion). Server only.
create function public.expired_demo_gyms(p_limit integer default 50)
returns table (gym_id uuid, user_ids uuid[])
language sql stable security definer set search_path = ''
as $$
  select g.id, coalesce(array_agg(d.user_id) filter (where d.user_id is not null), '{}')
    from public.gyms g
    left join public.demo_users d on d.gym_id = g.id
   where g.demo_expires_at < now()
   group by g.id
   order by min(g.demo_expires_at)
   limit p_limit;
$$;
revoke all on function public.expired_demo_gyms(integer) from public, anon, authenticated;
grant execute on function public.expired_demo_gyms(integer) to service_role;

-- The super admin's gym list leaves sample gyms out.
create or replace function public.admin_gym_overview()
returns table (
  gym_id           uuid,
  name             text,
  created_at       timestamptz,
  owner_name       text,
  owner_email      text,
  owner_phone      text,
  staff            integer,
  members          integer,
  active_members   integer,
  checkins_30d     integer,
  collected_30d    numeric,
  last_checkin_at  timestamptz,
  trial_ends_at    date,
  paid_until       date,
  suspended_at     timestamptz,
  suspended_reason text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    g.id,
    g.name,
    g.created_at,
    op.full_name,
    op.email,
    op.phone,
    (select count(*)::integer from public.gym_users gu where gu.gym_id = g.id and gu.role <> 'member'),
    (select count(*)::integer from public.members m where m.gym_id = g.id),
    (select count(distinct ms.member_id)::integer from public.memberships ms
      where ms.gym_id = g.id and ms.cancelled_at is null
        and public.membership_rank(ms, public.gym_today(g.id)) = 2),
    (select count(*)::integer from public.checkins c
      where c.gym_id = g.id and c.allowed and c.checked_in_at > now() - interval '30 days'),
    (select coalesce(sum(p.amount_usd), 0) from public.payments p
      where p.gym_id = g.id and p.paid_at > now() - interval '30 days'),
    (select max(c.checked_in_at) from public.checkins c where c.gym_id = g.id),
    g.trial_ends_at,
    g.paid_until,
    g.suspended_at,
    g.suspended_reason
  from public.gyms g
  left join lateral (
    select pr.full_name, pr.email, pr.phone from public.gym_users gu
    join public.profiles pr on pr.id = gu.user_id
    where gu.gym_id = g.id and gu.role = 'owner'
    limit 1
  ) op on true
  where g.demo_expires_at is null
  order by g.created_at desc;
end;
$$;
