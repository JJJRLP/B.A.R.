-- Buyer (titular) name + CI on entry sales, guest list for tables, people per entry.
-- Only needed if you already ran schema.sql before this change
-- (running the full schema.sql again also works).

-- How many people one unit of an entry lets in (1 = single entry, 6 = table for 6)
alter table public.products   add column if not exists people_per_unit integer not null default 1 check (people_per_unit > 0);
alter table public.sale_items add column if not exists people_per_unit integer not null default 1;

-- The person who pays: required when the sale includes entries
alter table public.sales add column if not exists customer_name text;
alter table public.sales add column if not exists customer_ci text;
create index if not exists sales_customer_name_idx on public.sales (lower(customer_name));
create index if not exists sales_customer_ci_idx on public.sales (customer_ci);

-- Other people on the reservation (e.g. everyone at a table), for door verification
create table if not exists public.sale_guests (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales(id) on delete cascade,
  full_name  text not null,
  ci         text
);
create index if not exists sale_guests_sale_idx on public.sale_guests (sale_id);
create index if not exists sale_guests_name_idx on public.sale_guests (lower(full_name));

alter table public.sale_guests enable row level security;
drop policy if exists sale_guests_select on public.sale_guests;
create policy sale_guests_select on public.sale_guests for select
  using (exists (select 1 from sales s where s.id = sale_id));

-- ---------------------------------------------------------------------
-- RPC: create a sale + items + payment atomically. Prices, free-entry hours,
-- entry limits and the buyer's name + CI (for entries) are enforced here.
-- payload: { table_label, note, customer:{name, ci}, guests:[{full_name, ci}],
--            items:[{product_id, qty}],
--            payment:{method, amount, reference, proof_path, proof_hash} }
-- ---------------------------------------------------------------------
create or replace function public.create_sale(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale_id   uuid;
  v_total     numeric(10,2) := 0;
  v_item      jsonb;
  v_guest     jsonb;
  v_prod      products%rowtype;
  v_qty       integer;
  v_price     numeric(10,2);
  v_sold      integer;
  v_has_entry boolean := false;
  v_name      text := nullif(btrim(payload->'customer'->>'name'), '');
  v_ci        text := nullif(btrim(payload->'customer'->>'ci'), '');
  v_pay       jsonb := payload->'payment';
  v_method    text  := v_pay->>'method';
begin
  if not is_active_user() then
    raise exception 'not allowed';
  end if;
  if jsonb_array_length(coalesce(payload->'items','[]'::jsonb)) = 0 then
    raise exception 'sale has no items';
  end if;

  insert into sales (created_by, table_label, note, status, customer_name, customer_ci)
  values (auth.uid(), nullif(payload->>'table_label',''), nullif(payload->>'note',''), 'paid', v_name, v_ci)
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
        where i.product_id = v_prod.id and s.status <> 'void' and s.business_day = business_day(now());
        if v_sold + v_qty > v_prod.max_per_night then
          raise exception 'Cupo agotado para %: quedan %', v_prod.name, greatest(v_prod.max_per_night - v_sold, 0);
        end if;
      end if;
    end if;

    v_price := effective_price(v_prod);
    insert into sale_items (sale_id, product_id, name, product_type, people_per_unit, qty, unit_price, subtotal)
    values (v_sale_id, v_prod.id, v_prod.name, v_prod.type, v_prod.people_per_unit, v_qty, v_price, v_price * v_qty);
    v_total := v_total + v_price * v_qty;
  end loop;

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
          case when v_method = 'qr' then 'pending' else 'verified' end,
          case when v_method = 'qr' then null else auth.uid() end,
          case when v_method = 'qr' then null else now() end);

  return v_sale_id;
end $$;

-- RPC: door verification. Finds tonight's entry sales by buyer name, CI or guest name,
-- across all staff (security definer), so any door device can check a reservation.
create or replace function public.find_reservation(q text)
returns table (
  sale_id uuid, created_at timestamptz, customer_name text, customer_ci text,
  entries text, people integer, guests jsonb, total numeric, payment_status text,
  sold_by text, sale_status text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.created_at, s.customer_name, s.customer_ci,
         (select string_agg(i.qty || '× ' || i.name, ', ') from sale_items i where i.sale_id = s.id and i.product_type = 'entrada'),
         (select coalesce(sum(i.qty * i.people_per_unit), 0)::int from sale_items i where i.sale_id = s.id and i.product_type = 'entrada'),
         coalesce((select jsonb_agg(jsonb_build_object('full_name', g.full_name, 'ci', g.ci)) from sale_guests g where g.sale_id = s.id), '[]'::jsonb),
         s.total,
         (select p.status from payments p where p.sale_id = s.id order by p.created_at limit 1),
         (select pr.full_name from profiles pr where pr.id = s.created_by),
         s.status
  from sales s
  where is_active_user()
    and length(btrim(q)) >= 2
    and s.business_day = business_day(now())
    and exists (select 1 from sale_items i where i.sale_id = s.id and i.product_type = 'entrada')
    and (s.customer_name ilike '%' || btrim(q) || '%'
      or s.customer_ci ilike btrim(q) || '%'
      or exists (select 1 from sale_guests g where g.sale_id = s.id
                 and (g.full_name ilike '%' || btrim(q) || '%' or g.ci ilike btrim(q) || '%')))
  order by s.created_at desc
  limit 20
$$;

grant execute on function public.find_reservation(text) to authenticated;
