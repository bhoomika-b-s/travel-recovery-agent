-- ============================================================
-- smoke_check.sql
-- Quick health check of the database. Run each numbered block on its own.
-- ============================================================

-- 1) Row counts. Expect: profiles 12+, flights 10+, bookings 10+, connecting 10+, inventory 48.
select
  (select count(*) from public.profiles)             as profiles,
  (select count(*) from public.flights)              as flights,
  (select count(*) from public.passenger_bookings)   as bookings,
  (select count(*) from public.connecting_transport) as connecting,
  (select count(*) from public.transport_inventory)  as inventory;

-- 2) Row Level Security must be ON for every table. Expect rls_on = true on all rows.
select c.relname as table_name, c.relrowsecurity as rls_on
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by c.relname;

-- 3) Realtime tables. Expect: flights and notifications.
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;

-- 4) The column added by migration 004. Expect one row: score_breakdown.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'alternatives' and column_name = 'score_breakdown';

-- 5) The staff accounts. Expect staff.bom@example.com (BOM) and staff.del@example.com (DEL).
select email, role, airport_code from public.profiles where role = 'staff' order by email;

-- 6) RLS test as PASSENGER 1. Expect: my_bookings 1, my_flights 1, visible_profiles 1.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select
  (select count(*) from public.passenger_bookings) as my_bookings,
  (select count(*) from public.flights)            as my_flights,
  (select count(*) from public.profiles)           as visible_profiles;
rollback;

-- 7) RLS test as DELHI STAFF. Expect: bookings 8, flights 7, visible_profiles 9.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select
  (select count(*) from public.passenger_bookings) as bookings,
  (select count(*) from public.flights)            as flights,
  (select count(*) from public.profiles)           as visible_profiles;
rollback;

-- 8) RLS test as MUMBAI STAFF. Expect: bookings 6, flights 7, visible_profiles 7.
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select
  (select count(*) from public.passenger_bookings) as bookings,
  (select count(*) from public.flights)            as flights,
  (select count(*) from public.profiles)           as visible_profiles;
rollback;