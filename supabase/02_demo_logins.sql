-- Khel Darpan Gujarat — DEMO logins (run once, after 01_schema.sql)
-- Creates 4 officer accounts with password demo1234. For the prototype only — delete before real use.
create extension if not exists pgcrypto;

do $$
declare
  u record;
  uid uuid;
begin
  for u in select * from (values
    ('dso.ahmedabad@demo.in',   'Demo DSO Ahmedabad',   '9000000001', 'district_officer', 'ahmedabad'),
    ('dso.surat@demo.in',       'Demo DSO Surat',       '9000000004', 'district_officer', 'surat'),
    ('dso.gandhinagar@demo.in', 'Demo DSO Gandhinagar', '9000000005', 'district_officer', 'gandhinagar'),
    ('state.demo@demo.in',      'Demo State Officer',   '9000000002', 'state_officer',    null)
  ) as t(email, full_name, phone, role, district)
  loop
    select id into uid from auth.users where email = u.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', u.email, crypt('demo1234', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', u.email), 'email', uid::text, now(), now(), now());
    end if;
    insert into public.profiles (id, full_name, email, phone, role, district)
    values (uid, u.full_name, u.email, u.phone, u.role, u.district)
    on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone, role = excluded.role, district = excluded.district;
  end loop;
end $$;

-- Mobile-OTP demo: find the officer's email from a mobile number (demo only; real OTP needs an SMS provider)
create or replace function public.email_for_phone(p text) returns text language sql stable security definer set search_path = public as
$$ select email from public.profiles where phone = p and role in ('district_officer', 'state_officer') limit 1 $$;
grant execute on function public.email_for_phone(text) to anon, authenticated;
