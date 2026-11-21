-- Payment verification removed for now (checked in person until a bank API is approved).
-- Every new payment is recorded as received; the status column stays for a future bank integration.

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
  -- No verification step for now: payments are checked in person until a bank API exists.
  v_confirmed  boolean := true;
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

-- Close any payment still pending from before this change
update public.payments set status = 'verified', verified_at = coalesce(verified_at, now()) where status = 'pending';
