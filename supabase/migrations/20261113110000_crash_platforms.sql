-- Crash reports: where browser/app crashes happen (iPhone app, Android app,
-- installed web app, browser), and on which app versions. Super admins only.
create function public.admin_crash_platforms(p_days integer default 7)
returns table (platform text, crashes bigint, people bigint, versions text[])
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
    select coalesce(e.detail ->> 'platform', 'browser') as platform,
           count(*) as crashes,
           count(distinct coalesce(e.user_id::text, e.visitor_id)) as people,
           (array_agg(distinct e.detail ->> 'app_version') filter (where e.detail ->> 'app_version' is not null))[1:5] as versions
    from public.platform_events e
    where e.kind = 'error'
      and e.detail ->> 'source' = 'browser'
      and e.created_at > now() - make_interval(days => greatest(1, least(p_days, 90)))
    group by 1
    order by 2 desc;
end;
$$;
revoke execute on function public.admin_crash_platforms(integer) from public, anon;
grant execute on function public.admin_crash_platforms(integer) to authenticated;
