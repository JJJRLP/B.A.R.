-- Only needed if you already ran schema.sql before entrance fees were added.
-- Running the full schema.sql again also works (it is idempotent).

alter table public.products add column if not exists type text not null default 'consumo'
  check (type in ('entrada','consumo'));
alter table public.sale_items add column if not exists product_type text not null default 'consumo';

create or replace function public.create_sale(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_total   numeric(10,2) := 0;
  v_item    jsonb;
  v_prod    products%rowtype;
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
    select * into v_prod from products where id = (v_item->>'product_id')::uuid and active;
    if not found then raise exception 'product not found or inactive'; end if;
    insert into sale_items (sale_id, product_id, name, product_type, qty, unit_price, subtotal)
    values (v_sale_id, v_prod.id, v_prod.name, v_prod.type, (v_item->>'qty')::int, v_prod.price,
            v_prod.price * (v_item->>'qty')::int);
    v_total := v_total + v_prod.price * (v_item->>'qty')::int;
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

insert into public.products (name, type, category, price)
select * from (values ('Entrada General', 'entrada', 'Entradas', 30::numeric), ('Entrada VIP', 'entrada', 'Entradas', 80::numeric)) v
where not exists (select 1 from public.products where type = 'entrada');
