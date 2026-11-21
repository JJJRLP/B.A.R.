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
  category    text not null default 'General',
  price       numeric(10,2) not null check (price >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

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
  qty         integer not null check (qty > 0),
  unit_price  numeric(10,2) not null,
  subtotal    numeric(10,2) not null
);
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
-- RPC: create a sale + items + payment atomically. Total is computed
-- server-side from current product prices.
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
    insert into sale_items (sale_id, product_id, name, qty, unit_price, subtotal)
    values (v_sale_id, v_prod.id, v_prod.name, (v_item->>'qty')::int, v_prod.price,
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
