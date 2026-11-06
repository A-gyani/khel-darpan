-- Fix: let the State officer add resolved complaints (needed for demo data and imports). Citizens still only add open ones.
drop policy if exists p_gr_insert on public.grievances;
create policy p_gr_insert on public.grievances for insert to anon, authenticated with check (status = 'open' or public.is_state());
