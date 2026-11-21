-- Entry setup: per-night limits and free-entry hour for entrance fees.
-- Only needed if you already ran schema.sql before this change
-- (running the full schema.sql again also works).

alter table public.products add column if not exists max_per_night integer check (max_per_night is null or max_per_night > 0);
alter table public.products add column if not exists free_until time;

-- ---------------------------------------------------------------------
-- Price of a product right now. Entries are free before free_until
-- (La Paz time). The night runs 06:00 → 06:00, so "free until 23:00"
-- means free from opening until 23:00, and paid after (including after midnight).
-- ---------------------------------------------------------------------
create or replace function public.effective_price(p public.products, ts timestamptz default now())
returns numeric language sql stable as $$
  select case
    when p.type = 'entrada' and p.free_until is not null
     -- seconds since 06:00, wrapped to 0..86399 so 01:00 counts as late night, not early
     and mod(extract(epoch from (ts at time zone 'America/La_Paz')::time)::int - 21600 + 86400, 86400)
       < mod(extract(epoch from p.free_until)::int - 21600 + 86400, 86400)
    then 0::numeric
    else p.price
  end
$$;

-- ---------------------------------------------------------------------
-- RPC: create a sale + items + payment atomically. Prices, free-entry hours
-- and entry limits are enforced here, server-side.
-- payload: { table_label, note, items:[{product_id, qty}],
--            payment:{method, amount, reference, proof_path, proof_hash} }
-- ---------------------------------------------------------------------
create or replace function public.create_sale(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_total   numeric(10,2) := 0;
  v_item    jsonb;
  v_prod    products%rowtype;
  v_qty     integer;
  v_price   numeric(10,2);
  v_sold    integer;
  v_pay     jsonb := payload->'payment';
  v_method  text  := v_pay->>'method';
begin
  if not is_active_user() then
    raise exception 'not allowed';
  end if;
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb)) = 0 then
    raise exception 'sale has no items';
  end if;

  insert into sales (created_by, table_label, note, status)
  values (auth.uid(), nullif(payload->>'table_label',''), nullif(payload->>'note',''), 'paid')
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    select * into v_prod from products where id = (v_item->>'product_id')::uuid and active for update;
    if not found then raise exception 'Producto no encontrado o inactivo'; end if;
    v_qty := (v_item->>'qty')::int;

    if v_prod.type = 'entrada' and v_prod.max_per_night is not null then
      select coalesce(sum(i.qty), 0) into v_sold
      from sale_items i join sales s on s.id = i.sale_id
      where i.product_id = v_prod.id and s.status <> 'void' and s.business_day = business_day(now());
      if v_sold + v_qty > v_prod.max_per_night then
        raise exception 'Cupo agotado para %: quedan %', v_prod.name, greatest(v_prod.max_per_night - v_sold, 0);
      end if;
    end if;

    v_price := effective_price(v_prod);
    insert into sale_items (sale_id, product_id, name, product_type, qty, unit_price, subtotal)
    values (v_sale_id, v_prod.id, v_prod.name, v_prod.type, v_qty, v_price, v_price * v_qty);
    v_total := v_total + v_price * v_qty;
  end loop;

  update sales set total = v_total where id = v_sale_id;

  insert into payments (sale_id, method, amount, reference, proof_path, proof_hash, status,
                        verified_by, verified_at)
  values (v_sale_id, v_method, (v_pay->>'amount')::numeric,
          nullif(v_pay->>'reference',''), nullif(v_pay->>'proof_path',''), nullif(v_pay->>'proof_hash',''),
          case when v_method = 'qr' then 'pending' else 'verified' end,
          case when v_method = 'qr' then null else auth.uid() end,
          case when v_method = 'qr' then null else now() end);

  return v_sale_id;
end $$;

-- RPC: entries sold per entry type for a business day (all staff, not just mine),
-- so the door can show remaining spots.
create or replace function public.entry_counts(p_day date default null)
returns table (product_id uuid, sold integer)
language sql stable security definer set search_path = public as $$
  select i.product_id, sum(i.qty)::int
  from sale_items i join sales s on s.id = i.sale_id
  where is_active_user()
    and i.product_type = 'entrada'
    and s.status <> 'void'
    and s.business_day = coalesce(p_day, business_day(now()))
  group by i.product_id
$$;

grant execute on function public.entry_counts(date) to authenticated;
