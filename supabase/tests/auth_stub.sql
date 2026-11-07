-- Minimal stand-in for the parts of Supabase a plain Postgres image lacks
-- (auth schema, auth.uid(), roles, default grants), so migrations and
-- rls_test.sql can run in a throwaway container. Never run this against a
-- real Supabase database.
create schema if not exists auth;
create schema if not exists extensions;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'
);

-- Real Supabase reads the caller's id from the request JWT; tests set it with
-- set_config('request.jwt.claim.sub', ...), which is what auth.uid() reads too.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create role anon;
create role authenticated;
create role service_role bypassrls;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
