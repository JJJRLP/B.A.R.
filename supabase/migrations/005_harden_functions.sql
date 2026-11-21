-- Security hardening from the Supabase advisor:
-- fixed search_path on helper functions, and RPCs callable only by signed-in users.

alter function public.business_day(timestamptz) set search_path = public;
alter function public.effective_price(public.products, timestamptz) set search_path = public;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.business_day(timestamptz) from anon;
revoke execute on function public.effective_price(public.products, timestamptz) from anon;
revoke execute on function public.create_sale(jsonb) from public, anon;
revoke execute on function public.check_duplicate(text, text) from public, anon;
revoke execute on function public.entry_counts(date) from public, anon;
revoke execute on function public.find_reservation(text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
