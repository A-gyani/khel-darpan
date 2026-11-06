-- Khel Darpan Gujarat — database setup (run once in Supabase → SQL Editor → New query → Run)
-- Tables, permissions (Row Level Security) and live updates.
-- Who can do what is enforced HERE, not only in the app:
--   citizens (not logged in): see approved facilities, check in, report a problem, rate
--   District Sports Officer: read/write facilities of their own district only; cannot approve
--   State officer: everything

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role text not null check (role in ('public', 'district_officer', 'state_officer')),
  district text
);

create table if not exists public.facilities (
  id text primary key,
  district text not null,
  status text not null check (status in ('draft', 'submitted', 'approved', 'returned', 'rejected')),
  data jsonb not null,            -- the working record
  public_data jsonb,              -- what citizens see (last approved copy); set only by the State officer
  created_by uuid default auth.uid(),
  updated_at timestamptz default now()
);
create index if not exists facilities_district on public.facilities (district);

create table if not exists public.checkins (
  id text primary key, facility_id text not null, district text, at timestamptz not null default now(), data jsonb not null
);
create index if not exists checkins_facility on public.checkins (facility_id);

create table if not exists public.grievances (
  id text primary key, facility_id text not null, district text, status text not null default 'open', at timestamptz not null default now(), data jsonb not null
);
create table if not exists public.ratings (
  id text primary key, facility_id text not null, at timestamptz not null default now(), data jsonb not null
);
create table if not exists public.reviews (
  id text primary key, facility_id text not null, at timestamptz not null default now(), data jsonb not null
);
create table if not exists public.audit (
  id text primary key, facility_id text, at timestamptz not null default now(), data jsonb not null
);

-- ---------- helpers ----------
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;
create or replace function public.my_district() returns text language sql stable security definer set search_path = public as
$$ select district from public.profiles where id = auth.uid() $$;
create or replace function public.is_state() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'state_officer' from public.profiles where id = auth.uid()), false) $$;
create or replace function public.is_officer() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('state_officer', 'district_officer') from public.profiles where id = auth.uid()), false) $$;

-- Only the State officer can approve / reject or change what the public sees.
create or replace function public.facilities_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_state() then
    if new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      raise exception 'Only the State officer can approve or reject a facility';
    end if;
    if tg_op = 'INSERT' then new.public_data := null; else new.public_data := old.public_data; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists facilities_guard on public.facilities;
create trigger facilities_guard before insert or update on public.facilities for each row execute function public.facilities_guard();

-- What citizens can read: approved copies only (never drafts or unreviewed edits)
create or replace view public.public_facilities as
  select id, district, public_data as data from public.facilities where public_data is not null;
grant select on public.public_facilities to anon, authenticated;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.facilities enable row level security;
alter table public.checkins enable row level security;
alter table public.grievances enable row level security;
alter table public.ratings enable row level security;
alter table public.reviews enable row level security;
alter table public.audit enable row level security;

drop policy if exists p_profiles_read on public.profiles;
create policy p_profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists p_profiles_state on public.profiles;
create policy p_profiles_state on public.profiles for all to authenticated using (public.is_state()) with check (public.is_state());

drop policy if exists p_fac_read on public.facilities;
create policy p_fac_read on public.facilities for select to authenticated using (public.is_state() or district = public.my_district());
drop policy if exists p_fac_insert on public.facilities;
create policy p_fac_insert on public.facilities for insert to authenticated with check (public.is_state() or (public.my_role() = 'district_officer' and district = public.my_district()));
drop policy if exists p_fac_update on public.facilities;
create policy p_fac_update on public.facilities for update to authenticated using (public.is_state() or district = public.my_district()) with check (public.is_state() or district = public.my_district());
drop policy if exists p_fac_delete on public.facilities;
create policy p_fac_delete on public.facilities for delete to authenticated using (public.is_state() or (district = public.my_district() and status = 'draft'));

-- citizens may add check-ins, complaints and ratings without logging in
drop policy if exists p_ci_insert on public.checkins;
create policy p_ci_insert on public.checkins for insert to anon, authenticated with check (true);
drop policy if exists p_ci_read on public.checkins;
create policy p_ci_read on public.checkins for select to authenticated using (public.is_state() or district = public.my_district());
drop policy if exists p_ci_state on public.checkins;
create policy p_ci_state on public.checkins for delete to authenticated using (public.is_state());

drop policy if exists p_gr_insert on public.grievances;
-- citizens can only file open complaints; the State officer may also load resolved ones (demo data, imports)
create policy p_gr_insert on public.grievances for insert to anon, authenticated with check (status = 'open' or public.is_state());
drop policy if exists p_gr_read on public.grievances;
create policy p_gr_read on public.grievances for select to authenticated using (public.is_state() or district = public.my_district());
drop policy if exists p_gr_update on public.grievances;
create policy p_gr_update on public.grievances for update to authenticated using (public.is_state() or district = public.my_district());
drop policy if exists p_gr_delete on public.grievances;
create policy p_gr_delete on public.grievances for delete to authenticated using (public.is_state());

drop policy if exists p_rt_insert on public.ratings;
create policy p_rt_insert on public.ratings for insert to anon, authenticated with check (true);
drop policy if exists p_rt_read on public.ratings;
create policy p_rt_read on public.ratings for select to anon, authenticated using (true);
drop policy if exists p_rt_delete on public.ratings;
create policy p_rt_delete on public.ratings for delete to authenticated using (public.is_state());

drop policy if exists p_rv_read on public.reviews;
create policy p_rv_read on public.reviews for select to authenticated using (public.is_officer());
drop policy if exists p_rv_write on public.reviews;
create policy p_rv_write on public.reviews for all to authenticated using (public.is_state()) with check (public.is_state());

drop policy if exists p_au_read on public.audit;
create policy p_au_read on public.audit for select to authenticated using (public.is_officer());
drop policy if exists p_au_insert on public.audit;
create policy p_au_insert on public.audit for insert to authenticated with check (public.is_officer());
drop policy if exists p_au_delete on public.audit;
create policy p_au_delete on public.audit for delete to authenticated using (public.is_state());

-- ---------- photos ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists p_photos_upload on storage.objects;
create policy p_photos_upload on storage.objects for insert to anon, authenticated with check (bucket_id = 'photos');
drop policy if exists p_photos_read on storage.objects;
create policy p_photos_read on storage.objects for select to anon, authenticated using (bucket_id = 'photos');

-- ---------- live updates ----------
do $$ begin
  begin alter publication supabase_realtime add table public.facilities; exception when others then null; end;
  begin alter publication supabase_realtime add table public.grievances; exception when others then null; end;
  begin alter publication supabase_realtime add table public.reviews; exception when others then null; end;
  begin alter publication supabase_realtime add table public.checkins; exception when others then null; end;
end $$;
