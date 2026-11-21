-- Performance tuning from the Supabase advisor.
create index if not exists payments_verified_by_idx on public.payments (verified_by);
create index if not exists sale_items_product_idx on public.sale_items (product_id);
create index if not exists sales_created_by_idx on public.sales (created_by);
create index if not exists sales_voided_by_idx on public.sales (voided_by);

-- evaluate auth.uid() / is_admin() once per query, not once per row
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) or (select is_admin()));

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select
  using ((select is_admin()) or (created_by = (select auth.uid()) and business_day = public.business_day(now())));

-- one SELECT policy on products; admin writes split by action
drop policy if exists products_admin_all on public.products;
create policy products_admin_insert on public.products for insert with check ((select is_admin()));
create policy products_admin_update on public.products for update using ((select is_admin())) with check ((select is_admin()));
create policy products_admin_delete on public.products for delete using ((select is_admin()));
