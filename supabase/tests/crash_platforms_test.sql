-- Crash reports by platform: counted per platform, super admins only.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'assertion failed: %', p_msg; end if;
end;
$$;
create or replace function pg_temp.fails(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected failure but succeeded: %', p_sql;
exception when others then
  if sqlerrm like 'expected failure%' then raise; end if;
  return sqlerrm;
end;
$$;

insert into auth.users (email, raw_user_meta_data) values ('cr-admin@test.lb', '{"full_name":"Admin Cr"}'), ('cr-user@test.lb', '{"full_name":"User Cr"}');
insert into public.platform_admins (user_id) select id from auth.users where email = 'cr-admin@test.lb';

insert into public.platform_events (kind, path, visitor_id, message, detail) values
  ('error', '/portal', 'v1', 'TypeError: x', '{"source":"browser","platform":"ios-app","app_version":"1.0 (3)"}'),
  ('error', '/portal', 'v2', 'TypeError: x', '{"source":"browser","platform":"ios-app","app_version":"1.0 (3)"}'),
  ('error', '/portal', 'v2', 'TypeError: y', '{"source":"browser","platform":"pwa"}'),
  ('error', '/portal', 'v3', 'Server boom', '{"source":"server"}');

select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'cr-admin@test.lb'), false);
set role authenticated;
select pg_temp.ok((select crashes = 2 and people = 2 and versions = array['1.0 (3)'] from public.admin_crash_platforms(7) where platform = 'ios-app'), 'ios app counted');
select pg_temp.ok((select crashes = 1 from public.admin_crash_platforms(7) where platform = 'pwa'), 'pwa counted');
select pg_temp.ok(not exists (select 1 from public.admin_crash_platforms(7) where platform = 'server'), 'server errors left out');
reset role;

select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'cr-user@test.lb'), false);
set role authenticated;
select pg_temp.ok(pg_temp.fails('select * from public.admin_crash_platforms(7)') like '%Not allowed%', 'others refused');
reset role;

select 'crash platforms: all passed' as result;
