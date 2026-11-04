-- In-app notifications (bell + counters), day-before reminders, and monthly
-- course subscriptions (e.g. Pilates: pay once a month, booked into every session).

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  title       text not null check (char_length(title) <= 120),
  body        text check (char_length(body) <= 300),
  link        text check (char_length(link) <= 300),
  -- Reminders are made lazily; the key stops the same one being made twice.
  dedupe_key  text unique,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_select on public.notifications for select using (user_id = auth.uid());

-- Internal: adds one notification (skipped for no recipient or a duplicate key).
create function public.notify(
  p_gym_id uuid, p_user_id uuid, p_kind text, p_title text, p_body text, p_link text, p_key text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (gym_id, user_id, kind, title, body, link, dedupe_key)
  values (p_gym_id, p_user_id, p_kind, left(p_title, 120), left(p_body, 300), p_link, p_key)
  on conflict (dedupe_key) do nothing;
end;
$$;

-- Internal: notifies everyone in the gym with one of these roles, except whoever caused it.
create function public.notify_roles(
  p_gym_id uuid, p_roles public.gym_role[], p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (gym_id, user_id, kind, title, body, link)
  select p_gym_id, gu.user_id, p_kind, left(p_title, 120), left(p_body, 300), p_link
    from public.gym_users gu
   where gu.gym_id = p_gym_id and gu.role = any (p_roles) and gu.user_id is distinct from auth.uid()
$$;

create function public.member_user(p_member_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select user_id from public.members where id = p_member_id
$$;

create function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql security definer set search_path = ''
as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
$$;

-- ---------------------------------------------------------------------------
-- Event triggers
-- ---------------------------------------------------------------------------

-- New chat message -> the other person (one unread notice per conversation).
create function public.notify_message()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_conv   public.conversations;
  v_to     uuid;
  v_from   text;
  v_link   text;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  if new.sender_id = v_conv.staff_id then
    v_to := public.member_user(v_conv.member_id);
    v_link := '/portal/messages?c=' || v_conv.id;
    select full_name into v_from from public.profiles where id = new.sender_id;
  else
    v_to := v_conv.staff_id;
    v_link := '/dashboard/messages?c=' || v_conv.id;
    select full_name into v_from from public.members where id = v_conv.member_id;
  end if;
  delete from public.notifications where user_id = v_to and kind = 'message' and link = v_link and read_at is null;
  perform public.notify(v_conv.gym_id, v_to, 'message', 'New message from ' || coalesce(nullif(v_from, ''), 'your gym'), left(new.body, 140), v_link);
  return new;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message();

-- Program request -> the trainer they asked for, or every coach.
create function public.notify_program_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  select full_name into v_name from public.members where id = new.member_id;
  if new.preferred_trainer_id is not null then
    perform public.notify(new.gym_id, new.preferred_trainer_id, 'program_request', v_name || ' asked you for a program', null, '/dashboard/programs?tab=requests');
  else
    perform public.notify_roles(new.gym_id, array['owner', 'manager', 'trainer']::public.gym_role[], 'program_request',
      v_name || ' asked for a program', null, '/dashboard/programs?tab=requests');
  end if;
  return new;
end;
$$;
create trigger program_requests_notify after insert on public.program_requests
  for each row execute function public.notify_program_request();

-- Nutrition request -> dietitians, managers, owner.
create function public.notify_nutrition_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify_roles(new.gym_id, array['owner', 'manager', 'dietitian']::public.gym_role[], 'nutrition_request',
    (select full_name from public.members where id = new.member_id) || ' asked for a nutrition plan', null, '/dashboard/nutrition?tab=requests');
  return new;
end;
$$;
create trigger nutrition_requests_notify after insert on public.nutrition_requests
  for each row execute function public.notify_nutrition_request();

-- Trainer program sent -> the member.
create function public.notify_program_sent()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'trainer' and new.is_active and not old.is_active and new.member_id is not null then
    perform public.notify(new.gym_id, public.member_user(new.member_id), 'program', 'Your new program is ready',
      new.name, '/portal/programs?program=' || new.id);
  end if;
  return new;
end;
$$;
create trigger programs_notify after update on public.programs
  for each row execute function public.notify_program_sent();

-- Nutrition plan sent -> the member.
create function public.notify_nutrition_sent()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active' and old.status = 'draft' then
    perform public.notify(new.gym_id, public.member_user(new.member_id), 'nutrition', 'Your nutrition plan is ready', new.name, '/portal/nutrition');
  end if;
  return new;
end;
$$;
create trigger nutrition_plans_notify after update on public.nutrition_plans
  for each row execute function public.notify_nutrition_sent();

-- PT: request -> trainer; confirmed / declined / cancelled by staff -> member.
create function public.notify_pt()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_when text;
begin
  v_when := to_char(new.starts_at at time zone (select timezone from public.gyms where id = new.gym_id), 'Dy DD Mon, HH24:MI');
  if tg_op = 'INSERT' and new.status = 'requested' then
    select full_name into v_name from public.members where id = new.member_id;
    perform public.notify(new.gym_id, new.trainer_id, 'pt', 'PT request from ' || v_name, v_when, '/dashboard/schedule?tab=pt');
  elsif tg_op = 'INSERT' and new.status = 'confirmed' then
    perform public.notify(new.gym_id, public.member_user(new.member_id), 'pt', 'PT session booked', v_when, '/portal/schedule?tab=pt');
  elsif tg_op = 'UPDATE' and new.status <> old.status and new.status in ('confirmed', 'declined', 'cancelled')
        and not public.is_my_member(new.member_id) then
    perform public.notify(new.gym_id, public.member_user(new.member_id), 'pt',
      'PT session ' || new.status, v_when, '/portal/schedule?tab=pt');
  end if;
  return new;
end;
$$;
create trigger pt_sessions_notify after insert or update on public.pt_sessions
  for each row execute function public.notify_pt();

-- Off the waitlist -> the member.
create function public.notify_booking()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'waitlist' and new.status = 'booked' then
    perform public.notify(new.gym_id, public.member_user(new.member_id), 'class', 'You got a spot',
      (select name from public.classes where id = new.class_id) || ', ' || to_char(new.session_date, 'Dy DD Mon'), '/portal/schedule');
  end if;
  return new;
end;
$$;
create trigger class_bookings_notify after update on public.class_bookings
  for each row execute function public.notify_booking();

-- ---------------------------------------------------------------------------
-- Monthly courses
-- ---------------------------------------------------------------------------

-- A class with a monthly price is a course: members subscribe for a month
-- instead of booking single sessions.
alter table public.classes add column monthly_price_usd numeric(10, 2) check (monthly_price_usd >= 0);
grant select (monthly_price_usd), insert (monthly_price_usd), update (monthly_price_usd) on public.classes to authenticated;

create table public.class_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  class_id    uuid not null references public.classes (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  price_usd   numeric(10, 2) not null default 0,
  invoice_id  uuid references public.invoices (id) on delete set null,
  status      text not null default 'active' check (status in ('active', 'cancelled')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index class_subscriptions_member_idx on public.class_subscriptions (member_id, ends_on);
create index class_subscriptions_class_idx on public.class_subscriptions (class_id, starts_on, ends_on);

alter table public.class_subscriptions enable row level security;
revoke all on public.class_subscriptions from anon, authenticated;
grant select on public.class_subscriptions to authenticated;
create policy class_subscriptions_select on public.class_subscriptions for select
  using (public.is_gym_staff(gym_id) or public.is_my_member(member_id));

-- Subscribes a member (themselves, or by staff) for one month from p_starts_on:
-- an invoice for the month, and a booking in every session of that month.
create function public.subscribe_to_course(p_class_id uuid, p_member_id uuid default null, p_starts_on date default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_class   public.classes;
  v_member  uuid;
  v_start   date;
  v_end     date;
  v_taken   integer;
  v_number  integer;
  v_invoice uuid;
  v_id      uuid;
  v_day     date;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if v_class.id is null or not v_class.is_active or v_class.monthly_price_usd is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if p_member_id is null then
    v_member := public.my_member_id(v_class.gym_id);
    if v_member is null then
      raise exception 'Only members of this gym can subscribe' using errcode = '42501';
    end if;
  else
    if not public.can_handle_billing(v_class.gym_id) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    select id into v_member from public.members where id = p_member_id and gym_id = v_class.gym_id;
    if v_member is null then
      raise exception 'Member not found' using errcode = 'P0002';
    end if;
  end if;

  v_start := coalesce(p_starts_on, public.gym_today(v_class.gym_id));
  if v_start < public.gym_today(v_class.gym_id) then
    raise exception 'The month can''t start in the past' using errcode = '22023';
  end if;
  v_end := (v_start + interval '1 month')::date - 1;

  if exists (select 1 from public.class_subscriptions where class_id = p_class_id and member_id = v_member
              and status = 'active' and starts_on <= v_end and ends_on >= v_start) then
    raise exception 'Already subscribed for these dates' using errcode = '22023';
  end if;
  select count(*) into v_taken from public.class_subscriptions
   where class_id = p_class_id and status = 'active' and starts_on <= v_end and ends_on >= v_start;
  if v_taken >= v_class.capacity then
    raise exception 'This course is full' using errcode = '22023';
  end if;

  if v_class.monthly_price_usd > 0 then
    update public.gyms set next_invoice_number = next_invoice_number + 1
     where id = v_class.gym_id returning next_invoice_number - 1 into v_number;
    insert into public.invoices (gym_id, member_id, number, description, amount_usd, issued_on, created_by)
    values (v_class.gym_id, v_member, v_number,
            v_class.name || ' course, ' || to_char(v_start, 'DD Mon') || ' – ' || to_char(v_end, 'DD Mon YYYY'),
            v_class.monthly_price_usd, public.gym_today(v_class.gym_id), auth.uid())
    returning id into v_invoice;
  end if;

  insert into public.class_subscriptions (gym_id, class_id, member_id, starts_on, ends_on, price_usd, invoice_id, created_by)
  values (v_class.gym_id, p_class_id, v_member, v_start, v_end, v_class.monthly_price_usd, v_invoice, auth.uid())
  returning id into v_id;

  -- Booked into every session of the month.
  for v_day in select d::date from generate_series(v_start, v_end, interval '1 day') d
                where extract(dow from d)::integer = v_class.weekday loop
    insert into public.class_bookings (gym_id, class_id, session_date, member_id, status)
    values (v_class.gym_id, p_class_id, v_day, v_member, 'booked')
    on conflict (class_id, session_date, member_id) do update set status = 'booked';
  end loop;

  perform public.notify(v_class.gym_id, public.member_user(v_member), 'course',
    'Subscribed to ' || v_class.name,
    to_char(v_start, 'DD Mon') || ' – ' || to_char(v_end, 'DD Mon') ||
      case when v_class.monthly_price_usd > 0 then ', $' || v_class.monthly_price_usd || ' to pay' else '' end,
    '/portal/schedule');
  return v_id;
end;
$$;

-- Staff stop a subscription: its future sessions are released.
create function public.cancel_course_subscription(p_subscription_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_s public.class_subscriptions;
begin
  select * into v_s from public.class_subscriptions where id = p_subscription_id for update;
  if v_s.id is null or not public.can_handle_billing(v_s.gym_id) then
    raise exception 'Subscription not found' using errcode = '42501';
  end if;
  update public.class_subscriptions set status = 'cancelled' where id = v_s.id;
  update public.class_bookings set status = 'cancelled'
   where class_id = v_s.class_id and member_id = v_s.member_id and status = 'booked'
     and session_date between greatest(v_s.starts_on, public.gym_today(v_s.gym_id)) and v_s.ends_on;
end;
$$;

-- Single sessions of a course can't be booked; members subscribe instead.
create function public.block_course_single_booking()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select monthly_price_usd from public.classes where id = new.class_id) is not null
     and not exists (select 1 from public.class_subscriptions s
                      where s.class_id = new.class_id and s.member_id = new.member_id and s.status = 'active'
                        and new.session_date between s.starts_on and s.ends_on) then
    raise exception 'This is a monthly course: subscribe to join it' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger class_bookings_course_only before insert on public.class_bookings
  for each row execute function public.block_course_single_booking();

-- ---------------------------------------------------------------------------
-- Reminders (made when the member opens the app; no scheduler needed)
-- ---------------------------------------------------------------------------

create function public.make_my_reminders(p_gym_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_member   uuid := public.my_member_id(p_gym_id);
  v_user     uuid := auth.uid();
  v_tomorrow date := public.gym_today(p_gym_id) + 1;
  r          record;
begin
  if v_member is null then
    return;
  end if;

  -- Classes tomorrow.
  for r in select b.id, c.name, c.start_time from public.class_bookings b join public.classes c on c.id = b.class_id
            where b.member_id = v_member and b.session_date = v_tomorrow and b.status = 'booked' loop
    perform public.notify(p_gym_id, v_user, 'reminder', r.name || ' tomorrow at ' || to_char(r.start_time, 'HH24:MI'),
      'See you there.', '/portal/schedule', 'class:' || r.id);
  end loop;

  -- Course not paid yet and a session tomorrow, or the month ending tomorrow.
  for r in select s.id, s.class_id, s.starts_on, s.ends_on, s.price_usd, c.name, coalesce(i.balance_usd, 0) as balance
             from public.class_subscriptions s
             join public.classes c on c.id = s.class_id
             left join public.invoice_summary i on i.id = s.invoice_id
            where s.member_id = v_member and s.status = 'active' loop
    if r.balance > 0 and v_tomorrow between r.starts_on and r.ends_on and exists (
         select 1 from public.class_bookings b
          where b.class_id = r.class_id and b.member_id = v_member and b.session_date = v_tomorrow and b.status = 'booked') then
      perform public.notify(p_gym_id, v_user, 'reminder', r.name || ' tomorrow: payment due',
        '$' || r.balance || ' to pay at the front desk.', '/portal/schedule', 'course-pay:' || r.id || ':' || v_tomorrow);
    end if;
    if r.ends_on = v_tomorrow then
      perform public.notify(p_gym_id, v_user, 'reminder', 'Your ' || r.name || ' month ends tomorrow',
        'Renew at the front desk to keep your spot ($' || r.price_usd || ').', '/portal/schedule', 'course-end:' || r.id);
    end if;
  end loop;

  -- Membership ending in 3 days or tomorrow.
  for r in select ms.id, ms.ends_on from public.memberships ms
            where ms.member_id = v_member and ms.cancelled_at is null and ms.frozen_on is null
              and ms.ends_on in (v_tomorrow, v_tomorrow + 2) loop
    perform public.notify(p_gym_id, v_user, 'reminder',
      case when r.ends_on = v_tomorrow then 'Your membership ends tomorrow' else 'Your membership ends in 3 days' end,
      'Renew at the front desk to keep training.', '/portal', 'membership:' || r.id || ':' || r.ends_on);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Counters for the staff menu
-- ---------------------------------------------------------------------------

create function public.staff_counts(p_gym_id uuid)
returns table (program_requests integer, nutrition_requests integer, pt_requests integer)
language sql stable security definer set search_path = ''
as $$
  select
    case when public.can_coach(p_gym_id) then
      (select count(*)::integer from public.program_requests where gym_id = p_gym_id and status = 'open') else 0 end,
    case when public.can_diet(p_gym_id) then
      (select count(*)::integer from public.nutrition_requests where gym_id = p_gym_id and status = 'open') else 0 end,
    (select count(*)::integer from public.pt_sessions
      where gym_id = p_gym_id and status = 'requested' and starts_at > now()
        and (trainer_id = auth.uid() or public.has_gym_role(p_gym_id, array['owner', 'manager']::public.gym_role[])))
   where public.is_gym_staff(p_gym_id)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.notify(uuid, uuid, text, text, text, text, text)',
    'public.notify_roles(uuid, public.gym_role[], text, text, text, text)',
    'public.member_user(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.mark_notifications_read(uuid[])',
    'public.subscribe_to_course(uuid, uuid, date)',
    'public.cancel_course_subscription(uuid)',
    'public.make_my_reminders(uuid)',
    'public.staff_counts(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
