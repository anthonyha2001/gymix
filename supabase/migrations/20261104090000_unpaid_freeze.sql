-- Unpaid accounts are frozen.
-- A member with a balance still open after the gym's grace period is frozen:
-- the member app shows only its home page and check-in is refused. The next
-- check-in (NFC tap, simulator or front desk) after paying unfreezes them.

alter table public.gyms add column unpaid_grace_days integer not null default 3
  check (unpaid_grace_days between 0 and 60);
grant select (unpaid_grace_days), update (unpaid_grace_days) on public.gyms to authenticated;

alter table public.members add column unpaid_frozen_at timestamptz;

-- Internal: what the member owes on invoices older than the grace period.
create function public.overdue_balance(p_member_id uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(s.balance_usd), 0)
  from public.invoice_summary s
  join public.members m on m.id = s.member_id
  join public.gyms g on g.id = m.gym_id
  where s.member_id = p_member_id
    and s.status in ('unpaid', 'partial')
    and s.issued_on <= public.gym_today(g.id) - g.unpaid_grace_days
$$;

-- Internal: freezes the member if they owe an overdue balance. Returns whether
-- they are frozen afterwards. Never unfreezes: only a check-in does that.
create function public.apply_unpaid_freeze(p_member_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_m    public.members;
  v_owed numeric;
begin
  select * into v_m from public.members where id = p_member_id;
  if not found or v_m.archived_at is not null then
    return false;
  end if;
  v_owed := public.overdue_balance(p_member_id);
  if v_m.unpaid_frozen_at is null then
    if v_owed <= 0 then
      return false;
    end if;
    update public.members set unpaid_frozen_at = now() where id = p_member_id
    returning unpaid_frozen_at into v_m.unpaid_frozen_at;
    insert into public.activity_log (gym_id, actor_id, action, summary, details)
    values (v_m.gym_id, null, 'member.unpaid_frozen',
            format('%s frozen for an unpaid balance of $%s', v_m.full_name, to_char(v_owed, 'FM999990.00')),
            jsonb_build_object('member_id', v_m.id, 'owed_usd', v_owed));
  end if;
  -- Tell the member once per freeze: now, or once they have an account (the
  -- freeze may come from a staff page before they have joined the app).
  perform public.notify(
    v_m.gym_id, v_m.user_id, 'billing', 'Your account is frozen',
    case when v_owed > 0
      then format('You have an unpaid balance of $%s. Pay at the front desk, then tap in to unfreeze it.',
                  to_char(v_owed, 'FM999990.00'))
      else 'Tap in at the entrance to unfreeze it.'
    end,
    '/portal',
    format('unpaid-frozen:%s:%s', v_m.id, floor(extract(epoch from v_m.unpaid_frozen_at))));
  return true;
end;
$$;

-- Staff: freezes every member of the gym who owes an overdue balance.
create function public.freeze_unpaid_members(p_gym_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  if not public.is_gym_staff(p_gym_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  for v_id in
    select distinct s.member_id
    from public.invoice_summary s
    join public.members m on m.id = s.member_id
    where s.gym_id = p_gym_id and s.status in ('unpaid', 'partial')
      and m.unpaid_frozen_at is null and m.archived_at is null
  loop
    if public.apply_unpaid_freeze(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- Member: their own account state (freezing it first if it is overdue).
create function public.my_account_status(p_gym_id uuid)
returns table (frozen boolean, frozen_at timestamptz, overdue_usd numeric, balance_usd numeric)
language plpgsql security definer set search_path = ''
as $$
declare
  v_member_id uuid := public.my_member_id(p_gym_id);
begin
  if v_member_id is null then
    return query select false, null::timestamptz, 0::numeric, 0::numeric;
    return;
  end if;
  perform public.apply_unpaid_freeze(v_member_id);
  return query
    select m.unpaid_frozen_at is not null, m.unpaid_frozen_at, public.overdue_balance(m.id),
           (select coalesce(sum(s.balance_usd), 0) from public.invoice_summary s
             where s.member_id = m.id and s.status in ('unpaid', 'partial'))
    from public.members m where m.id = v_member_id;
end;
$$;

-- Check-in now refuses an overdue balance, and unfreezes a member who has paid.
create or replace function public.record_check_in(p_gym_id uuid, p_member_id uuid, p_source text)
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
  v_overdue  numeric;
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
  v_overdue := public.overdue_balance(v_member.id);

  if v_overdue > 0 then
    perform public.apply_unpaid_freeze(v_member.id);
    v_allowed := false;
    v_reason := 'Account frozen: unpaid balance of $' || to_char(v_overdue, 'FM999990.00');
  elsif v_ms.id is null then
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

  -- Paid up: this check-in unfreezes the account.
  if v_overdue <= 0 and v_member.unpaid_frozen_at is not null then
    update public.members set unpaid_frozen_at = null where id = v_member.id;
    perform public.notify(v_member.gym_id, v_member.user_id, 'billing', 'Your account is active again',
                          'Thanks for paying. Everything in the app is open again.', '/portal');
    insert into public.activity_log (gym_id, actor_id, action, summary, details)
    values (v_member.gym_id, auth.uid(), 'member.unpaid_unfrozen',
            format('%s unfrozen at check-in after paying', v_member.full_name),
            jsonb_build_object('member_id', v_member.id));
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

revoke execute on function public.overdue_balance(uuid) from public, anon, authenticated;
revoke execute on function public.apply_unpaid_freeze(uuid) from public, anon, authenticated;
revoke execute on function public.record_check_in(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.freeze_unpaid_members(uuid) from public, anon;
revoke execute on function public.my_account_status(uuid) from public, anon;
grant execute on function public.freeze_unpaid_members(uuid) to authenticated;
grant execute on function public.my_account_status(uuid) to authenticated;

-- member_overview selects m.*, so it is recreated to include unpaid_frozen_at.
drop view public.member_overview;
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
