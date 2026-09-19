begin;

drop policy if exists "Super admin manages products" on public.products;
create policy "Admins manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

commit;

