-- Gymix Self-Service Reception: a tablet at the entrance (/kiosk/<token>).
--   * Check in with a phone number, member code or the member's QR code.
--   * Join: a visitor registers (name, phone, email).
--   * Buy or renew a membership: the kiosk creates a payment request with a
--     short reference. It is paid at the desk, by Whish or OMT to the gym's
--     account, on the card terminal, or online through a payment provider.
--   * Once the payment is verified (the front desk confirms it, or a payment
--     provider's signed webhook does), the membership is created and paid
--     automatically: activate_payment_intent().

alter table public.gyms
  add column kiosk_whish_number text check (char_length(kiosk_whish_number) <= 30),
  add column kiosk_omt_name     text check (char_length(kiosk_omt_name) <= 80),
  add column kiosk_card_terminal boolean not null default false;
grant select (kiosk_whish_number, kiosk_omt_name, kiosk_card_terminal) on public.gyms to authenticated;
grant update (kiosk_whish_number, kiosk_omt_name, kiosk_card_terminal) on public.gyms to authenticated;

create table public.kiosks (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 60),
  token          text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  allow_checkin  boolean not null default true,
  allow_join     boolean not null default true,
  allow_buy      boolean not null default true,
  is_active      boolean not null default true,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index kiosks_gym_idx on public.kiosks (gym_id);

create table public.payment_intents (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  kiosk_id       uuid references public.kiosks (id) on delete set null,
  member_id      uuid not null references public.members (id) on delete cascade,
  plan_id        uuid not null references public.membership_plans (id) on delete cascade,
  amount_usd     numeric(10, 2) not null check (amount_usd >= 0),
  -- How the person said they'd pay.
  channel        text not null check (channel in ('desk', 'whish', 'omt', 'card_terminal', 'online')),
  -- Shown on the kiosk and quoted when paying: "GX-4821".
  reference      text not null,
  status         text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'expired')),
  provider_ref   text check (char_length(provider_ref) <= 120),
  invoice_id     uuid references public.invoices (id) on delete set null,
  confirmed_by   uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '2 days',
  paid_at        timestamptz,
  unique (gym_id, reference)
);
create index payment_intents_gym_status_idx on public.payment_intents (gym_id, status, created_at desc);

-- Kiosk requests, to slow down anyone trying numbers at random.
create table public.kiosk_lookups (
  id        bigint generated always as identity primary key,
  kiosk_id  uuid not null references public.kiosks (id) on delete cascade,
  at        timestamptz not null default now()
);
create index kiosk_lookups_kiosk_at_idx on public.kiosk_lookups (kiosk_id, at desc);

alter table public.kiosks enable row level security;
alter table public.payment_intents enable row level security;
alter table public.kiosk_lookups enable row level security;
create policy kiosks_select on public.kiosks for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy kiosks_write on public.kiosks for all to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
revoke insert, update on public.kiosks from authenticated;
grant insert (gym_id, name, allow_checkin, allow_join, allow_buy, is_active) on public.kiosks to authenticated;
grant update (name, allow_checkin, allow_join, allow_buy, is_active) on public.kiosks to authenticated;
create policy payment_intents_select on public.payment_intents for select to authenticated
  using (public.can_handle_billing(gym_id));
revoke insert, update, delete on public.payment_intents from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Kiosk side (called by the server with the kiosk's token)
-- ---------------------------------------------------------------------------

-- The kiosk, or an error. Counts the request; refuses more than 40 a minute.
create function public.kiosk_for(p_token text, p_count boolean default true)
returns public.kiosks
language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosk public.kiosks;
begin
  select * into v_kiosk from public.kiosks where token = p_token;
  if not found or not v_kiosk.is_active then
    raise exception 'This kiosk is switched off or was removed.' using errcode = 'P0002';
  end if;
  if p_count then
    if (select count(*) from public.kiosk_lookups where kiosk_id = v_kiosk.id and at > now() - interval '1 minute') >= 40 then
      raise exception 'Too many tries. Please wait a minute.' using errcode = '22023';
    end if;
    insert into public.kiosk_lookups (kiosk_id) values (v_kiosk.id);
    delete from public.kiosk_lookups where kiosk_id = v_kiosk.id and at < now() - interval '1 hour';
  end if;
  update public.kiosks set last_seen_at = now() where id = v_kiosk.id;
  return v_kiosk;
end;
$$;

create function public.kiosk_info(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosk public.kiosks;
  v_gym   public.gyms;
begin
  v_kiosk := public.kiosk_for(p_token, false);
  select * into v_gym from public.gyms where id = v_kiosk.gym_id;
  return jsonb_build_object(
    'kiosk', jsonb_build_object('name', v_kiosk.name, 'checkin', v_kiosk.allow_checkin, 'join', v_kiosk.allow_join, 'buy', v_kiosk.allow_buy),
    'gym', jsonb_build_object('name', v_gym.name, 'lbp_rate', v_gym.lbp_rate),
    'pay', jsonb_build_object('whish', v_gym.kiosk_whish_number, 'omt', v_gym.kiosk_omt_name, 'card_terminal', v_gym.kiosk_card_terminal),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'price', p.price_usd,
                                                           'period', p.period, 'count', p.period_count, 'visits', p.visit_limit) order by p.price_usd)
                         from public.membership_plans p where p.gym_id = v_gym.id and p.is_active), '[]')
  );
end;
$$;

-- Finds a member by phone number or member code. Returns only what the kiosk
-- needs: first name and membership state.
create function public.kiosk_find_member(p_token text, p_query text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosk public.kiosks;
  v_q     text := trim(coalesce(p_query, ''));
  v_id    uuid;
  v_count integer;
  v_m     record;
begin
  v_kiosk := public.kiosk_for(p_token);
  if v_q ~* '^[0-9A-F]{10}$' then
    select id into v_id from public.members where gym_id = v_kiosk.gym_id and checkin_code = upper(v_q) and archived_at is null;
  elsif public.normalize_phone(v_q) is not null and length(public.normalize_phone(v_q)) >= 7 then
    select count(*), min(id::text)::uuid into v_count, v_id from public.members
     where gym_id = v_kiosk.gym_id and archived_at is null and public.normalize_phone(phone) = public.normalize_phone(v_q);
    if v_count > 1 then v_id := null; end if;
  end if;
  if v_id is null then return null; end if;
  select o.id, o.full_name, o.status, o.plan_name, o.ends_on into v_m from public.member_overview o where o.id = v_id;
  return jsonb_build_object('id', v_m.id, 'first_name', split_part(trim(v_m.full_name), ' ', 1),
                            'status', v_m.status, 'plan', v_m.plan_name, 'ends_on', v_m.ends_on);
end;
$$;

create function public.kiosk_check_in(p_token text, p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosk public.kiosks;
  v_res   record;
begin
  v_kiosk := public.kiosk_for(p_token);
  if not v_kiosk.allow_checkin then raise exception 'Check-in isn''t available on this kiosk.' using errcode = '22023'; end if;
  if not exists (select 1 from public.members where id = p_member_id and gym_id = v_kiosk.gym_id) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  select * into v_res from public.record_check_in(v_kiosk.gym_id, p_member_id, 'kiosk');
  return jsonb_build_object('allowed', v_res.allowed, 'already_in', v_res.already_in, 'reason', v_res.reason,
                            'first_name', split_part(trim(v_res.full_name), ' ', 1), 'plan', v_res.plan_name,
                            'ends_on', v_res.ends_on, 'visits_left', v_res.visits_left);
end;
$$;

-- A visitor registers. An existing member with the same phone is reused.
create function public.kiosk_join(p_token text, p_full_name text, p_phone text, p_email text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosk public.kiosks;
  v_name  text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id    uuid;
begin
  v_kiosk := public.kiosk_for(p_token);
  if not v_kiosk.allow_join then raise exception 'Joining isn''t available on this kiosk.' using errcode = '22023'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Please enter your full name.' using errcode = '22023';
  end if;
  if public.normalize_phone(p_phone) is null or length(public.normalize_phone(p_phone)) < 7 then
    raise exception 'Please enter your phone number.' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email doesn''t look right.' using errcode = '22023';
  end if;
  select id into v_id from public.members
   where gym_id = v_kiosk.gym_id and public.normalize_phone(phone) = public.normalize_phone(p_phone) and archived_at is null
   limit 1;
  if v_id is null then
    if v_email is not null and exists (select 1 from public.members where gym_id = v_kiosk.gym_id and email = v_email) then
      v_email := null;  -- already used by another member: keep the phone, drop the email
    end if;
    insert into public.members (gym_id, full_name, phone, email, notes)
    values (v_kiosk.gym_id, v_name, trim(p_phone), v_email, 'Joined at the kiosk (' || v_kiosk.name || ')')
    returning id into v_id;
    perform public.notify_roles(v_kiosk.gym_id, array['owner', 'manager', 'front_desk']::public.gym_role[], 'kiosk',
                                'New visitor: ' || v_name, 'Joined at the ' || v_kiosk.name || ' kiosk.', '/dashboard/members/' || v_id);
  end if;
  return jsonb_build_object('id', v_id, 'first_name', split_part(v_name, ' ', 1));
end;
$$;

-- A purchase or renewal, waiting for payment. Returns its reference.
create function public.kiosk_start_purchase(p_token text, p_member_id uuid, p_plan_id uuid, p_channel text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosk  public.kiosks;
  v_plan   public.membership_plans;
  v_gym    public.gyms;
  v_ref    text;
  v_intent public.payment_intents;
begin
  v_kiosk := public.kiosk_for(p_token);
  if not v_kiosk.allow_buy then raise exception 'Buying isn''t available on this kiosk.' using errcode = '22023'; end if;
  select * into v_gym from public.gyms where id = v_kiosk.gym_id;
  if not exists (select 1 from public.members where id = p_member_id and gym_id = v_gym.id) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  select * into v_plan from public.membership_plans where id = p_plan_id and gym_id = v_gym.id and is_active;
  if not found then raise exception 'Plan not found' using errcode = 'P0002'; end if;
  if p_channel not in ('desk', 'whish', 'omt', 'card_terminal', 'online')
     or (p_channel = 'whish' and v_gym.kiosk_whish_number is null)
     or (p_channel = 'omt' and v_gym.kiosk_omt_name is null)
     or (p_channel = 'card_terminal' and not v_gym.kiosk_card_terminal) then
    raise exception 'That way to pay isn''t available.' using errcode = '22023';
  end if;

  -- One open request per member and plan: reuse it.
  select * into v_intent from public.payment_intents
   where member_id = p_member_id and plan_id = p_plan_id and status = 'pending' and expires_at > now()
   order by created_at desc limit 1;
  if found then
    update public.payment_intents set channel = p_channel, kiosk_id = v_kiosk.id where id = v_intent.id returning * into v_intent;
  else
    loop
      v_ref := 'GX-' || lpad((floor(random() * 10000))::int::text, 4, '0');
      exit when not exists (select 1 from public.payment_intents where gym_id = v_gym.id and reference = v_ref and status = 'pending');
    end loop;
    insert into public.payment_intents (gym_id, kiosk_id, member_id, plan_id, amount_usd, channel, reference)
    values (v_gym.id, v_kiosk.id, p_member_id, p_plan_id, v_plan.price_usd, p_channel, v_ref)
    returning * into v_intent;
    perform public.notify_roles(v_gym.id, array['owner', 'manager', 'front_desk']::public.gym_role[], 'kiosk',
                                'Payment waiting: ' || v_ref,
                                (select full_name from public.members where id = p_member_id) || ' · ' || v_plan.name || ' · $' || to_char(v_plan.price_usd, 'FM999990.00'),
                                '/dashboard/reception');
  end if;
  return jsonb_build_object('id', v_intent.id, 'reference', v_intent.reference, 'amount', v_intent.amount_usd,
                            'amount_lbp', round(v_intent.amount_usd * v_gym.lbp_rate / 1000) * 1000, 'channel', v_intent.channel);
end;
$$;

-- The kiosk waits on this while the payment is made.
create function public.kiosk_intent_status(p_token text, p_intent_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_kiosk public.kiosks;
  v_i     public.payment_intents;
  v_ms    public.memberships;
begin
  v_kiosk := public.kiosk_for(p_token, false);
  select * into v_i from public.payment_intents where id = p_intent_id and gym_id = v_kiosk.gym_id;
  if not found then raise exception 'Not found' using errcode = 'P0002'; end if;
  if v_i.status = 'paid' then
    select ms.* into v_ms from public.memberships ms join public.invoices inv on inv.membership_id = ms.id where inv.id = v_i.invoice_id;
  end if;
  return jsonb_build_object('status', case when v_i.status = 'pending' and v_i.expires_at <= now() then 'expired' else v_i.status end,
                            'starts_on', v_ms.starts_on, 'ends_on', v_ms.ends_on);
end;
$$;

-- ---------------------------------------------------------------------------
-- Verified payment → active membership
-- ---------------------------------------------------------------------------
-- Creates the membership (starting the day after the current one ends, for a
-- renewal) and records the payment. Called by the front desk (who must handle
-- billing) or, with p_automatic, by the server for a verified provider payment;
-- then it acts as the gym's owner for this one sale.
create function public.activate_payment_intent(
  p_intent_id     uuid,
  p_method        public.payment_method,
  p_amount_lbp    numeric default null,
  p_provider_ref  text default null,
  p_automatic     boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_i        public.payment_intents;
  v_gym      public.gyms;
  v_start    date;
  v_invoice  uuid;
  v_actor    text := current_setting('request.jwt.claim.sub', true);
  v_user     uuid;
begin
  select * into v_i from public.payment_intents where id = p_intent_id for update;
  if not found then raise exception 'Payment request not found' using errcode = 'P0002'; end if;
  if v_i.status = 'paid' then return v_i.invoice_id; end if;
  if v_i.status <> 'pending' then raise exception 'This payment request was %.', v_i.status using errcode = '22023'; end if;
  select * into v_gym from public.gyms where id = v_i.gym_id;

  if p_automatic then
    -- Only the server (no signed-in user) may activate automatically.
    if auth.uid() is not null then raise exception 'Not allowed' using errcode = '42501'; end if;
    perform set_config('request.jwt.claim.sub', v_gym.created_by::text, true);
  else
    perform public.require_billing(v_i.gym_id);
  end if;
  v_user := auth.uid();

  -- Renewing: start the day after the current membership ends.
  select greatest(public.gym_today(v_i.gym_id), coalesce(max(ms.ends_on) + 1, public.gym_today(v_i.gym_id))) into v_start
    from public.memberships ms
   where ms.member_id = v_i.member_id and ms.cancelled_at is null and ms.ends_on >= public.gym_today(v_i.gym_id);

  v_invoice := public.sell_membership(v_i.member_id, v_i.plan_id, v_start, 0, v_i.amount_usd, p_method,
                                      case when p_method = 'cash_lbp' then p_amount_lbp end);
  update public.payment_intents
     set status = 'paid', paid_at = now(), invoice_id = v_invoice, provider_ref = left(p_provider_ref, 120),
         confirmed_by = case when p_automatic then null else v_user end
   where id = v_i.id;
  perform public.notify(v_i.gym_id, (select user_id from public.members where id = v_i.member_id), 'billing',
                        'Your membership is active', 'Thanks for your payment. See you at the gym!', '/portal');

  if p_automatic then
    perform set_config('request.jwt.claim.sub', coalesce(v_actor, ''), true);
  end if;
  return v_invoice;
end;
$$;

create function public.cancel_payment_intent(p_intent_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_gym uuid;
begin
  select gym_id into v_gym from public.payment_intents where id = p_intent_id;
  if not found then raise exception 'Payment request not found' using errcode = 'P0002'; end if;
  perform public.require_billing(v_gym);
  update public.payment_intents set status = 'cancelled' where id = p_intent_id and status = 'pending';
end;
$$;

-- Server only: a payment provider confirmed a payment for a reference.
create function public.provider_payment(p_gym_id uuid, p_reference text, p_amount_usd numeric, p_provider_ref text, p_method public.payment_method)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_i public.payment_intents;
begin
  select * into v_i from public.payment_intents where gym_id = p_gym_id and reference = upper(trim(p_reference)) order by created_at desc limit 1;
  if not found then return 'unknown_reference'; end if;
  if v_i.status = 'paid' then return 'already_paid'; end if;
  if v_i.status <> 'pending' then return v_i.status; end if;
  if round(p_amount_usd, 2) < v_i.amount_usd then return 'amount_too_low'; end if;
  perform public.activate_payment_intent(v_i.id, p_method, null, p_provider_ref, true);
  return 'activated';
end;
$$;

revoke execute on function public.kiosk_for(text, boolean) from public, anon, authenticated;
revoke execute on function public.kiosk_info(text) from public, anon, authenticated;
revoke execute on function public.kiosk_find_member(text, text) from public, anon, authenticated;
revoke execute on function public.kiosk_check_in(text, uuid) from public, anon, authenticated;
revoke execute on function public.kiosk_join(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.kiosk_start_purchase(text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.kiosk_intent_status(text, uuid) from public, anon, authenticated;
revoke execute on function public.provider_payment(uuid, text, numeric, text, public.payment_method) from public, anon, authenticated;
revoke execute on function public.activate_payment_intent(uuid, public.payment_method, numeric, text, boolean) from public, anon;
revoke execute on function public.cancel_payment_intent(uuid) from public, anon;
grant execute on function public.activate_payment_intent(uuid, public.payment_method, numeric, text, boolean) to authenticated;
grant execute on function public.cancel_payment_intent(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.kiosk_info(text) to service_role;
    grant execute on function public.kiosk_find_member(text, text) to service_role;
    grant execute on function public.kiosk_check_in(text, uuid) to service_role;
    grant execute on function public.kiosk_join(text, text, text, text) to service_role;
    grant execute on function public.kiosk_start_purchase(text, uuid, uuid, text) to service_role;
    grant execute on function public.kiosk_intent_status(text, uuid) to service_role;
    grant execute on function public.provider_payment(uuid, text, numeric, text, public.payment_method) to service_role;
    grant execute on function public.activate_payment_intent(uuid, public.payment_method, numeric, text, boolean) to service_role;
  end if;
end;
$$;

insert into public.features (key, name, description, rollout) values
  ('self_service', 'Self-service reception', 'A kiosk to check in, join, and buy or renew memberships, activated once payment is verified.', 'lab');
