-- Gymix's own subscription: each gym pays $10 a month after a 14-day free trial.
-- Payments are made by Whish / OMT / bank transfer / cash and recorded by a
-- super admin, which extends the gym's paid-until date. When the subscription
-- runs out (plus 3 days' grace) the staff dashboard locks until it is renewed;
-- the gym's members keep using their app.

alter table public.gyms
  add column trial_ends_at date not null default ((now() at time zone 'Asia/Beirut')::date + 14),
  add column paid_until date;
grant select (trial_ends_at, paid_until) on public.gyms to authenticated;

create table public.platform_payments (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  months        integer not null check (months between 1 and 36),
  amount_usd    numeric(10, 2) not null check (amount_usd >= 0),
  method        text not null check (char_length(method) between 1 and 40),
  note          text check (char_length(note) <= 200),
  paid_until    date not null,
  recorded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index platform_payments_gym_idx on public.platform_payments (gym_id, created_at desc);

alter table public.platform_payments enable row level security;
revoke all on public.platform_payments from anon, authenticated;
grant select on public.platform_payments to authenticated;
-- The owner sees their gym's subscription payments; super admins see all.
create policy platform_payments_select on public.platform_payments for select
  using (public.is_platform_admin() or public.my_gym_role(gym_id) = 'owner');

-- One row: how gyms pay for Gymix (shown on the owner's Subscription tab).
create table public.platform_settings (
  id                    boolean primary key default true check (id),
  payment_instructions  text not null default '' check (char_length(payment_instructions) <= 1000),
  whatsapp              text not null default '' check (char_length(whatsapp) <= 30),
  updated_at            timestamptz not null default now()
);
insert into public.platform_settings (id) values (true);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;
create policy platform_settings_select on public.platform_settings for select using (auth.uid() is not null);

-- Where a gym's subscription stands. Anyone in the gym (or a super admin) may ask.
create function public.gym_subscription(p_gym_id uuid)
returns table (status text, ends_on date, days_left integer, trial_ends_at date, paid_until date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_gym   public.gyms;
  v_today date;
  v_end   date;
begin
  if public.my_gym_role(p_gym_id) is null and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  if not found then
    return;
  end if;
  v_today := public.gym_today(p_gym_id);
  v_end := greatest(v_gym.trial_ends_at, coalesce(v_gym.paid_until, v_gym.trial_ends_at));
  return query select
    case
      when v_gym.paid_until is not null and v_gym.paid_until >= v_today then 'active'
      when v_end >= v_today then 'trial'
      when v_end + 3 >= v_today then 'grace'
      else 'expired'
    end,
    v_end,
    (v_end - v_today)::integer,
    v_gym.trial_ends_at,
    v_gym.paid_until;
end;
$$;

-- Super admin: a gym paid for some months. Extends from today or from the
-- current end date, whichever is later.
create function public.admin_record_subscription_payment(
  p_gym_id uuid, p_months integer, p_amount_usd numeric, p_method text, p_note text default null
)
returns date
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym   public.gyms;
  v_start date;
  v_until date;
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_months is null or p_months < 1 or p_months > 36 then
    raise exception 'Months must be between 1 and 36' using errcode = '22023';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id for update;
  if not found then
    raise exception 'Gym not found' using errcode = 'P0002';
  end if;
  v_start := greatest(public.gym_today(p_gym_id) - 1,
                      coalesce(v_gym.paid_until, v_gym.trial_ends_at), v_gym.trial_ends_at);
  v_until := (v_start + make_interval(months => p_months))::date;
  update public.gyms set paid_until = v_until where id = p_gym_id;
  insert into public.platform_payments (gym_id, months, amount_usd, method, note, paid_until, recorded_by)
  values (p_gym_id, p_months, p_amount_usd, trim(p_method), nullif(trim(p_note), ''), v_until, auth.uid());
  perform public.notify_roles(p_gym_id, array['owner']::public.gym_role[], 'billing',
    'Gymix subscription renewed',
    format('Thank you. Your subscription is paid until %s.', to_char(v_until, 'DD Mon YYYY')),
    '/dashboard/settings?tab=subscription');
  return v_until;
end;
$$;

-- Super admin: give a gym more free days.
create function public.admin_extend_trial(p_gym_id uuid, p_days integer)
returns date
language plpgsql security definer set search_path = ''
as $$
declare
  v_until date;
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Days must be between 1 and 365' using errcode = '22023';
  end if;
  update public.gyms
     set trial_ends_at = greatest(trial_ends_at, public.gym_today(id)) + p_days
   where id = p_gym_id
  returning trial_ends_at into v_until;
  if v_until is null then
    raise exception 'Gym not found' using errcode = 'P0002';
  end if;
  return v_until;
end;
$$;

create function public.admin_save_platform_settings(p_instructions text, p_whatsapp text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.platform_settings
     set payment_instructions = coalesce(trim(p_instructions), ''),
         whatsapp = regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g'),
         updated_at = now()
   where id;
end;
$$;

-- The console's gym list gains each gym's subscription.
drop function public.admin_gym_overview();
create function public.admin_gym_overview()
returns table (
  gym_id          uuid,
  name            text,
  created_at      timestamptz,
  owner_name      text,
  owner_email     text,
  owner_phone     text,
  staff           integer,
  members         integer,
  active_members  integer,
  checkins_30d    integer,
  collected_30d   numeric,
  last_checkin_at timestamptz,
  trial_ends_at   date,
  paid_until      date
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
    g.paid_until
  from public.gyms g
  left join lateral (
    select pr.full_name, pr.email, pr.phone from public.gym_users gu
    join public.profiles pr on pr.id = gu.user_id
    where gu.gym_id = g.id and gu.role = 'owner'
    limit 1
  ) op on true
  order by g.created_at desc;
end;
$$;

revoke execute on function public.admin_gym_overview() from public, anon;
revoke execute on function public.gym_subscription(uuid) from public, anon;
revoke execute on function public.admin_record_subscription_payment(uuid, integer, numeric, text, text) from public, anon;
revoke execute on function public.admin_extend_trial(uuid, integer) from public, anon;
revoke execute on function public.admin_save_platform_settings(text, text) from public, anon;
grant execute on function public.admin_gym_overview() to authenticated;
grant execute on function public.gym_subscription(uuid) to authenticated;
grant execute on function public.admin_record_subscription_payment(uuid, integer, numeric, text, text) to authenticated;
grant execute on function public.admin_extend_trial(uuid, integer) to authenticated;
grant execute on function public.admin_save_platform_settings(text, text) to authenticated;
