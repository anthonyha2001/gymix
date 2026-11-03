-- Phase 2: members, membership plans, memberships, invoices, payments, check-ins.
--
-- `members` is the gym's customer record and doesn't require a Gymix account
-- (front desk adds walk-ins by name/phone). When someone with the member role
-- joins the gym (invite claimed), their account is linked to the matching
-- member record by email, or a new record is created.
--
-- Reads go through RLS. Money and membership changes go through SECURITY DEFINER
-- functions that check the caller's role, so totals and invoice numbers can't be
-- tampered with from the client.

alter table public.gyms
  add column timezone text not null default 'Asia/Beirut',
  add column lbp_rate numeric(12, 2) not null default 89500 check (lbp_rate > 0),
  add column next_invoice_number integer not null default 1,
  -- Secret in the URL written to the gym's NFC check-in sticker(s).
  add column checkin_token text not null unique default replace(gen_random_uuid()::text, '-', '');

grant update (lbp_rate) on public.gyms to authenticated;

-- Everyone in a gym can read its settings, but not the sticker token
-- (owners/managers fetch it via get_checkin_token()).
revoke select on public.gyms from authenticated;
grant select (id, name, slug, created_by, created_at, timezone, lbp_rate, next_invoice_number)
  on public.gyms to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.has_gym_role(p_gym_id uuid, p_roles public.gym_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_gym_role(p_gym_id) = any (p_roles), false)
$$;

-- Roles allowed to sell memberships, take payments and see billing.
create function public.can_handle_billing(p_gym_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_gym_role(p_gym_id, array['owner', 'manager', 'front_desk']::public.gym_role[])
$$;

-- "Today" in the gym's own timezone.
create function public.gym_today(p_gym_id uuid)
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone timezone)::date from public.gyms where id = p_gym_id
$$;

-- 10 hex chars from a v4 UUID (40 random bits): printed in the member's QR code.
create function public.new_checkin_code()
returns text
language sql volatile set search_path = ''
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  full_name     text not null check (char_length(trim(full_name)) between 2 and 120),
  phone         text check (char_length(phone) <= 30),
  email         text check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  notes         text check (char_length(notes) <= 2000),
  checkin_code  text not null unique default public.new_checkin_code(),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create unique index members_gym_user_unique on public.members (gym_id, user_id) where user_id is not null;
create unique index members_gym_email_unique on public.members (gym_id, email) where email is not null;
create index members_gym_name_idx on public.members (gym_id, full_name);

create type public.plan_period as enum ('day', 'week', 'month', 'year');

create table public.membership_plans (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 80),
  description   text check (char_length(description) <= 500),
  price_usd     numeric(10, 2) not null check (price_usd >= 0),
  period        public.plan_period not null default 'month',
  period_count  integer not null default 1 check (period_count between 1 and 36),
  visit_limit   integer check (visit_limit between 1 and 1000),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index membership_plans_gym_idx on public.membership_plans (gym_id);

create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  plan_id       uuid references public.membership_plans (id) on delete set null,
  plan_name     text not null,
  starts_on     date not null,
  ends_on       date not null check (ends_on >= starts_on),
  visit_limit   integer,
  visits_used   integer not null default 0 check (visits_used >= 0),
  frozen_on     date,
  cancelled_at  timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index memberships_member_idx on public.memberships (member_id, ends_on desc);
create index memberships_gym_ends_idx on public.memberships (gym_id, ends_on);

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  member_id      uuid not null references public.members (id),
  membership_id  uuid references public.memberships (id) on delete set null,
  number         integer not null,
  description    text not null check (char_length(description) between 1 and 200),
  amount_usd     numeric(10, 2) not null check (amount_usd >= 0),
  discount_usd   numeric(10, 2) not null default 0 check (discount_usd >= 0 and discount_usd <= amount_usd),
  issued_on      date not null,
  voided_at      timestamptz,
  void_reason    text check (char_length(void_reason) <= 200),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (gym_id, number)
);

create index invoices_member_idx on public.invoices (member_id);

create type public.payment_method as enum ('cash_usd', 'cash_lbp', 'card', 'whish', 'omt', 'bank_transfer', 'other');

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms (id) on delete cascade,
  invoice_id   uuid not null references public.invoices (id),
  member_id    uuid not null references public.members (id),
  amount_usd   numeric(10, 2) not null check (amount_usd > 0),
  method       public.payment_method not null,
  -- When paid in lira: the amount handed over and the rate used to convert it.
  amount_lbp   numeric(14, 0) check (amount_lbp > 0),
  lbp_rate     numeric(12, 2) check (lbp_rate > 0),
  note         text check (char_length(note) <= 200),
  received_by  uuid references public.profiles (id) on delete set null,
  paid_at      timestamptz not null default now(),
  check ((amount_lbp is null) = (lbp_rate is null))
);

create index payments_invoice_idx on public.payments (invoice_id);
create index payments_gym_paid_idx on public.payments (gym_id, paid_at desc);

create table public.checkins (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete cascade,
  membership_id   uuid references public.memberships (id) on delete set null,
  allowed         boolean not null,
  reason          text,
  -- 'desk' = checked in by staff, 'tap' = member tapped the NFC sticker.
  source          text not null default 'desk' check (source in ('desk', 'tap')),
  checked_in_by   uuid references public.profiles (id) on delete set null,
  checked_in_at   timestamptz not null default now()
);

create index checkins_gym_time_idx on public.checkins (gym_id, checked_in_at desc);
create index checkins_member_time_idx on public.checkins (member_id, checked_in_at desc);

-- ---------------------------------------------------------------------------
-- Views (security_invoker: the caller's RLS applies to the underlying tables)
-- ---------------------------------------------------------------------------

create view public.invoice_summary with (security_invoker = true) as
select
  i.*,
  i.amount_usd - i.discount_usd                                   as total_usd,
  coalesce(p.paid, 0)                                             as paid_usd,
  greatest(i.amount_usd - i.discount_usd - coalesce(p.paid, 0), 0) as balance_usd,
  case
    when i.voided_at is not null                         then 'void'
    when coalesce(p.paid, 0) >= i.amount_usd - i.discount_usd then 'paid'
    when coalesce(p.paid, 0) > 0                         then 'partial'
    else 'unpaid'
  end                                                             as status
from public.invoices i
left join lateral (select sum(amount_usd) as paid from public.payments where invoice_id = i.id) p on true;

-- How well a membership answers "what's this member's membership right now?":
-- 2 = covers today and usable, 1 = covers today (frozen / out of visits), 0 = other.
-- Callers take the highest rank, then the latest end date.
create function public.membership_rank(ms public.memberships, p_today date)
returns integer
language sql immutable set search_path = ''
as $$
  select case
    when ms.starts_on <= p_today and ms.ends_on >= p_today
         and ms.frozen_on is null and (ms.visit_limit is null or ms.visits_used < ms.visit_limit) then 2
    when ms.starts_on <= p_today and ms.ends_on >= p_today then 1
    else 0
  end
$$;

-- One row per member with their current membership and money owed.
-- "Current" = see membership_rank().
create view public.member_overview with (security_invoker = true) as
select
  m.*,
  cm.id           as membership_id,
  cm.plan_name,
  cm.starts_on,
  cm.ends_on,
  cm.visit_limit,
  cm.visits_used,
  cm.frozen_on,
  case
    when cm.id is null                                                  then 'none'
    when cm.frozen_on is not null                                       then 'frozen'
    when cm.starts_on > t.today                                         then 'upcoming'
    when cm.ends_on < t.today                                           then 'expired'
    when cm.visit_limit is not null and cm.visits_used >= cm.visit_limit then 'used_up'
    else 'active'
  end             as status,
  coalesce(b.balance, 0) as balance_usd,
  lc.last_checkin_at
from public.members m
cross join lateral (select public.gym_today(m.gym_id) as today) t
left join lateral (
  select * from public.memberships ms
  where ms.member_id = m.id and ms.cancelled_at is null
  order by public.membership_rank(ms, t.today) desc, ms.ends_on desc
  limit 1
) cm on true
left join lateral (
  select sum(balance_usd) as balance from public.invoice_summary s
  where s.member_id = m.id and s.status in ('unpaid', 'partial')
) b on true
left join lateral (
  select max(checked_in_at) as last_checkin_at from public.checkins c
  where c.member_id = m.id and c.allowed
) lc on true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.members          enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships      enable row level security;
alter table public.invoices         enable row level security;
alter table public.payments         enable row level security;
alter table public.checkins         enable row level security;

revoke all on public.members, public.membership_plans, public.memberships,
              public.invoices, public.payments, public.checkins from anon;
revoke insert, update, delete on public.members, public.membership_plans, public.memberships,
              public.invoices, public.payments, public.checkins from authenticated;
revoke all on public.invoice_summary, public.member_overview from anon;

grant insert (gym_id, full_name, phone, email, notes, created_by) on public.members to authenticated;
grant update (full_name, phone, email, notes) on public.members to authenticated;
grant insert (gym_id, name, description, price_usd, period, period_count, visit_limit) on public.membership_plans to authenticated;
grant update (name, description, price_usd, period, period_count, visit_limit, is_active) on public.membership_plans to authenticated;

-- Is this member record the caller's own?
create function public.is_my_member(p_member_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members where id = p_member_id and user_id = auth.uid())
$$;

create policy members_select on public.members for select
  using (public.is_gym_staff(gym_id) or user_id = auth.uid());
create policy members_insert on public.members for insert
  with check (public.can_handle_billing(gym_id) and created_by = auth.uid());
create policy members_update on public.members for update
  using (public.can_handle_billing(gym_id))
  with check (public.can_handle_billing(gym_id));

create policy plans_select on public.membership_plans for select
  using (public.my_gym_role(gym_id) is not null);
create policy plans_insert on public.membership_plans for insert
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy plans_update on public.membership_plans for update
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));

create policy memberships_select on public.memberships for select
  using (public.is_gym_staff(gym_id) or public.is_my_member(member_id));

-- Money: billing staff and the member themselves only (trainers don't see it).
create policy invoices_select on public.invoices for select
  using (public.can_handle_billing(gym_id) or public.is_my_member(member_id));
create policy payments_select on public.payments for select
  using (public.can_handle_billing(gym_id) or public.is_my_member(member_id));

create policy checkins_select on public.checkins for select
  using (public.is_gym_staff(gym_id) or public.is_my_member(member_id));

-- ---------------------------------------------------------------------------
-- Link accounts with the member role to member records
-- ---------------------------------------------------------------------------

create function public.sync_member_record()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_name  text;
begin
  -- Leaving the gym or becoming staff: keep the member's history, drop the link.
  if tg_op = 'DELETE' then
    update public.members set user_id = null where gym_id = old.gym_id and user_id = old.user_id;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.role <> 'member' then
    update public.members set user_id = null where gym_id = old.gym_id and user_id = old.user_id;
  end if;

  if new.role = 'member'
     and not exists (select 1 from public.members where gym_id = new.gym_id and user_id = new.user_id) then
    select lower(email), full_name into v_email, v_name from public.profiles where id = new.user_id;

    update public.members set user_id = new.user_id
     where gym_id = new.gym_id and email = v_email and user_id is null;

    if not found then
      insert into public.members (gym_id, user_id, full_name, email)
      values (new.gym_id, new.user_id, coalesce(nullif(trim(v_name), ''), 'Member'), nullif(v_email, ''))
      on conflict (gym_id, email) where email is not null do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger gym_users_sync_member
  after insert or update of role or delete on public.gym_users
  for each row execute function public.sync_member_record();

-- Existing portal members from Phase 1 get a member record.
insert into public.members (gym_id, user_id, full_name, email)
select gu.gym_id, gu.user_id, coalesce(nullif(trim(p.full_name), ''), 'Member'), nullif(lower(p.email), '')
from public.gym_users gu
join public.profiles p on p.id = gu.user_id
where gu.role = 'member'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Money & membership operations
-- ---------------------------------------------------------------------------

create function public.require_billing(p_gym_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_handle_billing(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

create function public.add_payment(
  p_invoice_id  uuid,
  p_amount_usd  numeric,
  p_method      public.payment_method,
  p_amount_lbp  numeric default null,
  p_note        text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv     public.invoice_summary;
  v_rate    numeric;
  v_id      uuid;
begin
  -- Lock the invoice so two payments can't both fit under the same balance.
  perform 1 from public.invoices where id = p_invoice_id for update;
  select * into v_inv from public.invoice_summary where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  perform public.require_billing(v_inv.gym_id);

  if v_inv.status = 'void' then
    raise exception 'Invoice is void' using errcode = '22023';
  end if;
  if p_amount_usd is null or p_amount_usd <= 0 then
    raise exception 'Payment must be more than zero' using errcode = '22023';
  end if;
  if round(p_amount_usd, 2) > v_inv.balance_usd then
    raise exception 'Payment is more than the balance of %', v_inv.balance_usd using errcode = '22023';
  end if;

  if p_amount_lbp is not null then
    select lbp_rate into v_rate from public.gyms where id = v_inv.gym_id;
  end if;

  insert into public.payments (gym_id, invoice_id, member_id, amount_usd, method, amount_lbp, lbp_rate, note, received_by)
  values (v_inv.gym_id, p_invoice_id, v_inv.member_id, round(p_amount_usd, 2), p_method,
          round(p_amount_lbp), v_rate, nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Creates the membership and its invoice, plus an optional first payment.
-- Returns the invoice id.
create function public.sell_membership(
  p_member_id     uuid,
  p_plan_id       uuid,
  p_starts_on     date,
  p_discount_usd  numeric default 0,
  p_paid_usd      numeric default 0,
  p_method        public.payment_method default null,
  p_amount_lbp    numeric default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_member      public.members;
  v_plan        public.membership_plans;
  v_ends_on     date;
  v_ms_id       uuid;
  v_number      integer;
  v_invoice_id  uuid;
begin
  select * into v_member from public.members where id = p_member_id;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  perform public.require_billing(v_member.gym_id);

  select * into v_plan from public.membership_plans
   where id = p_plan_id and gym_id = v_member.gym_id and is_active;
  if not found then
    raise exception 'Plan not found' using errcode = 'P0002';
  end if;
  if coalesce(p_discount_usd, 0) < 0 or coalesce(p_discount_usd, 0) > v_plan.price_usd then
    raise exception 'Discount must be between 0 and the plan price' using errcode = '22023';
  end if;
  if p_starts_on is null then
    raise exception 'Start date is required' using errcode = '22023';
  end if;

  v_ends_on := (p_starts_on + make_interval(
      days   => case v_plan.period when 'day'  then v_plan.period_count when 'week' then 7 * v_plan.period_count else 0 end,
      months => case v_plan.period when 'month' then v_plan.period_count else 0 end,
      years  => case v_plan.period when 'year' then v_plan.period_count else 0 end
    ))::date - 1;

  insert into public.memberships (gym_id, member_id, plan_id, plan_name, starts_on, ends_on, visit_limit, created_by)
  values (v_member.gym_id, v_member.id, v_plan.id, v_plan.name, p_starts_on, v_ends_on, v_plan.visit_limit, auth.uid())
  returning id into v_ms_id;

  update public.gyms set next_invoice_number = next_invoice_number + 1
   where id = v_member.gym_id
  returning next_invoice_number - 1 into v_number;

  insert into public.invoices (gym_id, member_id, membership_id, number, description, amount_usd, discount_usd, issued_on, created_by)
  values (v_member.gym_id, v_member.id, v_ms_id, v_number,
          v_plan.name || ' · ' || to_char(p_starts_on, 'DD Mon YYYY') || ' – ' || to_char(v_ends_on, 'DD Mon YYYY'),
          v_plan.price_usd, round(coalesce(p_discount_usd, 0), 2), public.gym_today(v_member.gym_id), auth.uid())
  returning id into v_invoice_id;

  if coalesce(p_paid_usd, 0) > 0 then
    if p_method is null then
      raise exception 'Payment method is required' using errcode = '22023';
    end if;
    perform public.add_payment(v_invoice_id, p_paid_usd, p_method, p_amount_lbp);
  end if;

  return v_invoice_id;
end;
$$;

create function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.invoices;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if not public.has_gym_role(v_inv.gym_id, array['owner', 'manager']::public.gym_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice_id) then
    raise exception 'Invoice has payments and cannot be voided' using errcode = '22023';
  end if;
  update public.invoices set voided_at = now(), void_reason = nullif(trim(p_reason), '') where id = p_invoice_id;
  -- A voided membership sale shouldn't leave an active membership behind.
  update public.memberships set cancelled_at = now() where id = v_inv.membership_id and cancelled_at is null;
end;
$$;

-- p_action: 'freeze' | 'unfreeze' | 'cancel'
create function public.update_membership(p_membership_id uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms    public.memberships;
  v_today date;
begin
  select * into v_ms from public.memberships where id = p_membership_id for update;
  if not found then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;
  perform public.require_billing(v_ms.gym_id);
  v_today := public.gym_today(v_ms.gym_id);

  if v_ms.cancelled_at is not null then
    raise exception 'Membership is cancelled' using errcode = '22023';
  end if;

  case p_action
    when 'freeze' then
      if v_ms.frozen_on is not null then
        raise exception 'Already frozen' using errcode = '22023';
      end if;
      if v_ms.ends_on < v_today then
        raise exception 'Membership has already ended' using errcode = '22023';
      end if;
      update public.memberships set frozen_on = greatest(v_today, starts_on) where id = v_ms.id;
    when 'unfreeze' then
      if v_ms.frozen_on is null then
        raise exception 'Not frozen' using errcode = '22023';
      end if;
      -- The frozen days are added back to the end date.
      update public.memberships
         set ends_on = ends_on + greatest(v_today - frozen_on, 0), frozen_on = null
       where id = v_ms.id;
    when 'cancel' then
      if not public.has_gym_role(v_ms.gym_id, array['owner', 'manager']::public.gym_role[]) then
        raise exception 'Not allowed' using errcode = '42501';
      end if;
      update public.memberships set cancelled_at = now() where id = v_ms.id;
    else
      raise exception 'Unknown action %', p_action using errcode = '22023';
  end case;
end;
$$;

-- Core check-in for one member: decides whether they're allowed in, logs the
-- attempt (denied ones too) and counts punch-card visits. A second check-in
-- within 3 hours is reported as "already checked in" and not counted again.
-- Internal only: check_in() and self_check_in() do the permission checks.
create function public.record_check_in(p_gym_id uuid, p_member_id uuid, p_source text)
returns table (
  allowed          boolean,
  already_in       boolean,
  reason           text,
  member_id        uuid,
  full_name        text,
  plan_name        text,
  ends_on          date,
  visits_left      integer,
  balance_usd      numeric
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member   public.members;
  v_ms       public.memberships;
  v_today    date;
  v_allowed  boolean;
  v_reason   text;
  v_balance  numeric;
begin
  select * into v_member from public.members m where m.id = p_member_id and m.gym_id = p_gym_id;
  if not found then
    return query select false, false, 'Member not found'::text,
                        null::uuid, null::text, null::text, null::date, null::integer, null::numeric;
    return;
  end if;

  v_today := public.gym_today(p_gym_id);
  select * into v_ms from public.memberships ms
   where ms.member_id = v_member.id and ms.cancelled_at is null
   order by public.membership_rank(ms, v_today) desc, ms.ends_on desc
   limit 1;

  select coalesce(sum(s.balance_usd), 0) into v_balance
    from public.invoice_summary s where s.member_id = v_member.id and s.status in ('unpaid', 'partial');

  if v_ms.id is null then
    v_allowed := false; v_reason := 'No membership';
  elsif v_ms.frozen_on is not null then
    v_allowed := false; v_reason := 'Membership is frozen';
  elsif v_ms.starts_on > v_today then
    v_allowed := false; v_reason := 'Membership starts on ' || to_char(v_ms.starts_on, 'DD Mon YYYY');
  elsif v_ms.ends_on < v_today then
    v_allowed := false; v_reason := 'Membership expired on ' || to_char(v_ms.ends_on, 'DD Mon YYYY');
  elsif v_ms.visit_limit is not null and v_ms.visits_used >= v_ms.visit_limit then
    v_allowed := false; v_reason := 'No visits left';
  else
    v_allowed := true;
  end if;

  if v_allowed and exists (
    select 1 from public.checkins c
     where c.member_id = v_member.id and c.allowed and c.checked_in_at > now() - interval '3 hours'
  ) then
    return query select true, true, 'Already checked in'::text, v_member.id, v_member.full_name, v_ms.plan_name,
                        v_ms.ends_on, v_ms.visit_limit - v_ms.visits_used, v_balance;
    return;
  end if;

  insert into public.checkins (gym_id, member_id, membership_id, allowed, reason, source, checked_in_by)
  values (p_gym_id, v_member.id, v_ms.id, v_allowed, v_reason, p_source, auth.uid());

  if v_allowed and v_ms.visit_limit is not null then
    update public.memberships set visits_used = visits_used + 1 where id = v_ms.id
    returning visits_used into v_ms.visits_used;
  end if;

  return query select v_allowed, false, v_reason, v_member.id, v_member.full_name, v_ms.plan_name,
                      v_ms.ends_on, v_ms.visit_limit - v_ms.visits_used, v_balance;
end;
$$;

-- Front desk: by member id (name search) or member code (typed, or read from an
-- NFC key fob by a USB reader, for members without a smartphone).
create function public.check_in(p_gym_id uuid, p_code text default null, p_member_id uuid default null)
returns table (
  allowed boolean, already_in boolean, reason text, member_id uuid, full_name text,
  plan_name text, ends_on date, visits_left integer, balance_usd numeric
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_member_id uuid;
begin
  if not public.is_gym_staff(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select m.id into v_member_id from public.members m
   where m.gym_id = p_gym_id
     and (m.id = p_member_id or (p_code is not null and m.checkin_code = upper(trim(p_code))));
  if v_member_id is null then
    return query select false, false, 'No member with this code at this gym'::text,
                        null::uuid, null::text, null::text, null::date, null::integer, null::numeric;
    return;
  end if;

  return query select * from public.record_check_in(p_gym_id, v_member_id, 'desk');
end;
$$;

-- Member taps the gym's NFC sticker (which opens /c/<token>): checks themselves in.
create function public.self_check_in(p_token text)
returns table (
  allowed boolean, already_in boolean, reason text, member_id uuid, full_name text,
  plan_name text, ends_on date, visits_left integer, balance_usd numeric
)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_gym_id    uuid;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select g.id into v_gym_id from public.gyms g where g.checkin_token = p_token;
  if v_gym_id is null then
    raise exception 'This check-in link is no longer valid. Ask the front desk.' using errcode = 'P0002';
  end if;

  select m.id into v_member_id from public.members m where m.gym_id = v_gym_id and m.user_id = auth.uid();
  if v_member_id is null then
    raise exception 'Your account isn''t linked to a membership at this gym. Ask the front desk.' using errcode = 'P0002';
  end if;

  return query select * from public.record_check_in(v_gym_id, v_member_id, 'tap');
end;
$$;

create function public.get_checkin_token(p_gym_id uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner', 'manager']::public.gym_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select checkin_token from public.gyms where id = p_gym_id);
end;
$$;

-- Owner replaces the sticker link (e.g. if it was shared). Old stickers stop working.
create function public.rotate_checkin_token(p_gym_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.has_gym_role(p_gym_id, array['owner']::public.gym_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.gyms set checkin_token = replace(gen_random_uuid()::text, '-', '')
   where id = p_gym_id
  returning checkin_token into v_token;
  return v_token;
end;
$$;

-- Dashboard numbers for one gym. Money figures are null for staff who can't see billing.
create function public.gym_stats(p_gym_id uuid)
returns table (
  active_members    integer,
  expiring_soon     integer,
  checkins_today    integer,
  collected_month   numeric,
  outstanding       numeric
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date;
  v_tz    text;
begin
  if not public.is_gym_staff(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select timezone into v_tz from public.gyms where id = p_gym_id;
  v_today := public.gym_today(p_gym_id);

  return query
  with current_ms as (
    select distinct on (ms.member_id) ms.*
      from public.memberships ms
     where ms.gym_id = p_gym_id and ms.cancelled_at is null
     order by ms.member_id, public.membership_rank(ms, v_today) desc, ms.ends_on desc
  )
  select
    (select count(*)::integer from current_ms c
      where c.frozen_on is null and c.starts_on <= v_today and c.ends_on >= v_today
        and (c.visit_limit is null or c.visits_used < c.visit_limit)),
    (select count(*)::integer from current_ms c
      where c.frozen_on is null and c.ends_on between v_today and v_today + 7
        and not exists (select 1 from public.memberships n
                         where n.member_id = c.member_id and n.cancelled_at is null and n.starts_on > c.ends_on)),
    (select count(*)::integer from public.checkins ch
      where ch.gym_id = p_gym_id and ch.allowed and (ch.checked_in_at at time zone v_tz)::date = v_today),
    case when public.can_handle_billing(p_gym_id) then
      (select coalesce(sum(p.amount_usd), 0) from public.payments p
        where p.gym_id = p_gym_id and date_trunc('month', p.paid_at at time zone v_tz) = date_trunc('month', v_today::timestamp))
    end,
    case when public.can_handle_billing(p_gym_id) then
      (select coalesce(sum(s.balance_usd), 0) from public.invoice_summary s
        where s.gym_id = p_gym_id and s.status in ('unpaid', 'partial'))
    end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.sync_member_record() from public, anon, authenticated;
revoke execute on function public.require_billing(uuid) from public, anon, authenticated;
revoke execute on function public.record_check_in(uuid, uuid, text) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.add_payment(uuid, numeric, public.payment_method, numeric, text)',
    'public.sell_membership(uuid, uuid, date, numeric, numeric, public.payment_method, numeric)',
    'public.void_invoice(uuid, text)',
    'public.update_membership(uuid, text)',
    'public.check_in(uuid, text, uuid)',
    'public.self_check_in(text)',
    'public.rotate_checkin_token(uuid)',
    'public.get_checkin_token(uuid)',
    'public.gym_stats(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
