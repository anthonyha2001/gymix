-- WhatsApp per gym: choosing the sender, secrets kept from users, the log and
-- Meta's delivery updates (forward only, failure wins).
\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
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

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'assertion failed: %', p_msg; end if;
end;
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('ow@test.lb', '{"full_name":"Owner W"}'),
  ('mw@test.lb', '{"full_name":"Manager W"}'),
  ('ow2@test.lb', '{"full_name":"Other Owner"}');

select pg_temp.act_as('ow@test.lb');
select public.create_gym('WA Gym') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 'mw@test.lb', 'manager', auth.uid());
insert into public.members (gym_id, full_name, phone, created_by) values (:'gym', 'Lea Haddad', '71 123 456', auth.uid());
reset role;
select pg_temp.act_as('mw@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('ow2@test.lb'); select public.create_gym('Other Gym') as gym2 \gset
reset role;
select id as lea from public.members where full_name = 'Lea Haddad' \gset

-- Default sender is the Gymix number.
select pg_temp.ok((select whatsapp_sender from public.gyms where id = :'gym') = 'gymix', 'default sender gymix');

-- "own" needs a connected account; only the owner may switch.
select pg_temp.act_as('ow@test.lb');
select pg_temp.ok(pg_temp.fails(format($q$select public.set_whatsapp_sender(%L, 'own')$q$, :'gym')) like '%Connect%', 'own needs an account');
reset role;
insert into public.gym_whatsapp_accounts (gym_id, phone_number_id, waba_id, token, app_secret)
values (:'gym', '109876543210987', '102345678901234', 'EAAG-secret-token', '0123456789abcdef0123456789abcdef');
select pg_temp.ok(length((select webhook_token from public.gym_whatsapp_accounts where gym_id = :'gym')) = 32, 'webhook token generated');

select pg_temp.act_as('mw@test.lb');
select pg_temp.ok(pg_temp.fails(format($q$select public.set_whatsapp_sender(%L, 'own')$q$, :'gym')) like '%owner%', 'manager cannot switch');
reset role;
select pg_temp.act_as('ow2@test.lb');
select pg_temp.ok(pg_temp.fails(format($q$select public.set_whatsapp_sender(%L, 'own')$q$, :'gym')) like '%owner%', 'other gym owner cannot switch');
reset role;
select pg_temp.act_as('ow@test.lb');
select public.set_whatsapp_sender(:'gym', 'own');
select pg_temp.ok(pg_temp.fails(format($q$select public.set_whatsapp_sender(%L, 'bogus')$q$, :'gym')) like '%Unknown%', 'unknown sender refused');
reset role;
select pg_temp.ok((select whatsapp_sender from public.gyms where id = :'gym') = 'own', 'owner switched to own');

-- The token and app secret are never readable by users, even the owner.
select pg_temp.act_as('ow@test.lb');
select pg_temp.ok(pg_temp.fails('select token from public.gym_whatsapp_accounts') like '%permission%', 'owner cannot read token');
select pg_temp.ok(pg_temp.fails('select whatsapp_token from public.platform_secrets') like '%permission%', 'owner cannot read platform token');
reset role;

-- The log: new kinds and statuses.
insert into public.whatsapp_log (gym_id, member_id, kind, ref, body, phone, sender, status, wa_message_id)
values
  (:'gym', :'lea', 'invite', 'r1', 'Hi Lea', '+96171123456', 'own', 'sent', 'wamid.A'),
  (:'gym', :'lea', 'login', 'r2', 'Hi Lea', '+96171123456', 'gymix', 'sent', 'wamid.B'),
  (:'gym2', null, 'payment', 'r3', 'Hi', '+96170000000', 'gymix', 'sent', 'wamid.C');
select pg_temp.ok(pg_temp.fails($q$insert into public.whatsapp_log (gym_id, kind, ref) values ('$q$ || :'gym' || $q$', 'spam', 'x')$q$) like '%kind_check%', 'unknown kind refused');

-- Owner and manager read their own gym's log only.
select pg_temp.act_as('ow@test.lb');
select pg_temp.ok((select count(*) from public.whatsapp_log) = 2, 'owner sees own log only');
reset role;
select pg_temp.act_as('mw@test.lb');
select pg_temp.ok((select count(*) from public.whatsapp_log) = 2, 'manager sees log');
select pg_temp.ok(pg_temp.fails($q$select public.whatsapp_status_update('wamid.A', 'read')$q$) like '%permission%', 'users cannot post statuses');
reset role;

-- Delivery updates move forward only; out-of-order "delivered" after "read" is ignored.
select pg_temp.ok(public.whatsapp_status_update('wamid.A', 'delivered'), 'delivered applied');
select pg_temp.ok(public.whatsapp_status_update('wamid.A', 'read'), 'read applied');
select pg_temp.ok(not public.whatsapp_status_update('wamid.A', 'delivered'), 'late delivered ignored');
select pg_temp.ok((select status from public.whatsapp_log where wa_message_id = 'wamid.A') = 'read', 'still read');
-- Failure wins and keeps Meta's reason; nothing moves after it.
select pg_temp.ok(public.whatsapp_status_update('wamid.B', 'failed', 'Number not on WhatsApp'), 'failed applied');
select pg_temp.ok(not public.whatsapp_status_update('wamid.B', 'read'), 'nothing after failed');
select pg_temp.ok((select status || '|' || error from public.whatsapp_log where wa_message_id = 'wamid.B') = 'failed|Number not on WhatsApp', 'failure reason kept');
select pg_temp.ok(not public.whatsapp_status_update('wamid.nope', 'read'), 'unknown message ignored');
select pg_temp.ok(not public.whatsapp_status_update('wamid.C', 'bogus'), 'unknown status ignored');

-- Disconnecting deletes the account with the gym's secrets.
delete from public.gyms where id = :'gym2';
select pg_temp.ok((select count(*) from public.whatsapp_log where ref = 'r3') = 0, 'log removed with its gym');

\echo 'whatsapp_test passed'
