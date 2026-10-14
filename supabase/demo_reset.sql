-- ============================================================
-- demo_reset.sql
-- Puts the demo back to a clean "nothing has happened yet" state.
--   * deletes all disruptions (this also deletes the notifications, assessments,
--     alternatives, itineraries and ledger rows that belong to them)
--   * restores every flight to "scheduled"
--   * refills the simulated seats to 10 per service
-- Users, bookings and connecting transport are NOT touched.
-- Note: refilling seats to 10 replaces the original seed seat counts, so the
-- "Only N seats left" tags will not appear until seats run low again.
-- ============================================================

delete from public.disruptions;

update public.flights
   set status = 'scheduled',
       estimated_departure = null,
       estimated_arrival = null,
       status_reason = null
 where status <> 'scheduled';

update public.transport_inventory set seats_available = 10;

-- OPTIONAL: also remove accounts made with the sign-up form's "Fill sample data"
-- button (emails like demo1234@example.com). Remove the two dashes to run it.
-- delete from auth.users where email like 'demo%@example.com';

-- Summary: every count should be 0 except flights (all scheduled).
select
  (select count(*) from public.disruptions)           as disruptions,
  (select count(*) from public.notifications)         as notifications,
  (select count(*) from public.alternatives)          as alternatives,
  (select count(*) from public.payments_ledger)       as ledger_rows,
  (select count(*) from public.flights where status <> 'scheduled') as flights_not_on_time;