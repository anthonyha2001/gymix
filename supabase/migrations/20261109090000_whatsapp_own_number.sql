-- WhatsApp per gym: send from the Gymix number (default) or from the gym's own
-- WhatsApp Business number (Meta Cloud API keys). Every message is logged with
-- the number it went to, which number sent it, and its delivery status
-- (updated by Meta's status webhook: sent, delivered, read, failed).

alter table public.gyms
  add column whatsapp_sender text not null default 'gymix' check (whatsapp_sender in ('gymix', 'own'));

-- The gym's own WhatsApp Business account. Server only (the token is secret):
-- read and written with the service role after an owner check in the app.
create table public.gym_whatsapp_accounts (
  gym_id           uuid primary key references public.gyms (id) on delete cascade,
  phone_number_id  text not null check (phone_number_id ~ '^\d{6,25}$'),
  waba_id          text not null check (waba_id ~ '^\d{6,25}$'),
  token            text not null,
  -- Optional: the Meta app secret, to accept delivery updates for this number.
  app_secret       text,
  webhook_token    text not null default replace(gen_random_uuid()::text, '-', '') unique,
  display_phone    text,
  verified_name    text,
  -- { "gymix_payment_received": "APPROVED", ... } as last read from Meta.
  templates        jsonb not null default '{}'::jsonb,
  last_error       text,
  checked_at       timestamptz,
  connected_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.gym_whatsapp_accounts enable row level security;
revoke all on public.gym_whatsapp_accounts from anon, authenticated;

-- The Gymix number's account ID (to create its templates) and app secret (to
-- verify delivery updates); the token and phone number ID already live here.
alter table public.platform_secrets
  add column whatsapp_waba_id   text not null default '',
  add column whatsapp_app_secret text not null default '',
  add column whatsapp_templates jsonb not null default '{}'::jsonb;

-- The log: new kinds (invite and login details sent by staff, or a member to
-- themselves), the recipient, the sender, Meta's message ID and more statuses.
alter table public.whatsapp_log drop constraint whatsapp_log_kind_check;
alter table public.whatsapp_log add constraint whatsapp_log_kind_check
  check (kind in ('renewal', 'payment', 'welcome', 'invite', 'login'));
alter table public.whatsapp_log drop constraint whatsapp_log_status_check;
alter table public.whatsapp_log add constraint whatsapp_log_status_check
  check (status in ('pending', 'sent', 'delivered', 'read', 'failed'));
alter table public.whatsapp_log
  add column phone       text,
  add column sender      text check (sender in ('gymix', 'own')),
  add column wa_message_id text,
  add column sent_by     uuid references auth.users (id) on delete set null,
  add column updated_at  timestamptz not null default now();
create unique index whatsapp_log_wa_message_idx on public.whatsapp_log (wa_message_id) where wa_message_id is not null;
create index whatsapp_log_member_idx on public.whatsapp_log (member_id, created_at desc);

-- Meta's delivery update for one message. Statuses only move forward
-- (sent -> delivered -> read); a failure always wins. Server only.
create function public.whatsapp_status_update(p_wa_message_id text, p_status text, p_error text default null)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_rank constant jsonb := '{"pending":0,"sent":1,"delivered":2,"read":3}';
  v_found boolean;
begin
  if p_status not in ('sent', 'delivered', 'read', 'failed') then
    return false;
  end if;
  update public.whatsapp_log l
     set status = p_status,
         error = case when p_status = 'failed' then coalesce(p_error, l.error) else l.error end,
         updated_at = now()
   where l.wa_message_id = p_wa_message_id
     and l.status <> 'failed'
     and (p_status = 'failed' or (v_rank ->> p_status)::int > coalesce((v_rank ->> l.status)::int, 0));
  get diagnostics v_found = row_count;
  return v_found;
end;
$$;
revoke all on function public.whatsapp_status_update(text, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_status_update(text, text, text) to service_role;

-- The owner picks the sending number. Choosing "own" needs a saved account.
create function public.set_whatsapp_sender(p_gym_id uuid, p_sender text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_gym_role(p_gym_id, array['owner']::public.gym_role[]) then
    raise exception 'Only the owner can change this' using errcode = '42501';
  end if;
  if p_sender not in ('gymix', 'own') then
    raise exception 'Unknown sender' using errcode = '22023';
  end if;
  if p_sender = 'own' and not exists (select 1 from public.gym_whatsapp_accounts where gym_id = p_gym_id) then
    raise exception 'Connect your WhatsApp Business number first' using errcode = '22023';
  end if;
  update public.gyms set whatsapp_sender = p_sender where id = p_gym_id;
end;
$$;
revoke all on function public.set_whatsapp_sender(uuid, text) from public, anon;
grant execute on function public.set_whatsapp_sender(uuid, text) to authenticated;
