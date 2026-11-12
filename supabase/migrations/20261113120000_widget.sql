-- The home-screen widget (Android / iPhone). A widget runs outside the app and
-- can't use the app's login, so each person gets a long random widget token
-- that the app hands to the widget. The token only reads a small summary of
-- that person's own day; it can't change anything, and making a new one (or
-- deleting the account) cuts the old one off.

create table public.widget_tokens (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  token       text not null unique,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.widget_tokens enable row level security;
-- No policies: only the functions below touch it.

-- The signed-in person's widget token (made on first use; `p_new` replaces it).
create function public.my_widget_token(p_new boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Log in first';
  end if;
  if not p_new then
    select token into v_token from public.widget_tokens where user_id = auth.uid();
    if v_token is not null then
      return v_token;
    end if;
  end if;
  v_token := 'gw_' || md5(random()::text || clock_timestamp()::text || auth.uid()::text) || md5(clock_timestamp()::text || random()::text);
  insert into public.widget_tokens (user_id, token) values (auth.uid(), v_token)
  on conflict (user_id) do update set token = excluded.token, created_at = now(), last_used_at = null;
  return v_token;
end;
$$;
revoke execute on function public.my_widget_token(boolean) from public, anon;
grant execute on function public.my_widget_token(boolean) to authenticated;

-- What the widget shows, for a token: the gym, how busy it is now, days left
-- on the membership, today's planned workout, and visits this month.
-- Called by the server only (service role), never by the widget directly.
create function public.widget_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_member public.members%rowtype;
  v_today date;
  v_gym record;
  v_occ record;
  v_ends date;
  v_day text;
  v_planned boolean;
  v_visits integer;
begin
  update public.widget_tokens set last_used_at = now()
   where token = p_token and length(p_token) > 20
  returning user_id into v_user;
  if v_user is null then
    return null;
  end if;

  select m.* into v_member from public.members m
   where m.user_id = v_user and m.archived_at is null
   order by m.created_at limit 1;
  if v_member.id is null then
    return jsonb_build_object('signed_in', true, 'member', false);
  end if;

  select g.id, g.name, g.timezone into v_gym from public.gyms g where g.id = v_member.gym_id;
  v_today := (now() at time zone v_gym.timezone)::date;
  select * into v_occ from public.gym_occupancy(v_gym.id);

  select max(ms.ends_on) into v_ends from public.memberships ms
   where ms.member_id = v_member.id and ms.cancelled_at is null and ms.starts_on <= v_today;

  select true, pd.name into v_planned, v_day
    from public.member_training_days td
    left join public.program_days pd on pd.id = td.program_day_id
   where td.member_id = v_member.id and td.weekday = extract(dow from v_today);

  select count(distinct (c.checked_in_at at time zone v_gym.timezone)::date) into v_visits
    from public.checkins c
   where c.member_id = v_member.id and c.allowed
     and c.checked_in_at >= (date_trunc('month', v_today::timestamp) at time zone v_gym.timezone);

  return jsonb_build_object(
    'signed_in', true,
    'member', true,
    'gym', v_gym.name,
    'inside', coalesce(v_occ.people, 0),
    'level', coalesce(v_occ.level, 'unknown'),
    'days_left', case when v_ends is null then null else greatest(0, v_ends - v_today) end,
    'today', case when coalesce(v_planned, false) then coalesce(v_day, 'Training day') else null end,
    'visits_month', v_visits,
    'updated_at', now()
  );
end;
$$;
revoke execute on function public.widget_data(text) from public, anon, authenticated;
