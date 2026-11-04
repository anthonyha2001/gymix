-- Super admin monitoring and control.
--
-- 1. platform_events: site traffic, logins, sign-ups and errors, written by the
--    web app with the service role key (no one can insert through the API) and
--    read by super admins only.
-- 2. Pricing moves from code into platform_settings, so a super admin can change
--    the price, trial length and grace period without a deploy.
-- 3. Super admins can suspend a gym (its staff dashboard locks like an ended
--    subscription; members keep their app).

-- ---------------------------------------------------------------- events

create table public.platform_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('request', 'login', 'login_failed', 'signup', 'error')),
  -- For requests: page (full load), navigation (in-app), action (form/server
  -- action), api (route handler).
  request_type  text check (request_type in ('page', 'navigation', 'action', 'api')),
  method        text check (char_length(method) <= 10),
  -- Path only, never the query string; secret tokens are replaced with :token.
  path          text check (char_length(path) <= 300),
  user_id       uuid,
  visitor_id    text check (char_length(visitor_id) <= 64),
  -- Only stored for login, failed login and sign-up events.
  ip            text check (char_length(ip) <= 64),
  country       text check (char_length(country) <= 8),
  device        text check (device in ('mobile', 'tablet', 'desktop', 'bot')),
  browser       text check (char_length(browser) <= 40),
  referrer      text check (char_length(referrer) <= 200),
  -- Error message, login method, or the login that was tried.
  message       text check (char_length(message) <= 1000),
  detail        jsonb not null default '{}'::jsonb
);
create index platform_events_kind_time_idx on public.platform_events (kind, created_at desc);
create index platform_events_time_idx on public.platform_events (created_at desc);

alter table public.platform_events enable row level security;
revoke all on public.platform_events from anon, authenticated;
grant select on public.platform_events to authenticated;
create policy platform_events_select on public.platform_events for select using (public.is_platform_admin());

-- Everything the monitoring dashboard shows for the last p_days days (in
-- Beirut time), with the same numbers for the period before it for comparison.
create function public.admin_monitoring(p_days integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days   integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today  date := (now() at time zone 'Asia/Beirut')::date;
  v_from   timestamptz := ((v_today - (v_days - 1))::timestamp at time zone 'Asia/Beirut');
  v_prev   timestamptz := ((v_today - (2 * v_days - 1))::timestamp at time zone 'Asia/Beirut');
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with ev as (
    select e.*,
           (e.created_at at time zone 'Asia/Beirut')::date as day,
           (e.kind = 'request' and e.request_type in ('page', 'navigation') and e.device is distinct from 'bot') as is_view
    from public.platform_events e
    where e.created_at >= v_prev
  ),
  cur as (select * from ev where created_at >= v_from),
  prev as (select * from ev where created_at < v_from),
  days as (select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as day)
  select jsonb_build_object(
    'days', v_days,
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'views', coalesce(s.views, 0),
        'visitors', coalesce(s.visitors, 0),
        'logins', coalesce(s.logins, 0),
        'failed_logins', coalesce(s.failed_logins, 0),
        'signups', coalesce(s.signups, 0),
        'errors', coalesce(s.errors, 0),
        'requests', coalesce(s.requests, 0)
      ) order by d.day), '[]'::jsonb)
      from days d
      left join (
        select cur.day,
               count(*) filter (where is_view) as views,
               count(distinct visitor_id) filter (where is_view) as visitors,
               count(*) filter (where kind = 'login') as logins,
               count(*) filter (where kind = 'login_failed') as failed_logins,
               count(*) filter (where kind = 'signup') as signups,
               count(*) filter (where kind = 'error') as errors,
               count(*) filter (where kind = 'request') as requests
        from cur group by cur.day
      ) s on s.day = d.day
    ),
    'totals', (
      select jsonb_build_object(
        'views', count(*) filter (where is_view),
        'visitors', count(distinct visitor_id) filter (where is_view),
        'signed_in_users', count(distinct user_id) filter (where kind = 'request'),
        'logins', count(*) filter (where kind = 'login'),
        'failed_logins', count(*) filter (where kind = 'login_failed'),
        'signups', count(*) filter (where kind = 'signup'),
        'errors', count(*) filter (where kind = 'error'),
        'requests', count(*) filter (where kind = 'request'),
        'bot_requests', count(*) filter (where kind = 'request' and device = 'bot')
      ) from cur
    ),
    'previous', (
      select jsonb_build_object(
        'views', count(*) filter (where is_view),
        'visitors', count(distinct visitor_id) filter (where is_view),
        'signed_in_users', count(distinct user_id) filter (where kind = 'request'),
        'logins', count(*) filter (where kind = 'login'),
        'failed_logins', count(*) filter (where kind = 'login_failed'),
        'signups', count(*) filter (where kind = 'signup'),
        'errors', count(*) filter (where kind = 'error'),
        'requests', count(*) filter (where kind = 'request'),
        'bot_requests', count(*) filter (where kind = 'request' and device = 'bot')
      ) from prev
    ),
    'top_pages', (
      select coalesce(jsonb_agg(t order by t.views desc), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct visitor_id) as visitors
        from cur where is_view group by path order by count(*) desc limit 15
      ) t
    ),
    'referrers', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]'::jsonb) from (
        select referrer, count(*) as visits from cur
        where is_view and referrer is not null group by referrer order by count(*) desc limit 10
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t order by t.visitors desc), '[]'::jsonb) from (
        select coalesce(country, '??') as country, count(distinct visitor_id) as visitors from cur
        where is_view group by 1 order by 2 desc limit 10
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(t order by t.visitors desc), '[]'::jsonb) from (
        select coalesce(device, 'desktop') as device, count(distinct visitor_id) as visitors from cur
        where is_view group by 1 order by 2 desc
      ) t
    ),
    'browsers', (
      select coalesce(jsonb_agg(t order by t.visitors desc), '[]'::jsonb) from (
        select coalesce(browser, 'Other') as browser, count(distinct visitor_id) as visitors from cur
        where is_view group by 1 order by 2 desc limit 8
      ) t
    ),
    'request_types', (
      select coalesce(jsonb_agg(t order by t.requests desc), '[]'::jsonb) from (
        select request_type, count(*) as requests from cur where kind = 'request' group by 1 order by 2 desc
      ) t
    ),
    'top_routes', (
      select coalesce(jsonb_agg(t order by t.requests desc), '[]'::jsonb) from (
        select method, path, count(*) as requests, count(distinct coalesce(user_id::text, visitor_id)) as callers
        from cur where kind = 'request' group by method, path order by count(*) desc limit 15
      ) t
    ),
    'login_methods', (
      select coalesce(jsonb_agg(t order by t.logins desc), '[]'::jsonb) from (
        select coalesce(message, 'password') as method, count(*) as logins from cur
        where kind = 'login' group by 1 order by 2 desc
      ) t
    ),
    'error_groups', (
      select coalesce(jsonb_agg(t order by t.last_seen desc), '[]'::jsonb) from (
        select left(coalesce(message, 'Unknown error'), 200) as message,
               coalesce(detail ->> 'source', 'server') as source,
               count(*) as occurrences,
               count(distinct coalesce(user_id::text, visitor_id)) as affected,
               max(created_at) as last_seen,
               min(created_at) as first_seen,
               (array_agg(path order by created_at desc))[1] as last_path
        from cur where kind = 'error'
        group by 1, 2 order by max(created_at) desc limit 50
      ) t
    ),
    'stored_events', (select count(*) from public.platform_events),
    'oldest_event', (select min(created_at) from public.platform_events)
  ) into v_result;

  return v_result;
end;
$$;

-- The latest events of one kind, newest first, with who they belong to.
create function public.admin_recent_events(p_kinds text[], p_limit integer default 100)
returns table (
  id          bigint,
  created_at  timestamptz,
  kind        text,
  request_type text,
  method      text,
  path        text,
  user_id     uuid,
  user_name   text,
  user_email  text,
  visitor_id  text,
  ip          text,
  country     text,
  device      text,
  browser     text,
  referrer    text,
  message     text,
  detail      jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select e.id, e.created_at, e.kind, e.request_type, e.method, e.path, e.user_id,
         p.full_name, p.email, e.visitor_id, e.ip, e.country, e.device, e.browser,
         e.referrer, e.message, e.detail
  from public.platform_events e
  left join public.profiles p on p.id = e.user_id
  where e.kind = any (p_kinds)
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Deletes events older than p_keep_days days. Returns how many were removed.
create function public.admin_prune_events(p_keep_days integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_keep_days is null or p_keep_days < 1 then
    raise exception 'Keep at least 1 day' using errcode = '22023';
  end if;
  delete from public.platform_events where created_at < now() - make_interval(days => p_keep_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- pricing

alter table public.platform_settings
  add column price_usd  numeric(10, 2) not null default 10 check (price_usd > 0 and price_usd <= 10000),
  add column trial_days integer not null default 14 check (trial_days between 0 and 365),
  add column grace_days integer not null default 3 check (grace_days between 0 and 60);

-- Public: the landing and pricing pages show it to visitors who aren't signed in.
create function public.platform_pricing()
returns table (price_usd numeric, trial_days integer, grace_days integer)
language sql stable security definer set search_path = ''
as $$
  select s.price_usd, s.trial_days, s.grace_days from public.platform_settings s where s.id
$$;

create function public.platform_trial_days()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select s.trial_days from public.platform_settings s where s.id), 14)
$$;

-- New gyms get the trial length set by the super admin.
alter table public.gyms
  alter column trial_ends_at set default ((now() at time zone 'Asia/Beirut')::date + public.platform_trial_days());

create function public.admin_save_pricing(p_price_usd numeric, p_trial_days integer, p_grace_days integer)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.platform_settings
     set price_usd = p_price_usd, trial_days = p_trial_days, grace_days = p_grace_days, updated_at = now()
   where id;
end;
$$;

-- ---------------------------------------------------------------- suspension

alter table public.gyms
  add column suspended_at     timestamptz,
  add column suspended_reason text check (char_length(suspended_reason) <= 300);
grant select (suspended_at, suspended_reason) on public.gyms to authenticated;

create function public.admin_set_gym_suspended(p_gym_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.gyms
     set suspended_at = case when p_suspended then coalesce(suspended_at, now()) end,
         suspended_reason = case when p_suspended then nullif(trim(p_reason), '') end
   where id = p_gym_id;
  if not found then
    raise exception 'Gym not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Subscription status now honours the configurable grace period and suspension.
create or replace function public.gym_subscription(p_gym_id uuid)
returns table (status text, ends_on date, days_left integer, trial_ends_at date, paid_until date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_gym   public.gyms;
  v_today date;
  v_end   date;
  v_grace integer;
begin
  if public.my_gym_role(p_gym_id) is null and not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_gym from public.gyms where id = p_gym_id;
  if not found then
    return;
  end if;
  select s.grace_days into v_grace from public.platform_settings s where s.id;
  v_grace := coalesce(v_grace, 3);
  v_today := public.gym_today(p_gym_id);
  v_end := greatest(v_gym.trial_ends_at, coalesce(v_gym.paid_until, v_gym.trial_ends_at));
  return query select
    case
      when v_gym.suspended_at is not null then 'suspended'
      when v_gym.paid_until is not null and v_gym.paid_until >= v_today then 'active'
      when v_end >= v_today then 'trial'
      when v_end + v_grace >= v_today then 'grace'
      else 'expired'
    end,
    v_end,
    (v_end - v_today)::integer,
    v_gym.trial_ends_at,
    v_gym.paid_until;
end;
$$;

-- Every payment gyms made to Gymix, newest first.
create function public.admin_platform_payments(p_limit integer default 200)
returns table (
  id          uuid,
  created_at  timestamptz,
  gym_id      uuid,
  gym_name    text,
  months      integer,
  amount_usd  numeric,
  method      text,
  note        text,
  paid_until  date,
  recorded_by_name text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select pp.id, pp.created_at, pp.gym_id, g.name, pp.months, pp.amount_usd, pp.method, pp.note,
         pp.paid_until, pr.full_name
  from public.platform_payments pp
  join public.gyms g on g.id = pp.gym_id
  left join public.profiles pr on pr.id = pp.recorded_by
  order by pp.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

-- The console's gym list gains suspension.
drop function public.admin_gym_overview();
create function public.admin_gym_overview()
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
  order by g.created_at desc;
end;
$$;

-- ---------------------------------------------------------------- grants

revoke execute on function public.admin_monitoring(integer) from public, anon;
revoke execute on function public.admin_recent_events(text[], integer) from public, anon;
revoke execute on function public.admin_prune_events(integer) from public, anon;
revoke execute on function public.admin_save_pricing(numeric, integer, integer) from public, anon;
revoke execute on function public.admin_set_gym_suspended(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_platform_payments(integer) from public, anon;
revoke execute on function public.admin_gym_overview() from public, anon;
revoke execute on function public.platform_trial_days() from public;
grant execute on function public.admin_monitoring(integer) to authenticated;
grant execute on function public.admin_recent_events(text[], integer) to authenticated;
grant execute on function public.admin_prune_events(integer) to authenticated;
grant execute on function public.admin_save_pricing(numeric, integer, integer) to authenticated;
grant execute on function public.admin_set_gym_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_platform_payments(integer) to authenticated;
grant execute on function public.admin_gym_overview() to authenticated;
grant execute on function public.platform_trial_days() to authenticated;
grant execute on function public.platform_pricing() to anon, authenticated;
