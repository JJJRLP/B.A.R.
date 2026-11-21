-- =====================================================================
-- Bar · Registro de pagos y ventas — Supabase schema (MVP)
-- Run this whole file once in Supabase → SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Settings: business day rolls over at 06:00 La Paz time
-- ---------------------------------------------------------------------
create or replace function public.business_day(ts timestamptz)
returns date language sql immutable as $$
  select ((ts at time zone 'America/La_Paz') - interval '6 hours')::date
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'staff' check (role in ('admin','staff')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'consumo' check (type in ('entrada','consumo')),
  category    text not null default 'General',
  price       numeric(10,2) not null check (price >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
-- 'entrada' = entrance fee (General, VIP…), 'consumo' = drinks/food at the bar.
alter table public.products add column if not exists type text not null default 'consumo'
  check (type in ('entrada','consumo'));
-- Entry setup (only used when type = 'entrada'):
--   max_per_night: how many of this entry can be sold per business day (null = no limit)
--   free_until:    entry is free before this La Paz time, e.g. 23:00 (null = never free)
alter table public.products add column if not exists max_per_night integer check (max_per_night is null or max_per_night > 0);
alter table public.products add column if not exists free_until time;
-- people_per_unit: how many people one unit lets in (1 = single entry, 6 = table for 6)
alter table public.products add column if not exists people_per_unit integer not null default 1 check (people_per_unit > 0);

create table if not exists public.sales (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  business_day  date not null default public.business_day(now()),
  created_by    uuid not null references public.profiles(id),
  table_label   text,
  note          text,
  total         numeric(10,2) not null default 0,
  status        text not null default 'paid' check (status in ('open','paid','void')),
  void_reason   text,
  voided_by     uuid references public.profiles(id),
  voided_at     timestamptz
);
create index if not exists sales_business_day_idx on public.sales (business_day);

create table if not exists public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  name        text not null,             -- product name at sale time
  product_type text not null default 'consumo', -- product type at sale time
  qty         integer not null check (qty > 0),
  unit_price  numeric(10,2) not null,
  subtotal    numeric(10,2) not null
);
alter table public.sale_items add column if not exists product_type text not null default 'consumo';
alter table public.sale_items add column if not exists people_per_unit integer not null default 1;

-- The person who pays: required when the sale includes entries
alter table public.sales add column if not exists customer_name text;
alter table public.sales add column if not exists customer_ci text;
create index if not exists sales_customer_name_idx on public.sales (lower(customer_name));
create index if not exists sales_customer_ci_idx on public.sales (customer_ci);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales(id) on delete cascade,
  method          text not null check (method in ('qr','cash','card')),
  amount          numeric(10,2) not null check (amount >= 0),
  reference       text,
  proof_path      text,
  proof_hash      text,
  status          text not null default 'pending' check (status in ('pending','verified','rejected')),
  reject_reason   text,
  verified_by     uuid references public.profiles(id),
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists payments_sale_idx on public.payments (sale_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_hash_idx on public.payments (proof_hash);

-- Other people on the reservation (e.g. everyone at a table), for door verification
create table if not exists public.sale_guests (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales(id) on delete cascade,
  full_name  text not null,
  ci         text
);
create index if not exists sale_guests_sale_idx on public.sale_guests (sale_id);
create index if not exists sale_guests_name_idx on public.sale_guests (lower(full_name));
-- Not unique on purpose: a repeated reference is warned about in the app, not blocked.
create index if not exists payments_reference_idx
  on public.payments (lower(reference)) where reference is not null and reference <> '';

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active)
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

-- New auth user → profile (role staff). Promote the owner to admin manually (see README).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

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

-- RPC: possible duplicate proof (same reference or same image hash).
-- security definer so staff can check against payments they cannot read.
create or replace function public.check_duplicate(p_reference text, p_hash text)
returns table (payment_id uuid, created_at timestamptz, amount numeric, match text)
language sql stable security definer set search_path = public as $$
  select p.id, p.created_at, p.amount,
         case when p_reference <> '' and lower(p.reference) = lower(p_reference) then 'reference' else 'image' end
  from payments p
  where is_active_user()
    and ((coalesce(p_reference,'') <> '' and lower(p.reference) = lower(p_reference))
      or (coalesce(p_hash,'') <> '' and p.proof_hash = p_hash))
  order by p.created_at desc
  limit 5
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.products   enable row level security;
alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments   enable row level security;
alter table public.sale_guests enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update
  using (is_admin()) with check (is_admin());

-- products: everyone signed in can read, admin writes
drop policy if exists products_select on public.products;
create policy products_select on public.products for select using (is_active_user());
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products for all
  using (is_admin()) with check (is_admin());

-- sales: admin sees all; staff see their own sales of the current business day.
-- Inserts happen only through create_sale(); updates (void) admin only.
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select
  using (is_admin() or (created_by = auth.uid() and business_day = public.business_day(now())));
drop policy if exists sales_admin_update on public.sales;
create policy sales_admin_update on public.sales for update
  using (is_admin()) with check (is_admin());

drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items for select
  using (exists (select 1 from sales s where s.id = sale_id));

drop policy if exists sale_guests_select on public.sale_guests;
create policy sale_guests_select on public.sale_guests for select
  using (exists (select 1 from sales s where s.id = sale_id));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select
  using (exists (select 1 from sales s where s.id = sale_id));
drop policy if exists payments_admin_update on public.payments;
create policy payments_admin_update on public.payments for update
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- Storage: private bucket for payment proofs
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists proofs_insert on storage.objects;
create policy proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and public.is_active_user());
drop policy if exists proofs_select on storage.objects;
create policy proofs_select on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_active_user());

-- ---------------------------------------------------------------------
-- Grants for RPCs
-- ---------------------------------------------------------------------
grant execute on function public.create_sale(jsonb) to authenticated;
grant execute on function public.check_duplicate(text, text) to authenticated;
grant execute on function public.business_day(timestamptz) to authenticated;
grant execute on function public.entry_counts(date) to authenticated;
grant execute on function public.find_reservation(text) to authenticated;
