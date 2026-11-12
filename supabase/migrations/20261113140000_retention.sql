-- Keeping members coming back:
--   * win-back: a friendly nudge to members who haven't come for N days
--   * announcements: the gym messages everyone, or a group (expiring,
--     inactive, staff), as a notification (and push)
--   * nightly summary: one notification to owners and managers each evening
-- Win-back and the summary run from the daily cron (/api/cron/daily).

alter table public.gyms
  add column winback_days integer default 10 check (winback_days is null or winback_days between 3 and 60),
  add column daily_summary boolean not null default true;
grant update (winback_days, daily_summary) on public.gyms to authenticated;

-- The last day each member was let in.
create function public.member_last_visit(p_member_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(checked_in_at) from public.checkins where member_id = p_member_id and allowed;
$$;
revoke execute on function public.member_last_visit(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ win-back
-- Members with a running membership and an app login, whose last visit (or
-- membership start) is winback_days ago or more. One nudge per absence: the
-- key includes the last visit, so they're nudged again only after coming
-- back and then stopping again. Returns how many were nudged.
create function public.send_winbacks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select m.id as member_id, m.user_id, m.full_name, g.id as gym_id, g.name as gym_name, g.winback_days,
           coalesce(public.member_last_visit(m.id), ms.starts_on::timestamptz) as since
      from public.members m
      join public.gyms g on g.id = m.gym_id
      join lateral (
        select starts_on from public.memberships
         where member_id = m.id and cancelled_at is null and frozen_on is null
           and starts_on <= public.gym_today(g.id) and ends_on >= public.gym_today(g.id)
         order by ends_on desc limit 1
      ) ms on true
     where g.winback_days is not null and m.user_id is not null and m.archived_at is null
  loop
    if r.since < now() - make_interval(days => r.winback_days) then
      insert into public.notifications (gym_id, user_id, kind, title, body, link, dedupe_key)
      values (
        r.gym_id, r.user_id, 'winback',
        'We miss you, ' || split_part(r.full_name, ' ', 1),
        'It''s been ' || (now()::date - r.since::date) || ' days. Your spot at ' || r.gym_name || ' is waiting. Even 20 minutes counts.',
        '/portal/train',
        'winback:' || r.member_id || ':' || r.since::date
      )
      on conflict (dedupe_key) do nothing;
      if found then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.send_winbacks() from public, anon, authenticated;

-- -------------------------------------------------------------- announcements
create table public.gym_announcements (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  audience    text not null check (audience in ('members', 'expiring', 'inactive', 'staff', 'everyone')),
  title       text not null check (char_length(trim(title)) between 2 and 80),
  body        text check (char_length(body) <= 300),
  sent_to     integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index gym_announcements_gym_idx on public.gym_announcements (gym_id, created_at desc);
alter table public.gym_announcements enable row level security;
create policy gym_announcements_select on public.gym_announcements for select
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
grant select on public.gym_announcements to authenticated;

-- Who an announcement would reach (for the "Send to 84 people" button).
create function public.announcement_audience(p_gym_id uuid, p_audience text)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with active as (
    select m.id, m.user_id from public.members m
     where m.gym_id = p_gym_id and m.user_id is not null and m.archived_at is null
       and exists (select 1 from public.memberships ms where ms.member_id = m.id and ms.cancelled_at is null
                     and ms.ends_on >= public.gym_today(p_gym_id) and ms.starts_on <= public.gym_today(p_gym_id))
  )
  select distinct u from (
    select a.user_id as u from active a where p_audience in ('members', 'everyone')
    union all
    select a.user_id from active a
     where p_audience = 'expiring'
       and not exists (select 1 from public.memberships ms where ms.member_id = a.id and ms.cancelled_at is null
                         and ms.ends_on > public.gym_today(p_gym_id) + 7)
    union all
    select a.user_id from active a
     where p_audience = 'inactive'
       and coalesce(public.member_last_visit(a.id), '-infinity'::timestamptz) < now() - interval '14 days'
    union all
    select gu.user_id from public.gym_users gu
     where gu.gym_id = p_gym_id and gu.role <> 'member' and p_audience in ('staff', 'everyone')
  ) x(u);
$$;
revoke execute on function public.announcement_audience(uuid, text) from public, anon, authenticated;

create function public.announcement_reach(p_gym_id uuid, p_audience text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner', 'manager']::public.gym_role[]) then
    raise exception 'Only owners and managers can do this';
  end if;
  return (select count(*) from public.announcement_audience(p_gym_id, p_audience));
end;
$$;
revoke execute on function public.announcement_reach(uuid, text) from public, anon;
grant execute on function public.announcement_reach(uuid, text) to authenticated;

-- Sends an announcement. At most 10 a day per gym, so members aren't spammed.
create function public.send_announcement(p_gym_id uuid, p_audience text, p_title text, p_body text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
begin
  if not public.has_gym_role(p_gym_id, array['owner', 'manager']::public.gym_role[]) then
    raise exception 'Only owners and managers can do this';
  end if;
  if (select count(*) from public.gym_announcements where gym_id = p_gym_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That''s 10 announcements today. Try again tomorrow.';
  end if;
  insert into public.gym_announcements (gym_id, audience, title, body, created_by)
  values (p_gym_id, p_audience, trim(p_title), nullif(trim(coalesce(p_body, '')), ''), auth.uid())
  returning id into v_id;
  insert into public.notifications (gym_id, user_id, kind, title, body, link, dedupe_key)
  select p_gym_id, a.user_id, 'announcement', trim(p_title), nullif(trim(coalesce(p_body, '')), ''), null, 'announce:' || v_id || ':' || a.user_id
    from public.announcement_audience(p_gym_id, p_audience) a
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  update public.gym_announcements set sent_to = v_count where id = v_id;
  return v_count;
end;
$$;
revoke execute on function public.send_announcement(uuid, text, text, text) from public, anon;
grant execute on function public.send_announcement(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------- nightly summary
-- One notification per gym (to owners and managers) with today's numbers.
-- Gyms in their first day and gyms with nothing to report are skipped.
create function public.send_daily_summaries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  g record;
  v_today date;
  v_visits integer;
  v_sales numeric;
  v_paid numeric;
  v_new integer;
  v_ending integer;
  v_body text;
begin
  for g in select id, name from public.gyms where daily_summary and created_at < now() - interval '1 day' loop
    v_today := public.gym_today(g.id);
    select count(*) into v_visits from public.checkins c
     where c.gym_id = g.id and c.allowed
       and c.checked_in_at >= (v_today::timestamp at time zone (select timezone from public.gyms where id = g.id));
    select coalesce(sum(total_usd), 0) into v_sales from public.sales s
     where s.gym_id = g.id and s.status <> 'refunded'
       and s.created_at >= (v_today::timestamp at time zone (select timezone from public.gyms where id = g.id));
    select coalesce(sum(amount_usd), 0) into v_paid from public.payments p
     where p.gym_id = g.id and p.paid_at >= (v_today::timestamp at time zone (select timezone from public.gyms where id = g.id));
    select count(*) into v_new from public.memberships ms
     where ms.gym_id = g.id and ms.created_at >= (v_today::timestamp at time zone (select timezone from public.gyms where id = g.id));
    select count(*) into v_ending from public.memberships ms
     where ms.gym_id = g.id and ms.cancelled_at is null and ms.ends_on = v_today + 1
       and not exists (select 1 from public.memberships n where n.member_id = ms.member_id and n.starts_on > ms.ends_on - 3 and n.id <> ms.id);
    if v_visits + v_new + v_ending = 0 and v_sales + v_paid = 0 then
      continue;
    end if;
    v_body := v_visits || ' check-in' || case when v_visits = 1 then '' else 's' end
      || ' · $' || trim(to_char(v_paid + v_sales, 'FM999G999G990')) || ' taken'
      || case when v_new > 0 then ' · ' || v_new || ' new membership' || case when v_new = 1 then '' else 's' end else '' end
      || case when v_ending > 0 then ' · ' || v_ending || ' ending tomorrow' else '' end;
    insert into public.notifications (gym_id, user_id, kind, title, body, link, dedupe_key)
    select g.id, gu.user_id, 'summary', 'Today at ' || g.name, v_body, '/dashboard', 'summary:' || g.id || ':' || v_today || ':' || gu.user_id
      from public.gym_users gu
     where gu.gym_id = g.id and gu.role in ('owner', 'manager')
    on conflict (dedupe_key) do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.send_daily_summaries() from public, anon, authenticated;
