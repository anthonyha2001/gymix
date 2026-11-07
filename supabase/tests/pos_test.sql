-- Shop (POS): checkout, stock, account sales as invoices, refunds, deliveries,
-- counts, reports and who may do what.
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
  ('op@test.lb', '{"full_name":"Owner P"}'),
  ('fp@test.lb', '{"full_name":"Front P"}'),
  ('tp@test.lb', '{"full_name":"Trainer P"}');

select pg_temp.act_as('op@test.lb');
select public.create_gym('Shop Gym') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values
  (:'gym', 'fp@test.lb', 'front_desk', auth.uid()), (:'gym', 'tp@test.lb', 'trainer', auth.uid());
insert into public.members (gym_id, full_name, created_by) values (:'gym', 'Lea Haddad', auth.uid());
insert into public.products (gym_id, name, category, barcode, price_usd, cost_usd) values
  (:'gym', 'Whey 1kg', 'Supplements', '6291041500213', 45, 30),
  (:'gym', 'Water', 'Drinks', '5285000390015', 1, 0.3),
  (:'gym', 'Gymix T-shirt', 'Merch', null, 15, null);
insert into public.products (gym_id, name, price_usd, track_stock) values (:'gym', 'Towel rental', 2, false);
reset role;
select pg_temp.act_as('fp@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('tp@test.lb'); select public.claim_my_invites(); reset role;
select id as whey from public.products where name = 'Whey 1kg' \gset
select id as water from public.products where name = 'Water' \gset
select id as shirt from public.products where name = 'Gymix T-shirt' \gset
select id as towel from public.products where name = 'Towel rental' \gset
select id as lea from public.members where full_name = 'Lea Haddad' \gset

-- Stock can't be set directly; deliveries record it.
select pg_temp.act_as('op@test.lb');
select pg_temp.fails(format('update public.products set stock = 100 where id = %L', :'whey')) as direct_stock \gset
select public.pos_receive_stock(:'whey', 10, 28, 'From supplier');
select public.pos_receive_stock(:'water', 48);
select public.pos_receive_stock(:'shirt', 5);
select pg_temp.ok((select stock = 10 and cost_usd = 28 from public.products where id = :'whey'), 'delivery adds stock and updates cost');
select pg_temp.fails(format('select public.pos_receive_stock(%L, 0)', :'whey')) as zero_delivery \gset
reset role;
select pg_temp.fails(format('insert into public.products (gym_id, name, barcode, price_usd) values (%L, %L, %L, 1)', :'gym', 'Dup', '5285000390015')) as dup_barcode \gset

-- The front desk sells: 2 whey + 3 water + a towel, paid in lira, $5 off.
select pg_temp.act_as('fp@test.lb');
select public.pos_checkout(:'gym',
  jsonb_build_array(jsonb_build_object('product_id', :'whey', 'quantity', 2), jsonb_build_object('product_id', :'water', 'quantity', 3),
                    jsonb_build_object('product_id', :'towel', 'quantity', 1)),
  'cash_lbp', null, 5, 8500000) as sale1 \gset
select pg_temp.ok((select subtotal_usd = 95 and discount_usd = 5 and total_usd = 90 and cost_usd = 56.9 and status = 'paid'
                          and method = 'cash_lbp' and amount_lbp = 8500000 and lbp_rate = 89500 and number = 1
                     from public.sales where id = :'sale1'), 'sale totals, cost and lira');
select pg_temp.ok((select stock = 8 from public.products where id = :'whey'), 'whey stock down');
select pg_temp.ok((select stock = 45 from public.products where id = :'water'), 'water stock down');
select pg_temp.ok((select stock = 0 from public.products where id = :'towel'), 'untracked product stock untouched');
select pg_temp.ok((select count(*) = 3 from public.sale_items where sale_id = :'sale1'), 'three lines');
-- Not enough stock, bad quantity, empty basket, too big a discount: nothing is sold.
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'whey', 'quantity', 9)), 'cash_usd')) as oversell \gset
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L)', :'gym', '[]', 'cash_usd')) as empty_basket \gset
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'water', 'quantity', 0)), 'cash_usd')) as zero_qty \gset
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L, null, 50)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'water', 'quantity', 1)), 'cash_usd')) as big_discount \gset
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'water', 'quantity', 1)), 'account')) as account_no_member \gset
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L, null, 0, 100)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'water', 'quantity', 1)), 'card')) as lbp_on_card \gset
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'water', 'quantity', 1)), 'bitcoin')) as bad_method \gset
\echo oversell refused: :oversell
reset role;
select pg_temp.ok((select stock = 8 from public.products where id = :'whey'), 'failed sale left stock alone');
select pg_temp.ok((select count(*) = 1 from public.sales where gym_id = :'gym'), 'failed sales left nothing behind');

-- On Lea's account: an unpaid invoice that shows in billing.
select pg_temp.act_as('fp@test.lb');
select public.pos_checkout(:'gym', jsonb_build_array(jsonb_build_object('product_id', :'shirt', 'quantity', 2)), 'account', :'lea') as sale2 \gset
select pg_temp.ok((select status = 'on_account' and method is null and invoice_id is not null from public.sales where id = :'sale2'), 'account sale');
select pg_temp.ok((select description = 'Shop: Gymix T-shirt' and total_usd = 30 and status = 'unpaid'
                     from public.invoice_summary where id = (select invoice_id from public.sales where id = :'sale2')), 'invoice for the account sale');
select pg_temp.ok((select stock = 3 from public.products where id = :'shirt'), 'shirts sold from stock');
reset role;

-- Trainers can't sell or see sales.
select pg_temp.act_as('tp@test.lb');
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'water', 'quantity', 1)), 'cash_usd')) as trainer_sell \gset
select pg_temp.ok((select count(*) from public.sales) = 0, 'trainer sees no sales');
select pg_temp.ok((select count(*) from public.products) = 0, 'trainer sees no products');
reset role;

-- The front desk can't refund, restock, count or see profit.
select pg_temp.act_as('fp@test.lb');
select pg_temp.fails(format('select public.pos_refund(%L)', :'sale1')) as fd_refund \gset
select pg_temp.fails(format('select public.pos_receive_stock(%L, 5)', :'whey')) as fd_restock \gset
select pg_temp.fails(format('select public.pos_count_stock(%L, 5)', :'whey')) as fd_count \gset
select pg_temp.fails(format('select public.pos_report(%L, current_date, current_date)', :'gym')) as fd_report \gset
select pg_temp.ok((select count(*) from public.stock_movements) = 0, 'front desk sees no stock history');
reset role;

-- The owner: report, refunds, counts.
select pg_temp.act_as('op@test.lb');
select public.pos_report(:'gym', current_date - 1, current_date) as r1 \gset
select pg_temp.ok((:'r1'::jsonb->>'revenue')::numeric = 120 and (:'r1'::jsonb->>'sales')::int = 2 and (:'r1'::jsonb->>'items')::int = 8
                  and (:'r1'::jsonb->>'on_account')::numeric = 30 and (:'r1'::jsonb->>'missing_cost')::boolean, 'report totals');
select pg_temp.ok((:'r1'::jsonb->>'profit')::numeric = 63.1, 'profit = revenue - cost');
select pg_temp.ok(jsonb_array_length(:'r1'::jsonb->'by_method') = 2 and (:'r1'::jsonb->'top'->0->>'name') = 'Whey 1kg', 'by method and top products');
select pg_temp.fails(format('select public.pos_report(%L, current_date, current_date - 1)', :'gym')) as bad_range \gset

select public.pos_refund(:'sale1', 'Wrong flavour');
select pg_temp.ok((select status = 'refunded' and refund_reason = 'Wrong flavour' from public.sales where id = :'sale1'), 'refunded');
select pg_temp.ok((select stock = 10 from public.products where id = :'whey') and (select stock = 48 from public.products where id = :'water'), 'refund restocks');
select pg_temp.fails(format('select public.pos_refund(%L)', :'sale1')) as twice \gset
-- An account sale with a payment on it can't be refunded until the payment is.
select public.add_payment((select invoice_id from public.sales where id = :'sale2'), 10, 'cash_usd');
select pg_temp.fails(format('select public.pos_refund(%L)', :'sale2')) as paid_account \gset
\echo paid account refund refused: :paid_account
reset role;
delete from public.payments where invoice_id = (select invoice_id from public.sales where id = :'sale2');
select pg_temp.act_as('op@test.lb');
select public.pos_refund(:'sale2');
select pg_temp.ok((select status = 'void' from public.invoice_summary where id = (select invoice_id from public.sales where id = :'sale2')), 'account sale refund voids the invoice');

select public.pos_count_stock(:'whey', 7, 'Shelf count');
select pg_temp.ok((select stock = 7 from public.products where id = :'whey'), 'count sets stock');
select pg_temp.ok((select quantity = -3 and reason = 'count' and stock_after = 7 from public.stock_movements where product_id = :'whey' order by id desc limit 1), 'count recorded as a movement');
select pg_temp.ok((select count(*) = 4 from public.stock_movements where product_id = :'whey'), 'every whey change recorded (delivery, sale, refund, count)');
select public.pos_report(:'gym', current_date - 1, current_date) as r2 \gset
select pg_temp.ok((:'r2'::jsonb->>'revenue')::numeric = 0 and (:'r2'::jsonb->>'refunded')::int = 2, 'refunded sales leave the report');
-- A product that has been sold can't be deleted (archive it instead).
select pg_temp.ok((select count(*) from public.products where id = :'whey') = 1, 'whey exists');
delete from public.products where id = :'whey';
select pg_temp.ok((select count(*) from public.products where id = :'whey') = 1, 'sold product not deleted');
update public.products set is_active = false where id = :'whey';
reset role;
select pg_temp.act_as('fp@test.lb');
select pg_temp.fails(format('select public.pos_checkout(%L, %L::jsonb, %L)', :'gym', jsonb_build_array(jsonb_build_object('product_id', :'whey', 'quantity', 1)), 'cash_usd')) as archived \gset
reset role;

\echo pos tests passed
