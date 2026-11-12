-- The super admin's control room:
--   1. Website analytics: every visit (session), page view (time on page,
--      scroll depth, clicks) and click, from the site's own tracker
--      (/api/t, after the visitor accepts analytics cookies).
--   2. Customer service: tickets from gym staff, a conversation each, with
--      internal notes, status, priority and an owner on the Gymix side.
--   3. Marketing: Instagram, Facebook and TikTok accounts, their posts and
--      daily audience numbers (synced from the platforms, or added by hand).
--   4. Gym health and app numbers for the dashboards.
-- Analytics tables are written by the server only (service role); reading
-- them is for platform admins only.

-- ===================================================================== 1
create table public.site_sessions (
  id             uuid primary key,
  visitor_id     text not null check (char_length(visitor_id) <= 64),
  user_id        uuid references public.profiles (id) on delete set null,
  started_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  landing_path   text check (char_length(landing_path) <= 300),
  exit_path      text check (char_length(exit_path) <= 300),
  referrer       text check (char_length(referrer) <= 300),
  referrer_host  text check (char_length(referrer_host) <= 120),
  utm_source     text check (char_length(utm_source) <= 100),
  utm_medium     text check (char_length(utm_medium) <= 100),
  utm_campaign   text check (char_length(utm_campaign) <= 100),
  country        text check (char_length(country) <= 8),
  region         text check (char_length(region) <= 80),
  city           text check (char_length(city) <= 80),
  lat            double precision,
  lng            double precision,
  device         text check (char_length(device) <= 20),
  browser        text check (char_length(browser) <= 40),
  os             text check (char_length(os) <= 40),
  platform       text check (platform in ('web', 'pwa', 'ios-app', 'android-app')),
  app_version    text check (char_length(app_version) <= 20),
  screen         text check (char_length(screen) <= 20),
  language       text check (char_length(language) <= 20),
  timezone       text check (char_length(timezone) <= 60),
  pageviews      integer not null default 0,
  clicks         integer not null default 0,
  active_ms      bigint not null default 0,
  is_new         boolean not null default true
);
create index site_sessions_started_idx on public.site_sessions (started_at desc);
create index site_sessions_seen_idx on public.site_sessions (last_seen_at desc);
create index site_sessions_visitor_idx on public.site_sessions (visitor_id, started_at desc);

create table public.site_pageviews (
  id          uuid primary key,
  session_id  uuid not null references public.site_sessions (id) on delete cascade,
  path        text not null check (char_length(path) <= 300),
  title       text check (char_length(title) <= 200),
  entered_at  timestamptz not null default now(),
  left_at     timestamptz,
  active_ms   integer not null default 0,
  max_scroll  smallint not null default 0 check (max_scroll between 0 and 100),
  clicks      integer not null default 0
);
create index site_pageviews_session_idx on public.site_pageviews (session_id, entered_at);
create index site_pageviews_time_idx on public.site_pageviews (entered_at desc);

create table public.site_events (
  id            bigint generated always as identity primary key,
  session_id    uuid not null references public.site_sessions (id) on delete cascade,
  pageview_id   uuid references public.site_pageviews (id) on delete cascade,
  kind          text not null check (kind in ('click', 'cta', 'form', 'outbound', 'custom')),
  label         text check (char_length(label) <= 200),
  path          text check (char_length(path) <= 300),
  x             smallint,
  y             smallint,
  created_at    timestamptz not null default now()
);
create index site_events_session_idx on public.site_events (session_id, created_at);
create index site_events_time_idx on public.site_events (created_at desc);

alter table public.site_sessions enable row level security;
alter table public.site_pageviews enable row level security;
alter table public.site_events enable row level security;
revoke all on public.site_sessions, public.site_pageviews, public.site_events from anon, authenticated;

-- Keeps analytics for 180 days (run daily).
create function public.prune_site_analytics()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.site_sessions where started_at < now() - interval '180 days' returning 1)
  select count(*)::integer from gone;
$$;
revoke execute on function public.prune_site_analytics() from public, anon, authenticated;

-- Who's on the site right now (seen in the last 90 seconds).
create function public.admin_live()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  return jsonb_build_object(
    'now', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'country', s.country, 'city', s.city, 'lat', s.lat, 'lng', s.lng, 'device', s.device,
        'browser', s.browser, 'platform', s.platform, 'started_at', s.started_at, 'pageviews', s.pageviews,
        'path', (select p.path from public.site_pageviews p where p.session_id = s.id order by p.entered_at desc limit 1),
        'source', coalesce(s.utm_source, s.referrer_host), 'signed_in', s.user_id is not null,
        'who', (select coalesce(nullif(full_name, ''), email) from public.profiles where id = s.user_id)
      ) order by s.last_seen_at desc), '[]'::jsonb)
      from public.site_sessions s where s.last_seen_at > now() - interval '90 seconds'
    ),
    'today', (
      select jsonb_build_object(
        'sessions', count(*),
        'visitors', count(distinct visitor_id),
        'pageviews', coalesce(sum(pageviews), 0),
        'avg_active_s', coalesce(round(avg(active_ms) / 1000.0), 0)
      ) from public.site_sessions where started_at > date_trunc('day', now())
    ),
    'last_hour', (
      select coalesce(jsonb_agg(jsonb_build_object('minute', m, 'sessions', n) order by m), '[]'::jsonb) from (
        select date_trunc('minute', last_seen_at) as m, count(distinct id) as n
          from public.site_sessions where last_seen_at > now() - interval '60 minutes' group by 1
      ) t
    ),
    'feed', (
      select coalesce(jsonb_agg(f order by f.at desc), '[]'::jsonb) from (
        select p.entered_at as at, 'view' as kind, p.path as what, s.country, s.city, s.device
          from public.site_pageviews p join public.site_sessions s on s.id = p.session_id
         where p.entered_at > now() - interval '30 minutes'
        union all
        select e.created_at, 'cta', coalesce(e.label, e.path), s.country, s.city, s.device
          from public.site_events e join public.site_sessions s on s.id = e.session_id
         where e.kind in ('cta', 'form') and e.created_at > now() - interval '30 minutes'
        union all
        select pe.created_at, pe.kind, coalesce(pe.message, pe.path), pe.country, null, pe.device
          from public.platform_events pe
         where pe.kind in ('signup', 'login', 'error') and pe.created_at > now() - interval '30 minutes'
        order by 1 desc limit 40
      ) f
    )
  );
end;
$$;
revoke execute on function public.admin_live() from public, anon;
grant execute on function public.admin_live() to authenticated;

-- Everything about visitors over a period.
create function public.admin_visitors(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 180)));
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  return jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'sessions', count(*),
        'visitors', count(distinct visitor_id),
        'new_visitors', count(distinct visitor_id) filter (where is_new),
        'pageviews', coalesce(sum(pageviews), 0),
        'avg_active_s', coalesce(round(avg(active_ms) / 1000.0), 0),
        'median_active_s', coalesce(round((percentile_cont(0.5) within group (order by active_ms)) / 1000.0), 0),
        'bounce_rate', coalesce(round(100.0 * count(*) filter (where pageviews <= 1 and active_ms < 10000) / nullif(count(*), 0), 1), 0),
        'signed_in', count(*) filter (where user_id is not null)
      ) from public.site_sessions where started_at > v_from
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'sessions', n, 'visitors', v, 'pageviews', pv) order by d), '[]'::jsonb) from (
        select started_at::date as d, count(*) as n, count(distinct visitor_id) as v, sum(pageviews) as pv
          from public.site_sessions where started_at > v_from group by 1
      ) t
    ),
    'pages', (
      select coalesce(jsonb_agg(t order by t.views desc), '[]'::jsonb) from (
        select p.path, count(*) as views, count(distinct p.session_id) as sessions,
               round(avg(p.active_ms) / 1000.0) as avg_active_s, round(avg(p.max_scroll)) as avg_scroll,
               sum(p.clicks) as clicks
          from public.site_pageviews p where p.entered_at > v_from
         group by 1 order by 2 desc limit 40
      ) t
    ),
    'landing', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select landing_path as path, count(*) as n,
               round(100.0 * count(*) filter (where pageviews <= 1 and active_ms < 10000) / nullif(count(*), 0)) as bounce
          from public.site_sessions where started_at > v_from group by 1 order by 2 desc limit 15
      ) t
    ),
    'exits', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select exit_path as path, count(*) as n from public.site_sessions
         where started_at > v_from and exit_path is not null group by 1 order by 2 desc limit 15
      ) t
    ),
    'sources', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select coalesce(utm_source, referrer_host, 'Direct') as source, count(*) as n, count(distinct visitor_id) as visitors,
               round(avg(active_ms) / 1000.0) as avg_active_s
          from public.site_sessions where started_at > v_from group by 1 order by 2 desc limit 20
      ) t
    ),
    'campaigns', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select utm_campaign as campaign, utm_source as source, utm_medium as medium, count(*) as n
          from public.site_sessions where started_at > v_from and utm_campaign is not null group by 1, 2, 3 order by 4 desc limit 20
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select coalesce(country, '??') as country, count(*) as n, count(distinct visitor_id) as visitors
          from public.site_sessions where started_at > v_from group by 1 order by 2 desc limit 30
      ) t
    ),
    'cities', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select city, country, count(*) as n, avg(lat) as lat, avg(lng) as lng
          from public.site_sessions where started_at > v_from and city is not null group by 1, 2 order by 3 desc limit 60
      ) t
    ),
    'devices', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(device, 'unknown') k, count(*) n from public.site_sessions where started_at > v_from group by 1) t),
    'browsers', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(browser, 'unknown') k, count(*) n from public.site_sessions where started_at > v_from group by 1) t),
    'os', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(os, 'unknown') k, count(*) n from public.site_sessions where started_at > v_from group by 1) t),
    'platforms', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(platform, 'web') k, count(*) n from public.site_sessions where started_at > v_from group by 1) t),
    'languages', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(split_part(language, '-', 1), 'unknown') k, count(*) n from public.site_sessions where started_at > v_from group by 1 order by 2 desc limit 12) t),
    'screens', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select coalesce(screen, 'unknown') k, count(*) n from public.site_sessions where started_at > v_from group by 1 order by 2 desc limit 10) t),
    -- Day of week (0 = Sunday) by hour, in Beirut time.
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', h, 'n', n)), '[]'::jsonb) from (
        select extract(dow from started_at at time zone 'Asia/Beirut')::int as dow,
               extract(hour from started_at at time zone 'Asia/Beirut')::int as h, count(*) as n
          from public.site_sessions where started_at > v_from group by 1, 2
      ) t
    ),
    'clicks', (
      select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (
        select coalesce(label, '(no label)') as label, kind, path, count(*) as n
          from public.site_events where created_at > v_from group by 1, 2, 3 order by 4 desc limit 30
      ) t
    ),
    -- The road to a new gym: saw the site, saw pricing, opened sign-up, signed up.
    'funnel', (
      select jsonb_build_object(
        'visitors', (select count(distinct visitor_id) from public.site_sessions where started_at > v_from),
        'pricing', (select count(distinct s.visitor_id) from public.site_pageviews p join public.site_sessions s on s.id = p.session_id
                     where p.entered_at > v_from and (p.path = '/pricing' or p.path like '/pricing%')),
        'demo', (select count(distinct s.visitor_id) from public.site_pageviews p join public.site_sessions s on s.id = p.session_id
                  where p.entered_at > v_from and p.path like '/demo%'),
        'signup_page', (select count(distinct s.visitor_id) from public.site_pageviews p join public.site_sessions s on s.id = p.session_id
                         where p.entered_at > v_from and p.path = '/signup'),
        'signups', (select count(*) from public.platform_events where kind = 'signup' and created_at > v_from)
      )
    ),
    'returning', (
      select jsonb_build_object(
        'new', count(*) filter (where is_new),
        'returning', count(*) filter (where not is_new)
      ) from public.site_sessions where started_at > v_from
    )
  );
end;
$$;
revoke execute on function public.admin_visitors(integer) from public, anon;
grant execute on function public.admin_visitors(integer) to authenticated;

-- Recent sessions, and one session's full journey.
create function public.admin_sessions(p_limit integer default 50, p_country text default null, p_source text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  return (
    select coalesce(jsonb_agg(t order by t.started_at desc), '[]'::jsonb) from (
      select s.id, s.started_at, s.last_seen_at, s.landing_path, s.exit_path, s.country, s.city, s.device, s.browser, s.os,
             s.platform, s.pageviews, s.clicks, s.active_ms, s.is_new, coalesce(s.utm_source, s.referrer_host) as source,
             s.utm_campaign, (select coalesce(nullif(full_name, ''), email) from public.profiles where id = s.user_id) as who
        from public.site_sessions s
       where (p_country is null or s.country = p_country)
         and (p_source is null or coalesce(s.utm_source, s.referrer_host, 'Direct') = p_source)
       order by s.started_at desc
       limit greatest(1, least(p_limit, 200))
    ) t
  );
end;
$$;
revoke execute on function public.admin_sessions(integer, text, text) from public, anon;
grant execute on function public.admin_sessions(integer, text, text) to authenticated;

create function public.admin_session(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  return (
    select jsonb_build_object(
      'session', to_jsonb(s) - 'visitor_id',
      'who', (select coalesce(nullif(full_name, ''), email) from public.profiles where id = s.user_id),
      'visits_before', (select count(*) from public.site_sessions o where o.visitor_id = s.visitor_id and o.started_at < s.started_at),
      'pages', (select coalesce(jsonb_agg(to_jsonb(p) - 'session_id' order by p.entered_at), '[]'::jsonb) from public.site_pageviews p where p.session_id = s.id),
      'events', (select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'label', e.label, 'path', e.path, 'at', e.created_at) order by e.created_at), '[]'::jsonb) from public.site_events e where e.session_id = s.id)
    )
    from public.site_sessions s where s.id = p_id
  );
end;
$$;
revoke execute on function public.admin_session(uuid) from public, anon;
grant execute on function public.admin_session(uuid) to authenticated;

-- ===================================================================== 2
create table public.support_tickets (
  id               uuid primary key default gen_random_uuid(),
  number           integer generated always as identity,
  gym_id           uuid references public.gyms (id) on delete set null,
  user_id          uuid references public.profiles (id) on delete set null,
  subject          text not null check (char_length(trim(subject)) between 2 and 140),
  status           text not null default 'open' check (status in ('open', 'pending', 'solved')),
  priority         text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  category         text check (category in ('question', 'bug', 'billing', 'feature', 'hardware', 'other')),
  assigned_to      uuid references public.profiles (id) on delete set null,
  path             text check (char_length(path) <= 300),
  device           text check (char_length(device) <= 200),
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  first_reply_at   timestamptz,
  solved_at        timestamptz,
  admin_unread     boolean not null default true,
  user_unread      boolean not null default false
);
create index support_tickets_status_idx on public.support_tickets (status, last_message_at desc);
create index support_tickets_user_idx on public.support_tickets (user_id, last_message_at desc);

create table public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  from_gymix  boolean not null default false,
  internal    boolean not null default false,
  body        text not null check (char_length(trim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
create policy support_tickets_select on public.support_tickets for select
  using (user_id = auth.uid() or public.is_platform_admin());
create policy support_messages_select on public.support_messages for select
  using (public.is_platform_admin() or (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())));
grant select on public.support_tickets, public.support_messages to authenticated;

-- Gym staff (or anyone signed in) opens a ticket.
create function public.open_support_ticket(p_subject text, p_body text, p_category text default 'question', p_gym_id uuid default null, p_path text default null, p_device text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Log in first';
  end if;
  if (select count(*) from public.support_tickets where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You''ve opened 5 requests in the last hour. Add to an open one instead.';
  end if;
  if p_gym_id is not null and public.my_gym_role(p_gym_id) is null then
    p_gym_id := null;
  end if;
  insert into public.support_tickets (gym_id, user_id, subject, category, path, device)
  values (p_gym_id, auth.uid(), trim(p_subject), coalesce(p_category, 'question'), left(p_path, 300), left(p_device, 200))
  returning id into v_id;
  insert into public.support_messages (ticket_id, author_id, body) values (v_id, auth.uid(), trim(p_body));
  return v_id;
end;
$$;
revoke execute on function public.open_support_ticket(text, text, text, uuid, text, text) from public, anon;
grant execute on function public.open_support_ticket(text, text, text, uuid, text, text) to authenticated;

-- A message on a ticket: from the person who opened it, or from Gymix
-- (platform admins; `p_internal` = a note only Gymix sees).
create function public.reply_support_ticket(p_ticket_id uuid, p_body text, p_internal boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.support_tickets%rowtype;
  v_admin boolean := public.is_platform_admin();
begin
  select * into v_t from public.support_tickets where id = p_ticket_id;
  if v_t.id is null or (not v_admin and v_t.user_id is distinct from auth.uid()) then
    raise exception 'Not allowed';
  end if;
  insert into public.support_messages (ticket_id, author_id, from_gymix, internal, body)
  values (p_ticket_id, auth.uid(), v_admin and v_t.user_id is distinct from auth.uid(), v_admin and p_internal, trim(p_body));
  if v_admin and v_t.user_id is distinct from auth.uid() then
    if not p_internal then
      update public.support_tickets
         set last_message_at = now(), user_unread = true, admin_unread = false,
             first_reply_at = coalesce(first_reply_at, now()),
             status = case when status = 'solved' then 'solved' else 'pending' end
       where id = p_ticket_id;
      -- Tell them, where they have a gym to attach the notification to.
      if v_t.user_id is not null and v_t.gym_id is not null then
        perform public.notify(v_t.gym_id, v_t.user_id, 'support', 'Gymix support replied', left(trim(p_body), 200), '/dashboard?support=' || p_ticket_id);
      end if;
    end if;
  else
    update public.support_tickets
       set last_message_at = now(), admin_unread = true, user_unread = false,
           status = 'open', solved_at = null
     where id = p_ticket_id;
  end if;
end;
$$;
revoke execute on function public.reply_support_ticket(uuid, text, boolean) from public, anon;
grant execute on function public.reply_support_ticket(uuid, text, boolean) to authenticated;

-- The person who opened it marks it read.
create function public.read_support_ticket(p_ticket_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.support_tickets set user_unread = false where id = p_ticket_id and user_id = auth.uid();
  update public.support_tickets set admin_unread = false where id = p_ticket_id and public.is_platform_admin();
$$;
revoke execute on function public.read_support_ticket(uuid) from public, anon;
grant execute on function public.read_support_ticket(uuid) to authenticated;

-- Platform admins: status, priority, owner.
create function public.admin_update_ticket(p_ticket_id uuid, p_status text default null, p_priority text default null, p_assign uuid default null, p_unassign boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  update public.support_tickets
     set status = coalesce(p_status, status),
         solved_at = case when p_status = 'solved' then now() when p_status is not null then null else solved_at end,
         priority = coalesce(p_priority, priority),
         assigned_to = case when p_unassign then null else coalesce(p_assign, assigned_to) end
   where id = p_ticket_id;
end;
$$;
revoke execute on function public.admin_update_ticket(uuid, text, text, uuid, boolean) from public, anon;
grant execute on function public.admin_update_ticket(uuid, text, text, uuid, boolean) to authenticated;

-- ===================================================================== 3
create table public.social_accounts (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null check (platform in ('instagram', 'facebook', 'tiktok')),
  handle           text not null check (char_length(trim(handle)) between 1 and 80),
  external_id      text check (char_length(external_id) <= 100),
  followers        integer,
  following        integer,
  posts_count      integer,
  audience         jsonb not null default '{}'::jsonb,
  connected        boolean not null default false,
  last_synced_at   timestamptz,
  sync_error       text check (char_length(sync_error) <= 500),
  created_at       timestamptz not null default now(),
  unique (platform, handle)
);
-- Access tokens live apart, readable by the server only.
create table public.social_tokens (
  account_id   uuid primary key references public.social_accounts (id) on delete cascade,
  token        text not null,
  expires_at   timestamptz,
  updated_at   timestamptz not null default now()
);
create table public.social_posts (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.social_accounts (id) on delete cascade,
  external_id     text check (char_length(external_id) <= 100),
  posted_at       timestamptz not null default now(),
  kind            text check (kind in ('post', 'reel', 'video', 'story', 'carousel')),
  caption         text check (char_length(caption) <= 2200),
  permalink       text check (char_length(permalink) <= 500),
  thumbnail_url   text check (char_length(thumbnail_url) <= 1000),
  views           integer not null default 0,
  reach           integer not null default 0,
  likes           integer not null default 0,
  comments        integer not null default 0,
  shares          integer not null default 0,
  saves           integer not null default 0,
  link_clicks     integer not null default 0,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (account_id, external_id)
);
create index social_posts_time_idx on public.social_posts (posted_at desc);
create table public.social_daily (
  account_id     uuid not null references public.social_accounts (id) on delete cascade,
  day            date not null,
  followers      integer,
  reach          integer,
  impressions    integer,
  profile_views  integer,
  primary key (account_id, day)
);

alter table public.social_accounts enable row level security;
alter table public.social_tokens enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_daily enable row level security;
create policy social_accounts_admin on public.social_accounts for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy social_posts_admin on public.social_posts for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy social_daily_admin on public.social_daily for all using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.social_accounts, public.social_posts, public.social_daily to authenticated;
revoke all on public.social_tokens from anon, authenticated;

-- ===================================================================== 4
-- Each gym's health, 0 to 100: is it used (check-ins this week vs last),
-- is it paying, are its people logging in, is anything going wrong.
create function public.admin_gym_health()
returns table (
  gym_id uuid, name text, is_lab boolean, created_at timestamptz, trial_ends_at date, paid_until date, suspended boolean,
  members integer, active_members integer, checkins_7d integer, checkins_prev_7d integer, collected_30d numeric,
  staff integer, last_staff_seen timestamptz, errors_7d integer, open_tickets integer, score integer, lat double precision, lng double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  return query
  with base as (
    select g.id, g.name, g.is_lab, g.created_at, g.trial_ends_at, g.paid_until, g.suspended_at is not null as suspended, g.door_lat, g.door_lng,
      (select count(*) from public.members m where m.gym_id = g.id and m.archived_at is null)::int as members,
      (select count(distinct ms.member_id) from public.memberships ms where ms.gym_id = g.id and ms.cancelled_at is null
          and ms.starts_on <= current_date and ms.ends_on >= current_date)::int as active_members,
      (select count(*) from public.checkins c where c.gym_id = g.id and c.allowed and c.checked_in_at > now() - interval '7 days')::int as c7,
      (select count(*) from public.checkins c where c.gym_id = g.id and c.allowed and c.checked_in_at between now() - interval '14 days' and now() - interval '7 days')::int as cp7,
      (select coalesce(sum(p.amount_usd), 0) from public.payments p where p.gym_id = g.id and p.paid_at > now() - interval '30 days') as collected,
      (select count(*) from public.gym_users gu where gu.gym_id = g.id and gu.role <> 'member')::int as staff,
      (select max(e.created_at) from public.platform_events e where e.user_id in (select gu.user_id from public.gym_users gu where gu.gym_id = g.id and gu.role <> 'member')
          and e.created_at > now() - interval '30 days') as staff_seen,
      (select count(*) from public.platform_events e where e.kind = 'error' and e.created_at > now() - interval '7 days'
          and e.user_id in (select gu.user_id from public.gym_users gu where gu.gym_id = g.id))::int as errors,
      (select count(*) from public.support_tickets t where t.gym_id = g.id and t.status <> 'solved')::int as tickets
    from public.gyms g
  )
  select b.id, b.name, b.is_lab, b.created_at, b.trial_ends_at, b.paid_until, b.suspended,
         b.members, b.active_members, b.c7, b.cp7, b.collected, b.staff, b.staff_seen, b.errors, b.tickets,
         greatest(0, least(100,
           (case when b.c7 >= 50 then 35 when b.c7 >= 10 then 25 when b.c7 > 0 then 12 else 0 end)
         + (case when b.cp7 = 0 then (case when b.c7 > 0 then 10 else 0 end) when b.c7 >= b.cp7 then 10 else greatest(0, 10 - (b.cp7 - b.c7) * 10 / b.cp7) end)
         + (case when b.suspended then 0 when b.paid_until >= current_date then 25 when b.trial_ends_at >= current_date then 15 else 0 end)
         + (case when b.staff_seen > now() - interval '2 days' then 20 when b.staff_seen > now() - interval '7 days' then 12 when b.staff_seen is not null then 5 else 0 end)
         + (case when b.active_members >= 50 then 10 when b.active_members >= 10 then 6 when b.active_members > 0 then 3 else 0 end)
         - least(10, b.errors) - b.tickets * 3
         ))::int,
         b.door_lat, b.door_lng
    from base b
   order by b.is_lab, b.name;
end;
$$;
revoke execute on function public.admin_gym_health() from public, anon;
grant execute on function public.admin_gym_health() to authenticated;

-- The phone apps: push, widget, platforms.
create function public.admin_app_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  return jsonb_build_object(
    'push', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) n from public.push_subscriptions group by 1) t),
    'push_healthy', (select count(*) from public.push_subscriptions where last_ok_at > now() - interval '30 days'),
    'pushes_24h', (select count(*) from public.notifications where push_sent_at > now() - interval '24 hours'),
    'notifications_24h', (select count(*) from public.notifications where created_at > now() - interval '24 hours'),
    'widgets', (select count(*) from public.widget_tokens where last_used_at > now() - interval '7 days'),
    'platforms_30d', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
      select coalesce(platform, 'web') k, count(distinct visitor_id) n from public.site_sessions where started_at > now() - interval '30 days' group by 1) t),
    'versions_30d', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
      select platform || ' ' || app_version k, count(distinct visitor_id) n from public.site_sessions
       where started_at > now() - interval '30 days' and app_version is not null group by 1 order by 2 desc limit 10) t)
  );
end;
$$;
revoke execute on function public.admin_app_stats() from public, anon;
grant execute on function public.admin_app_stats() to authenticated;

-- ===================================================================== 5
-- The tracker's one entry point (/api/t, server only). p is one hit:
--   {t:'view', sid, vid, pv, path, title, ref, ref_host, utm_*, uid, geo + device fields}
--   {t:'ping', sid, pv, active_ms, scroll, clicks}
--   {t:'event', sid, pv, kind, label, path}
create function public.site_track(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid uuid := (p ->> 'sid')::uuid;
  v_pv uuid := nullif(p ->> 'pv', '')::uuid;
begin
  if p ->> 't' = 'view' then
    insert into public.site_sessions (id, visitor_id, user_id, landing_path, exit_path, referrer, referrer_host, utm_source, utm_medium, utm_campaign,
                                      country, region, city, lat, lng, device, browser, os, platform, app_version, screen, language, timezone, is_new)
    values (v_sid, left(p ->> 'vid', 64), nullif(p ->> 'uid', '')::uuid, left(p ->> 'path', 300), left(p ->> 'path', 300),
            left(p ->> 'ref', 300), left(p ->> 'ref_host', 120), left(p ->> 'utm_source', 100), left(p ->> 'utm_medium', 100), left(p ->> 'utm_campaign', 100),
            left(p ->> 'country', 8), left(p ->> 'region', 80), left(p ->> 'city', 80), (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
            left(p ->> 'device', 20), left(p ->> 'browser', 40), left(p ->> 'os', 40),
            case when p ->> 'platform' in ('web', 'pwa', 'ios-app', 'android-app') then p ->> 'platform' else 'web' end,
            left(p ->> 'app_version', 20), left(p ->> 'screen', 20), left(p ->> 'lang', 20), left(p ->> 'tz', 60),
            not exists (select 1 from public.site_sessions o where o.visitor_id = left(p ->> 'vid', 64)))
    on conflict (id) do update
      set last_seen_at = now(), exit_path = excluded.exit_path,
          user_id = coalesce(public.site_sessions.user_id, excluded.user_id);
    if v_pv is not null then
      insert into public.site_pageviews (id, session_id, path, title) values (v_pv, v_sid, left(p ->> 'path', 300), left(p ->> 'title', 200))
      on conflict (id) do nothing;
      if found then
        update public.site_sessions set pageviews = pageviews + 1 where id = v_sid;
      end if;
    end if;
  elsif p ->> 't' = 'ping' then
    update public.site_pageviews
       set active_ms = greatest(active_ms, least(coalesce((p ->> 'active_ms')::int, 0), 6 * 3600 * 1000)),
           max_scroll = greatest(max_scroll, least(100, greatest(0, coalesce((p ->> 'scroll')::int, 0)))),
           clicks = greatest(clicks, coalesce((p ->> 'clicks')::int, 0)),
           left_at = now()
     where id = v_pv and session_id = v_sid;
    update public.site_sessions s
       set last_seen_at = now(),
           active_ms = (select coalesce(sum(active_ms), 0) from public.site_pageviews where session_id = v_sid),
           clicks = (select coalesce(sum(clicks), 0) from public.site_pageviews where session_id = v_sid)
     where s.id = v_sid;
  elsif p ->> 't' = 'event' then
    if exists (select 1 from public.site_sessions where id = v_sid) then
      insert into public.site_events (session_id, pageview_id, kind, label, path)
      values (v_sid, v_pv, case when p ->> 'kind' in ('click', 'cta', 'form', 'outbound', 'custom') then p ->> 'kind' else 'custom' end,
              left(p ->> 'label', 200), left(p ->> 'path', 300));
      update public.site_sessions set last_seen_at = now() where id = v_sid;
    end if;
  end if;
end;
$$;
revoke execute on function public.site_track(jsonb) from public, anon, authenticated;
