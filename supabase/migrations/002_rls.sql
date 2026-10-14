-- ============================================================
-- 002_rls.sql
-- Row Level Security policies and permissions.
-- Run this SECOND.
-- Rules:
--   * Passengers see only their own rows.
--   * Staff see only flights/passengers connected to THEIR airport.
--   * All writes go through RPC functions or Edge Functions (service role).
-- ============================================================

-- ---------- 1. TABLE PERMISSIONS ----------
-- Start from zero, then grant only what the app needs.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to authenticated;   -- RLS decides which rows
grant update (full_name, phone) on public.profiles to authenticated;  -- NOT role / airport_code
grant update (is_read) on public.notifications to authenticated;

grant all on all tables in schema public to service_role;       -- Edge Functions

-- ---------- 2. FUNCTION PERMISSIONS ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to service_role;

grant execute on function public.my_role() to authenticated;
grant execute on function public.my_airport() to authenticated;
grant execute on function public.is_staff_for_flight(uuid) to authenticated;
grant execute on function public.user_has_booking_on_flight(uuid) to authenticated;
grant execute on function public.owns_booking(uuid) to authenticated;
grant execute on function public.staff_can_see_booking(uuid) to authenticated;
grant execute on function public.staff_can_see_user(uuid) to authenticated;
grant execute on function public.create_passenger_trip(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mark_flight_disruption(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.simulate_random_disruption() to authenticated;
grant execute on function public.reset_flight_status(uuid) to authenticated;
grant execute on function public.accept_alternative(uuid) to authenticated;

-- ---------- 3. POLICIES ----------

-- profiles: see yourself; staff also see passengers on their airport's flights.
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: staff read their passengers"
  on public.profiles for select to authenticated
  using (public.staff_can_see_user(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- flights: staff see flights touching their airport; passengers see flights they are booked on.
create policy "flights: staff or booked passenger read"
  on public.flights for select to authenticated
  using (public.is_staff_for_flight(id) or public.user_has_booking_on_flight(id));

-- passenger_bookings
create policy "bookings: own or staff read"
  on public.passenger_bookings for select to authenticated
  using (user_id = auth.uid() or public.is_staff_for_flight(flight_id));

-- connecting_transport
create policy "connecting: own or staff read"
  on public.connecting_transport for select to authenticated
  using (public.owns_booking(booking_id) or public.staff_can_see_booking(booking_id));

-- disruptions
create policy "disruptions: staff or booked passenger read"
  on public.disruptions for select to authenticated
  using (public.is_staff_for_flight(flight_id) or public.user_has_booking_on_flight(flight_id));

-- notifications: only your own; you may mark them read.
create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications: update own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- transport_inventory: any logged-in user may read the (simulated) catalogue.
create policy "inventory: read for signed-in users"
  on public.transport_inventory for select to authenticated
  using (true);

-- AI outputs: only the passenger who owns the booking.
create policy "assessments: own read"
  on public.recovery_assessments for select to authenticated
  using (public.owns_booking(booking_id));

create policy "alternatives: own read"
  on public.alternatives for select to authenticated
  using (public.owns_booking(booking_id));

create policy "itineraries: own read"
  on public.recovery_itineraries for select to authenticated
  using (public.owns_booking(booking_id));

-- payments_ledger: passenger sees own; staff see ledger rows for their airport's flights.
create policy "ledger: own or staff read"
  on public.payments_ledger for select to authenticated
  using (user_id = auth.uid() or public.staff_can_see_booking(booking_id));