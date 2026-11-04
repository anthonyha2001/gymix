-- Admin controls: archive/delete members, refund payments, edit memberships,
-- delete wrong check-ins, delete plans/classes — plus an activity log that
-- records every sensitive action (who, what, when, why).

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------

create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  summary     text not null,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index activity_log_gym_idx on public.activity_log (gym_id, created_at desc);

alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon;
revoke insert, update, delete on public.activity_log from authenticated;

-- Owners and managers can read it; nobody can edit it (functions write it).
create policy activity_select on public.activity_log for select
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));

create function public.log_activity(p_gym_id uuid, p_action text, p_summary text, p_details jsonb default '{}')
returns void
language sql security definer set search_path = ''
as $$
  insert into public.activity_log (gym_id, actor_id, action, summary, details)
  values (p_gym_id, auth.uid(), p_action, p_summary, coalesce(p_details, '{}'))
$$;

create function public.require_manager(p_gym_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner', 'manager']::public.gym_role[]) then
    raise exception 'Only owners and managers can do this' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Members: archive / delete
-- ---------------------------------------------------------------------------

alter table public.members add column archived_at timestamptz;

-- member_overview selects m.*, so it's recreated to include archived_at.
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
revoke all on public.member_overview from anon;

create function public.set_member_archived(p_member_id uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.members;
begin
  select * into v_m from public.members where id = p_member_id;
  if v_m.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  perform public.require_billing(v_m.gym_id);
  update public.members set archived_at = case when p_archived then now() end where id = v_m.id;
  perform public.log_activity(v_m.gym_id, case when p_archived then 'member.archive' else 'member.restore' end,
    (case when p_archived then 'Archived ' else 'Restored ' end) || v_m.full_name, jsonb_build_object('member_id', v_m.id));
end;
$$;

-- Permanent delete — only for members who were never billed (e.g. added by mistake).
create function public.delete_member(p_member_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.members;
begin
  select * into v_m from public.members where id = p_member_id;
  if v_m.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  perform public.require_manager(v_m.gym_id);
  if exists (select 1 from public.invoices where member_id = v_m.id) then
    raise exception 'This member has invoices, so their record must be kept. Archive them instead.' using errcode = '22023';
  end if;
  if v_m.user_id is not null then
    delete from public.gym_users where gym_id = v_m.gym_id and user_id = v_m.user_id and role = 'member';
  end if;
  delete from public.members where id = v_m.id;
  perform public.log_activity(v_m.gym_id, 'member.delete', 'Deleted member ' || v_m.full_name,
    jsonb_build_object('member_id', v_m.id, 'phone', v_m.phone, 'email', v_m.email));
end;
$$;

-- ---------------------------------------------------------------------------
-- Money: refunds, voids (logged)
-- ---------------------------------------------------------------------------

-- Refunds a payment: removes it (so every total updates) and logs the details.
create function public.refund_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p     public.payments;
  v_name  text;
  v_num   integer;
begin
  select * into v_p from public.payments where id = p_payment_id for update;
  if v_p.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  perform public.require_manager(v_p.gym_id);
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for the refund' using errcode = '22023';
  end if;
  select full_name into v_name from public.members where id = v_p.member_id;
  select number into v_num from public.invoices where id = v_p.invoice_id;
  delete from public.payments where id = v_p.id;
  perform public.log_activity(v_p.gym_id, 'payment.refund',
    'Refunded $' || v_p.amount_usd || ' to ' || coalesce(v_name, 'member') || ' (invoice #' || lpad(v_num::text, 4, '0') || ')',
    jsonb_build_object('payment', to_jsonb(v_p), 'reason', trim(p_reason)));
end;
$$;

-- Log voids too (void_invoice from Phase 2 stays the source of truth).
create function public.log_invoice_void()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.voided_at is null and new.voided_at is not null then
    perform public.log_activity(new.gym_id, 'invoice.void',
      'Voided invoice #' || lpad(new.number::text, 4, '0') || ' ($' || (new.amount_usd - new.discount_usd) || ')',
      jsonb_build_object('invoice_id', new.id, 'reason', new.void_reason));
  end if;
  return new;
end;
$$;

create trigger invoices_log_void after update of voided_at on public.invoices
  for each row execute function public.log_invoice_void();

-- ---------------------------------------------------------------------------
-- Memberships & check-ins
-- ---------------------------------------------------------------------------

-- Fix a membership's dates or visit counts (e.g. entered wrong, goodwill extension).
create function public.adjust_membership(
  p_membership_id uuid, p_starts_on date, p_ends_on date, p_visit_limit integer, p_visits_used integer
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ms public.memberships;
begin
  select * into v_ms from public.memberships where id = p_membership_id for update;
  if v_ms.id is null then
    raise exception 'Membership not found' using errcode = 'P0002';
  end if;
  perform public.require_manager(v_ms.gym_id);
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then
    raise exception 'The end date must be on or after the start date' using errcode = '22023';
  end if;
  if p_visit_limit is not null and (p_visit_limit < 1 or p_visits_used < 0 or p_visits_used > p_visit_limit) then
    raise exception 'Visits used must be between 0 and the visit limit' using errcode = '22023';
  end if;
  update public.memberships
     set starts_on = p_starts_on, ends_on = p_ends_on, visit_limit = p_visit_limit,
         visits_used = coalesce(p_visits_used, 0)
   where id = v_ms.id;
  perform public.log_activity(v_ms.gym_id, 'membership.adjust',
    'Changed ' || v_ms.plan_name || ' membership: ' || to_char(v_ms.starts_on, 'DD Mon') || '–' || to_char(v_ms.ends_on, 'DD Mon YYYY')
      || ' → ' || to_char(p_starts_on, 'DD Mon') || '–' || to_char(p_ends_on, 'DD Mon YYYY'),
    jsonb_build_object('membership_id', v_ms.id, 'before', to_jsonb(v_ms)));
end;
$$;

-- Remove a wrong check-in; a counted punch-card visit is given back.
create function public.delete_checkin(p_checkin_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_c public.checkins;
begin
  select * into v_c from public.checkins where id = p_checkin_id;
  if v_c.id is null then
    raise exception 'Check-in not found' using errcode = 'P0002';
  end if;
  perform public.require_manager(v_c.gym_id);
  delete from public.checkins where id = v_c.id;
  if v_c.allowed and v_c.membership_id is not null then
    update public.memberships set visits_used = greatest(visits_used - 1, 0)
     where id = v_c.membership_id and visit_limit is not null;
  end if;
  perform public.log_activity(v_c.gym_id, 'checkin.delete', 'Deleted a check-in from ' || to_char(v_c.checked_in_at, 'DD Mon HH24:MI'),
    jsonb_build_object('checkin', to_jsonb(v_c)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Plans & classes can be deleted by owners/managers
-- ---------------------------------------------------------------------------

grant delete on public.membership_plans, public.classes to authenticated;

-- Sold memberships keep their plan name (memberships.plan_name), so deleting a plan is safe.
create policy plans_delete on public.membership_plans for delete
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy classes_delete on public.classes for delete
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.log_activity(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.require_manager(uuid) from public, anon, authenticated;
revoke execute on function public.log_invoice_void() from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.set_member_archived(uuid, boolean)',
    'public.delete_member(uuid)',
    'public.refund_payment(uuid, text)',
    'public.adjust_membership(uuid, date, date, integer, integer)',
    'public.delete_checkin(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
