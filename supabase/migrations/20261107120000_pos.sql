-- Gymix POS: selling supplements, drinks and merchandise at the front desk.
--
--   products         what the gym sells, with barcode, price, cost and stock
--   sales            one checkout: paid (cash, card, Whish, OMT...) or put on a
--                    member's account, which creates a normal invoice so it shows
--                    in Billing and counts towards the unpaid-account freeze
--   sale_items       the lines of a sale, with the price and cost at that moment
--   stock_movements  every change to stock: sales, refunds, deliveries, counts
--
-- Selling is open to billing roles (owner, manager, front desk). Products,
-- deliveries, counts, refunds and the profit reports are for owners and managers.

alter table public.gyms add column next_sale_number integer not null default 1;

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 80),
  category      text check (char_length(category) <= 40),
  barcode       text check (barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  price_usd     numeric(10, 2) not null check (price_usd >= 0),
  cost_usd      numeric(10, 2) check (cost_usd >= 0),
  track_stock   boolean not null default true,
  stock         integer not null default 0,
  low_stock_at  integer not null default 5 check (low_stock_at >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index products_gym_barcode_unique on public.products (gym_id, barcode) where barcode is not null;
create index products_gym_idx on public.products (gym_id, is_active, name);

create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms (id) on delete cascade,
  number         integer not null,
  member_id      uuid references public.members (id) on delete set null,
  subtotal_usd   numeric(10, 2) not null check (subtotal_usd >= 0),
  discount_usd   numeric(10, 2) not null default 0 check (discount_usd >= 0 and discount_usd <= subtotal_usd),
  total_usd      numeric(10, 2) generated always as (subtotal_usd - discount_usd) stored,
  cost_usd       numeric(10, 2) not null default 0,
  -- How it was paid; null when put on the member's account (see invoice_id).
  method         public.payment_method,
  amount_lbp     numeric(14, 0) check (amount_lbp > 0),
  lbp_rate       numeric(12, 2) check (lbp_rate > 0),
  invoice_id     uuid references public.invoices (id) on delete set null,
  status         text not null default 'paid' check (status in ('paid', 'on_account', 'refunded')),
  sold_by        uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  refunded_at    timestamptz,
  refund_reason  text check (char_length(refund_reason) <= 200),
  unique (gym_id, number),
  check ((method is null) = (status = 'on_account' or (status = 'refunded' and invoice_id is not null))),
  check ((amount_lbp is null) = (lbp_rate is null))
);
create index sales_gym_created_idx on public.sales (gym_id, created_at desc);
create index sales_member_idx on public.sales (member_id);

create table public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  name        text not null,
  quantity    integer not null check (quantity between 1 and 999),
  unit_price  numeric(10, 2) not null check (unit_price >= 0),
  unit_cost   numeric(10, 2) check (unit_cost >= 0)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

create table public.stock_movements (
  id          bigint generated always as identity primary key,
  gym_id      uuid not null references public.gyms (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null check (quantity <> 0),
  reason      text not null check (reason in ('sale', 'refund', 'delivery', 'count')),
  unit_cost   numeric(10, 2),
  stock_after integer not null,
  sale_id     uuid references public.sales (id) on delete set null,
  note        text check (char_length(note) <= 200),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;

create policy products_select on public.products for select to authenticated using (public.can_handle_billing(gym_id));
create policy products_insert on public.products for insert to authenticated
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy products_update on public.products for update to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]))
  with check (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
create policy products_delete on public.products for delete to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[])
         and not exists (select 1 from public.sale_items i where i.product_id = products.id));
-- Stock only changes through sales, deliveries and counts (so every change is recorded).
revoke insert, update on public.products from authenticated;
grant insert (gym_id, name, category, barcode, price_usd, cost_usd, track_stock, low_stock_at, is_active) on public.products to authenticated;
grant update (name, category, barcode, price_usd, cost_usd, track_stock, low_stock_at, is_active) on public.products to authenticated;

create policy sales_select on public.sales for select to authenticated using (public.can_handle_billing(gym_id));
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and public.can_handle_billing(s.gym_id)));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_gym_role(gym_id, array['owner', 'manager']::public.gym_role[]));
revoke insert, update, delete on public.sales, public.sale_items, public.stock_movements from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Checkout
-- ---------------------------------------------------------------------------
-- p_items: [{"product_id": "...", "quantity": 2}, ...]. p_method: a payment
-- method, or 'account' to put it on the member's account. Returns the sale id.
create function public.pos_checkout(
  p_gym_id      uuid,
  p_items       jsonb,
  p_method      text,
  p_member_id   uuid default null,
  p_discount    numeric default 0,
  p_amount_lbp  numeric default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_line      jsonb;
  v_product   public.products;
  v_qty       integer;
  v_subtotal  numeric := 0;
  v_cost      numeric := 0;
  v_sale      uuid;
  v_number    integer;
  v_invoice   uuid;
  v_rate      numeric;
  v_count     integer := 0;
  v_names     text[] := '{}';
begin
  perform public.require_billing(p_gym_id);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The basket is empty.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'That''s too many lines for one sale.' using errcode = '22023';
  end if;
  if p_method <> 'account' and p_method not in (select unnest(enum_range(null::public.payment_method))::text) then
    raise exception 'Choose how it was paid.' using errcode = '22023';
  end if;
  if p_method = 'account' and p_member_id is null then
    raise exception 'Choose the member to put it on.' using errcode = '22023';
  end if;
  if p_member_id is not null and not exists (select 1 from public.members where id = p_member_id and gym_id = p_gym_id) then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if coalesce(p_discount, 0) < 0 then
    raise exception 'A discount can''t be negative.' using errcode = '22023';
  end if;

  update public.gyms set next_sale_number = next_sale_number + 1 where id = p_gym_id
  returning next_sale_number - 1 into v_number;
  insert into public.sales (gym_id, number, member_id, subtotal_usd, discount_usd, method, status, sold_by)
  values (p_gym_id, v_number, p_member_id, 0, 0, case when p_method = 'account' then null else p_method::public.payment_method end,
          case when p_method = 'account' then 'on_account' else 'paid' end, auth.uid())
  returning id into v_sale;

  -- Lines in product order so two tills never wait on each other in a loop.
  for v_line in
    select value from jsonb_array_elements(p_items) order by value->>'product_id'
  loop
    v_qty := (v_line->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'Each quantity must be between 1 and 999.' using errcode = '22023';
    end if;
    select * into v_product from public.products
     where id = (v_line->>'product_id')::uuid and gym_id = p_gym_id
     for update;
    if not found or not v_product.is_active then
      raise exception 'A product in the basket is no longer sold.' using errcode = '22023';
    end if;
    if v_product.track_stock and v_product.stock < v_qty then
      raise exception 'Only % left of %.', greatest(v_product.stock, 0), v_product.name using errcode = '22023';
    end if;

    insert into public.sale_items (sale_id, product_id, name, quantity, unit_price, unit_cost)
    values (v_sale, v_product.id, v_product.name, v_qty, v_product.price_usd, v_product.cost_usd);
    v_subtotal := v_subtotal + v_product.price_usd * v_qty;
    v_cost := v_cost + coalesce(v_product.cost_usd, 0) * v_qty;
    v_count := v_count + v_qty;
    v_names := v_names || v_product.name;

    if v_product.track_stock then
      update public.products set stock = stock - v_qty where id = v_product.id;
      insert into public.stock_movements (gym_id, product_id, quantity, reason, unit_cost, stock_after, sale_id, created_by)
      values (p_gym_id, v_product.id, -v_qty, 'sale', v_product.cost_usd, v_product.stock - v_qty, v_sale, auth.uid());
    end if;
  end loop;

  if round(coalesce(p_discount, 0), 2) > v_subtotal then
    raise exception 'The discount is more than the total.' using errcode = '22023';
  end if;
  if p_amount_lbp is not null then
    if p_method <> 'cash_lbp' then
      raise exception 'A lira amount is only for cash in lira.' using errcode = '22023';
    end if;
    select lbp_rate into v_rate from public.gyms where id = p_gym_id;
  end if;

  update public.sales
     set subtotal_usd = round(v_subtotal, 2), discount_usd = round(coalesce(p_discount, 0), 2),
         cost_usd = round(v_cost, 2), amount_lbp = round(p_amount_lbp), lbp_rate = v_rate
   where id = v_sale;

  -- On the member's account: an invoice like any other.
  if p_method = 'account' then
    update public.gyms set next_invoice_number = next_invoice_number + 1 where id = p_gym_id
    returning next_invoice_number - 1 into v_number;
    insert into public.invoices (gym_id, member_id, number, description, amount_usd, discount_usd, issued_on, created_by)
    values (p_gym_id, p_member_id, v_number,
            left('Shop: ' || array_to_string(v_names, ', '), 200),
            round(v_subtotal, 2), round(coalesce(p_discount, 0), 2), public.gym_today(p_gym_id), auth.uid())
    returning id into v_invoice;
    update public.sales set invoice_id = v_invoice where id = v_sale;
  end if;

  insert into public.activity_log (gym_id, actor_id, action, summary, details)
  values (p_gym_id, auth.uid(), 'pos.sale',
          format('Shop sale #%s: %s item%s, $%s', (select number from public.sales where id = v_sale), v_count,
                 case when v_count = 1 then '' else 's' end, to_char(v_subtotal - coalesce(p_discount, 0), 'FM999990.00')),
          jsonb_build_object('sale_id', v_sale));
  return v_sale;
end;
$$;

-- Refund a sale: items go back on the shelf. A sale on account is cancelled
-- by voiding its invoice (only while nothing has been paid on it).
create function public.pos_refund(p_sale_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_sale  public.sales;
  v_item  public.sale_items;
  v_stock integer;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found' using errcode = 'P0002'; end if;
  perform public.require_manager(v_sale.gym_id);
  if v_sale.status = 'refunded' then raise exception 'This sale was already refunded.' using errcode = '22023'; end if;

  if v_sale.invoice_id is not null then
    if exists (select 1 from public.payments where invoice_id = v_sale.invoice_id) then
      raise exception 'Something was already paid on this sale''s invoice. Refund that payment first.' using errcode = '22023';
    end if;
    update public.invoices set voided_at = now(), void_reason = left(coalesce(nullif(trim(p_reason), ''), 'Shop sale refunded'), 200)
     where id = v_sale.invoice_id and voided_at is null;
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id loop
    update public.products set stock = stock + v_item.quantity
     where id = v_item.product_id and track_stock
    returning stock into v_stock;
    if found then
      insert into public.stock_movements (gym_id, product_id, quantity, reason, unit_cost, stock_after, sale_id, note, created_by)
      values (v_sale.gym_id, v_item.product_id, v_item.quantity, 'refund', v_item.unit_cost, v_stock, p_sale_id, left(p_reason, 200), auth.uid());
    end if;
  end loop;

  update public.sales set status = 'refunded', refunded_at = now(), refund_reason = left(nullif(trim(p_reason), ''), 200) where id = p_sale_id;
  insert into public.activity_log (gym_id, actor_id, action, summary, details)
  values (v_sale.gym_id, auth.uid(), 'pos.refund', format('Shop sale #%s refunded', v_sale.number), jsonb_build_object('sale_id', p_sale_id));
end;
$$;

-- A delivery: more stock, and optionally the new cost per unit.
create function public.pos_receive_stock(p_product_id uuid, p_quantity integer, p_unit_cost numeric default null, p_note text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
  perform public.require_manager(v_product.gym_id);
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then
    raise exception 'Enter how many arrived (1 or more).' using errcode = '22023';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'A cost can''t be negative.' using errcode = '22023';
  end if;
  update public.products set stock = stock + p_quantity, track_stock = true, cost_usd = coalesce(round(p_unit_cost, 2), cost_usd)
   where id = p_product_id returning * into v_product;
  insert into public.stock_movements (gym_id, product_id, quantity, reason, unit_cost, stock_after, note, created_by)
  values (v_product.gym_id, p_product_id, p_quantity, 'delivery', v_product.cost_usd, v_product.stock, left(nullif(trim(p_note), ''), 200), auth.uid());
  return v_product.stock;
end;
$$;

-- A stock count: set what's really on the shelf, recording the difference.
create function public.pos_count_stock(p_product_id uuid, p_counted integer, p_note text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_product public.products;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found' using errcode = 'P0002'; end if;
  perform public.require_manager(v_product.gym_id);
  if p_counted is null or p_counted < 0 or p_counted > 100000 then
    raise exception 'Enter the number on the shelf (0 or more).' using errcode = '22023';
  end if;
  if p_counted <> v_product.stock then
    insert into public.stock_movements (gym_id, product_id, quantity, reason, unit_cost, stock_after, note, created_by)
    values (v_product.gym_id, p_product_id, p_counted - v_product.stock, 'count', v_product.cost_usd, p_counted, left(nullif(trim(p_note), ''), 200), auth.uid());
    update public.products set stock = p_counted, track_stock = true where id = p_product_id;
  end if;
  return p_counted;
end;
$$;

-- Sales, revenue and profit between two days (in the gym's time zone).
create function public.pos_report(p_gym_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz    text;
  v_from  timestamptz;
  v_to    timestamptz;
begin
  perform public.require_manager(p_gym_id);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'Choose a date range of up to 400 days.' using errcode = '22023';
  end if;
  select timezone into v_tz from public.gyms where id = p_gym_id;
  v_from := p_from::timestamp at time zone v_tz;
  v_to := (p_to + 1)::timestamp at time zone v_tz;

  return (
    with s as (
      select * from public.sales where gym_id = p_gym_id and status <> 'refunded' and created_at >= v_from and created_at < v_to
    ), items as (
      select i.*, s.created_at from public.sale_items i join s on s.id = i.sale_id
    )
    select jsonb_build_object(
      'revenue', coalesce((select sum(total_usd) from s), 0),
      'cost', coalesce((select sum(cost_usd) from s), 0),
      'profit', coalesce((select sum(total_usd - cost_usd) from s), 0),
      'sales', (select count(*) from s),
      'items', coalesce((select sum(quantity) from items), 0),
      'discounts', coalesce((select sum(discount_usd) from s), 0),
      'refunded', (select count(*) from public.sales where gym_id = p_gym_id and status = 'refunded' and created_at >= v_from and created_at < v_to),
      'on_account', coalesce((select sum(total_usd) from s where status = 'on_account'), 0),
      'missing_cost', exists (select 1 from items where unit_cost is null),
      'by_method', coalesce((select jsonb_agg(jsonb_build_object('method', m, 'total', t, 'count', c) order by t desc)
                             from (select coalesce(method::text, 'account') m, sum(total_usd) t, count(*) c from s group by 1) x), '[]'),
      'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'revenue', r, 'profit', p) order by d)
                          from (select (created_at at time zone v_tz)::date d, sum(total_usd) r, sum(total_usd - cost_usd) p from s group by 1) x), '[]'),
      'top', coalesce((select jsonb_agg(x order by x.revenue desc)
                       from (select name, sum(quantity) as quantity, sum(quantity * unit_price) as revenue,
                                    sum(quantity * (unit_price - coalesce(unit_cost, 0))) as profit
                               from items group by name order by 3 desc limit 10) x), '[]')
    )
  );
end;
$$;

revoke execute on function public.pos_checkout(uuid, jsonb, text, uuid, numeric, numeric) from public, anon;
revoke execute on function public.pos_refund(uuid, text) from public, anon;
revoke execute on function public.pos_receive_stock(uuid, integer, numeric, text) from public, anon;
revoke execute on function public.pos_count_stock(uuid, integer, text) from public, anon;
revoke execute on function public.pos_report(uuid, date, date) from public, anon;
grant execute on function public.pos_checkout(uuid, jsonb, text, uuid, numeric, numeric) to authenticated;
grant execute on function public.pos_refund(uuid, text) to authenticated;
grant execute on function public.pos_receive_stock(uuid, integer, numeric, text) to authenticated;
grant execute on function public.pos_count_stock(uuid, integer, text) to authenticated;
grant execute on function public.pos_report(uuid, date, date) to authenticated;

insert into public.features (key, name, description, rollout) values
  ('pos', 'Shop (POS)', 'Sell supplements, drinks and merchandise with barcodes, stock and profit reports.', 'lab');
