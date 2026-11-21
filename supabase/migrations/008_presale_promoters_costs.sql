-- Presale (preventa), promoter code (código de relacionador), product costs,
-- and QR payments confirmable by staff as well as admins.

-- Products: cost (for margin in the daily review) and optional presale price for entries
alter table public.products add column if not exists cost numeric(10,2) check (cost is null or cost >= 0);
alter table public.products add column if not exists presale_price numeric(10,2) check (presale_price is null or presale_price >= 0);

-- Sale items keep the cost at sale time
alter table public.sale_items add column if not exists unit_cost numeric(10,2);

-- Sales: the night the entries are for (presales are sold before it), presale flag, promoter code
alter table public.sales add column if not exists event_day date;
update public.sales set event_day = business_day where event_day is null;
alter table public.sales alter column event_day set default public.business_day(now());
alter table public.sales alter column event_day set not null;
alter table public.sales add column if not exists is_presale boolean not null default false;
alter table public.sales add column if not exists promoter_code text;
create index if not exists sales_event_day_idx on public.sales (event_day);
create index if not exists sales_promoter_idx on public.sales (promoter_code) where promoter_code is not null;

-- ---------------------------------------------------------------------
-- RPC: create a sale. Adds presale and promoter code; QR can be saved as
-- already confirmed (verified by the seller) or pending.
-- payload: { table_label, note, customer:{name, ci}, guests:[{full_name, ci}],
--            promoter_code, presale:{event_day} | null,
--            items:[{product_id, qty}],
--            payment:{method, amount, reference, proof_path, proof_hash, confirmed} }
-- ---------------------------------------------------------------------
create or replace function public.create_sale(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale_id    uuid;
  v_total      numeric(10,2) := 0;
  v_item       jsonb;
  v_guest      jsonb;
  v_prod       products%rowtype;
  v_qty        integer;
  v_price      numeric(10,2);
  v_sold       integer;
  v_has_entry  boolean := false;
  v_has_bar    boolean := false;
  v_today      date := business_day(now());
  v_presale    boolean := coalesce(payload->'presale'->>'event_day', '') <> '';
  v_event_day  date := coalesce(nullif(payload->'presale'->>'event_day', '')::date, business_day(now()));
  v_name       text := nullif(btrim(payload->'customer'->>'name'), '');
  v_ci         text := nullif(btrim(payload->'customer'->>'ci'), '');
  v_promoter   text := nullif(upper(btrim(payload->>'promoter_code')), '');
  v_pay        jsonb := payload->'payment';
  v_method     text  := v_pay->>'method';
  v_confirmed  boolean := v_method <> 'qr' or coalesce((v_pay->>'confirmed')::boolean, false);
begin
  if not is_active_user() then
    raise exception 'not allowed';
  end if;
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb)) = 0 then
    raise exception 'sale has no items';
  end if;
  if v_presale and v_event_day < v_today then
    raise exception 'La fecha de la preventa no puede ser anterior a hoy';
  end if;

  insert into sales (created_by, table_label, note, status, customer_name, customer_ci,
                     event_day, is_presale, promoter_code)
  values (auth.uid(), nullif(payload->>'table_label',''), nullif(payload->>'note',''), 'paid', v_name, v_ci,
          v_event_day, v_presale, v_promoter)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    select * into v_prod from products where id = (v_item->>'product_id')::uuid and active for update;
    if not found then raise exception 'Producto no encontrado o inactivo'; end if;
    v_qty := (v_item->>'qty')::int;

    if v_prod.type = 'entrada' then
      v_has_entry := true;
      if v_prod.max_per_night is not null then
        select coalesce(sum(i.qty), 0) into v_sold
        from sale_items i join sales s on s.id = i.sale_id
        where i.product_id = v_prod.id and s.status <> 'void' and s.event_day = v_event_day;
        if v_sold + v_qty > v_prod.max_per_night then
          raise exception 'Cupo agotado para %: quedan %', v_prod.name, greatest(v_prod.max_per_night - v_sold, 0);
        end if;
      end if;
      v_price := case when v_presale then coalesce(v_prod.presale_price, v_prod.price) else effective_price(v_prod) end;
    else
      v_has_bar := true;
      v_price := v_prod.price;
    end if;

    insert into sale_items (sale_id, product_id, name, product_type, people_per_unit, qty, unit_price, subtotal, unit_cost)
    values (v_sale_id, v_prod.id, v_prod.name, v_prod.type, v_prod.people_per_unit, v_qty, v_price, v_price * v_qty, v_prod.cost);
    v_total := v_total + v_price * v_qty;
  end loop;

  if v_presale and v_has_bar then
    raise exception 'La preventa solo puede incluir entradas';
  end if;
  if v_has_entry and (v_name is null or v_ci is null) then
    raise exception 'Las entradas requieren nombre completo y CI del titular';
  end if;

  for v_guest in select * from jsonb_array_elements(coalesce(payload->'guests','[]'::jsonb)) loop
    if nullif(btrim(v_guest->>'full_name'), '') is not null then
      insert into sale_guests (sale_id, full_name, ci)
      values (v_sale_id, btrim(v_guest->>'full_name'), nullif(btrim(v_guest->>'ci'), ''));
    end if;
  end loop;

  update sales set total = v_total where id = v_sale_id;

  insert into payments (sale_id, method, amount, reference, proof_path, proof_hash, status,
                        verified_by, verified_at)
  values (v_sale_id, v_method, (v_pay->>'amount')::numeric,
          nullif(v_pay->>'reference',''), nullif(v_pay->>'proof_path',''), nullif(v_pay->>'proof_hash',''),
          case when v_confirmed then 'verified' else 'pending' end,
          case when v_confirmed then auth.uid() else null end,
          case when v_confirmed then now() else null end);

  return v_sale_id;
end $$;
revoke execute on function public.create_sale(jsonb) from public, anon;
grant execute on function public.create_sale(jsonb) to authenticated;

-- Entries per entry type for a night (presales included), all staff
create or replace function public.entry_counts(p_day date default null)
returns table (product_id uuid, sold integer)
language sql stable security definer set search_path = public as $$
  select i.product_id, sum(i.qty)::int
  from sale_items i join sales s on s.id = i.sale_id
  where is_active_user()
    and i.product_type = 'entrada'
    and s.status <> 'void'
    and s.event_day = coalesce(p_day, business_day(now()))
  group by i.product_id
$$;

-- Door lookup: tonight's entries, including presales bought earlier
drop function if exists public.find_reservation(text);
create or replace function public.find_reservation(q text)
returns table (
  sale_id uuid, created_at timestamptz, customer_name text, customer_ci text,
  entries text, people integer, guests jsonb, total numeric, payment_status text,
  sold_by text, sale_status text, is_presale boolean, promoter_code text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.created_at, s.customer_name, s.customer_ci,
         (select string_agg(i.qty || '× ' || i.name, ', ') from sale_items i where i.sale_id = s.id and i.product_type = 'entrada'),
         (select coalesce(sum(i.qty * i.people_per_unit), 0)::int from sale_items i where i.sale_id = s.id and i.product_type = 'entrada'),
         coalesce((select jsonb_agg(jsonb_build_object('full_name', g.full_name, 'ci', g.ci)) from sale_guests g where g.sale_id = s.id), '[]'::jsonb),
         s.total,
         (select p.status from payments p where p.sale_id = s.id order by p.created_at limit 1),
         (select pr.full_name from profiles pr where pr.id = s.created_by),
         s.status, s.is_presale, s.promoter_code
  from sales s
  where is_active_user()
    and length(btrim(q)) >= 2
    and s.event_day = business_day(now())
    and exists (select 1 from sale_items i where i.sale_id = s.id and i.product_type = 'entrada')
    and (s.customer_name ilike '%' || btrim(q) || '%'
      or s.customer_ci ilike btrim(q) || '%'
      or exists (select 1 from sale_guests g where g.sale_id = s.id
                 and (g.full_name ilike '%' || btrim(q) || '%' or g.ci ilike btrim(q) || '%')))
  order by s.created_at desc
  limit 20
$$;
revoke execute on function public.find_reservation(text) from public, anon;
grant execute on function public.find_reservation(text) to authenticated;

-- QR payments: admins verify any; staff verify payments of their own sales of tonight
drop policy if exists payments_admin_update on public.payments;
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update
  using (exists (select 1 from sales s where s.id = sale_id
                 and ((select is_admin()) or (s.created_by = (select auth.uid()) and s.business_day = public.business_day(now())))))
  with check (exists (select 1 from sales s where s.id = sale_id
                 and ((select is_admin()) or (s.created_by = (select auth.uid()) and s.business_day = public.business_day(now())))));
