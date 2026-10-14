-- ============================================================
-- 001_schema.sql
-- Tables, indexes, helper functions, RPCs, sign-up trigger.
-- Run this FIRST.
-- ============================================================

-- ---------- 1. TABLES ----------

-- One row per auth user. Created automatically by a trigger (see below).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text not null default 'passenger' check (role in ('passenger', 'staff')),
  airport_code text,                       -- only used for staff (e.g. 'DEL')
  created_at timestamptz not null default now(),
  constraint staff_needs_airport check (role <> 'staff' or airport_code is not null)
);

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  flight_number text not null,
  airline text not null,
  origin_code text not null,               -- IATA code, e.g. DEL
  origin_city text not null,
  destination_code text not null,
  destination_city text not null,
  scheduled_departure timestamptz not null,
  scheduled_arrival timestamptz not null,
  estimated_departure timestamptz,         -- filled when delayed
  estimated_arrival timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'delayed', 'cancelled')),
  status_reason text,
  gate text,
  created_at timestamptz not null default now(),
  constraint flights_times_ok check (scheduled_arrival > scheduled_departure)
);

-- A passenger's booking on a flight, plus their recovery constraints.
create table public.passenger_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  flight_id uuid not null references public.flights (id) on delete cascade,
  pnr text,
  seat text,
  -- constraints used by the AI agent:
  max_budget_inr integer not null check (max_budget_inr >= 0),
  latest_arrival timestamptz not null,
  preferred_modes text[] not null default array['flight', 'train', 'bus'],
  final_destination text not null,         -- city name, e.g. 'Pune'
  created_at timestamptz not null default now(),
  unique (user_id, flight_id)
);

-- The onward bus / train / flight the passenger has already booked.
create table public.connecting_transport (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.passenger_bookings (id) on delete cascade,
  transport_type text not null check (transport_type in ('bus', 'train', 'flight')),
  transport_name text not null,            -- number or name
  departure_location text not null,
  departure_time timestamptz not null,
  destination text not null,
  ticket_reference text,
  created_at timestamptz not null default now()
);

-- Created when staff mark a flight delayed or cancelled.
create table public.disruptions (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references public.flights (id) on delete cascade,
  type text not null check (type in ('delay', 'cancellation')),
  delay_minutes integer,
  new_departure timestamptz,
  new_arrival timestamptz,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One notification per affected passenger. Realtime listens to this table.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.passenger_bookings (id) on delete cascade,
  disruption_id uuid references public.disruptions (id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- SIMULATED inventory of alternatives. Times are daily recurring (time of day).
create table public.transport_inventory (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('flight', 'train', 'bus')),
  carrier text not null,
  service_number text not null,
  origin_city text not null,
  origin_hub text not null,                -- airport / station / bus stand
  destination_city text not null,
  destination_hub text not null,
  departure_time time not null,            -- time of day, IST
  duration_minutes integer not null check (duration_minutes > 0),
  price_inr integer not null check (price_inr >= 0),
  seats_available integer not null check (seats_available >= 0),
  travel_class text,
  boarding_point text,                     -- e.g. 'Gate B12', 'Platform 4'
  boarding_offset_minutes integer not null default 30,  -- be at boarding point this long before departure
  is_simulated boolean not null default true,
  unique (service_number, origin_city, destination_city, departure_time)
);

-- Priority score for one passenger in one disruption (written by the AI function).
create table public.recovery_assessments (
  id uuid primary key default gen_random_uuid(),
  disruption_id uuid not null references public.disruptions (id) on delete cascade,
  booking_id uuid not null references public.passenger_bookings (id) on delete cascade,
  priority_score integer not null check (priority_score between 0 and 100),
  priority_level text not null check (priority_level in ('High', 'Medium', 'Low')),
  explanation text,
  factors jsonb not null default '{}'::jsonb,
  source text not null default 'rule_based' check (source in ('llm', 'rule_based')),
  created_at timestamptz not null default now(),
  unique (disruption_id, booking_id)
);

-- The ranked options shown to the passenger (and the one they accept).
create table public.alternatives (
  id uuid primary key default gen_random_uuid(),
  disruption_id uuid not null references public.disruptions (id) on delete cascade,
  booking_id uuid not null references public.passenger_bookings (id) on delete cascade,
  inventory_id uuid not null references public.transport_inventory (id),
  rank integer not null default 1,
  score numeric(6, 2),
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  price_inr integer not null,
  reasoning text,
  source text not null default 'rule_based' check (source in ('llm', 'rule_based')),
  status text not null default 'suggested'
    check (status in ('suggested', 'accepted', 'rejected', 'superseded')),
  booking_reference text,                  -- set when accepted
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recovery_itineraries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.passenger_bookings (id) on delete cascade,
  disruption_id uuid not null references public.disruptions (id) on delete cascade,
  alternative_id uuid not null unique references public.alternatives (id) on delete cascade,
  summary text,
  steps jsonb not null default '[]'::jsonb,   -- [{time, title, detail, type}, ...]
  source text not null default 'rule_based' check (source in ('llm', 'rule_based')),
  created_at timestamptz not null default now()
);

-- NO real payment. Fares are only recorded here, to be settled later.
create table public.payments_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid not null references public.passenger_bookings (id) on delete cascade,
  alternative_id uuid not null unique references public.alternatives (id) on delete cascade,
  amount_inr integer not null check (amount_inr >= 0),
  status text not null default 'pending_settlement'
    check (status in ('pending_settlement', 'settled', 'cancelled')),
  settle_with text not null default 'Airport Authority',
  reference text,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- 2. INDEXES ----------
create index idx_flights_origin on public.flights (origin_code);
create index idx_flights_destination on public.flights (destination_code);
create index idx_flights_departure on public.flights (scheduled_departure);
create index idx_bookings_user on public.passenger_bookings (user_id);
create index idx_bookings_flight on public.passenger_bookings (flight_id);
create index idx_connecting_booking on public.connecting_transport (booking_id);
create index idx_disruptions_flight on public.disruptions (flight_id);
create index idx_notifications_user on public.notifications (user_id, is_read, created_at desc);
create index idx_inventory_route on public.transport_inventory (origin_city, destination_city, mode);
create index idx_alternatives_booking on public.alternatives (booking_id, disruption_id);
create index idx_assessments_booking on public.recovery_assessments (booking_id);
create index idx_itineraries_booking on public.recovery_itineraries (booking_id);
create index idx_ledger_user on public.payments_ledger (user_id);
create index idx_ledger_booking on public.payments_ledger (booking_id);

-- ---------- 3. HELPER FUNCTIONS (used by RLS policies) ----------
-- They are SECURITY DEFINER so they can read tables without triggering
-- RLS again (this avoids "infinite recursion" errors in policies).

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_airport()
returns text language sql stable security definer set search_path = public as $$
  select airport_code from public.profiles where id = auth.uid()
$$;

-- True if the caller is staff and the flight touches their airport.
create or replace function public.is_staff_for_flight(p_flight_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.flights f
    join public.profiles p on p.id = auth.uid()
    where f.id = p_flight_id
      and p.role = 'staff'
      and p.airport_code is not null
      and (f.origin_code = p.airport_code or f.destination_code = p.airport_code)
  )
$$;

-- True if the caller has a booking on this flight.
create or replace function public.user_has_booking_on_flight(p_flight_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.passenger_bookings b
    where b.flight_id = p_flight_id and b.user_id = auth.uid()
  )
$$;

create or replace function public.owns_booking(p_booking_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.passenger_bookings b
    where b.id = p_booking_id and b.user_id = auth.uid()
  )
$$;

create or replace function public.staff_can_see_booking(p_booking_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.passenger_bookings b
    where b.id = p_booking_id and public.is_staff_for_flight(b.flight_id)
  )
$$;

create or replace function public.staff_can_see_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.passenger_bookings b
    where b.user_id = p_user_id and public.is_staff_for_flight(b.flight_id)
  )
$$;

-- ---------- 4. SIGN-UP TRIGGER ----------
-- Creates a profile row for every new auth user.
-- The role is ALWAYS 'passenger' here (staff are promoted by SQL only).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    'passenger'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 5. RPCs (called from the frontend with supabase.rpc) ----------

-- 5a. Passenger sign-up: creates (or joins) the flight, the booking and the
-- connecting transport in one transaction.
-- JSON keys expected:
--   p_flight:      flight_number, airline, origin_code, origin_city, destination_code,
--                  destination_city, scheduled_departure, scheduled_arrival, seat, pnr
--   p_connection:  type, name, departure_location, departure_time, destination, ticket_reference
--   p_constraints: max_budget_inr, latest_arrival, preferred_modes (array), final_destination
create or replace function public.create_passenger_trip(
  p_flight jsonb,
  p_connection jsonb,
  p_constraints jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dep timestamptz := (p_flight ->> 'scheduled_departure')::timestamptz;
  v_arr timestamptz := (p_flight ->> 'scheduled_arrival')::timestamptz;
  v_flight_id uuid;
  v_booking_id uuid;
  v_modes text[];
begin
  if v_uid is null then
    raise exception 'You must be signed in';
  end if;
  if public.my_role() is distinct from 'passenger' then
    raise exception 'Only passengers can create trips';
  end if;
  if v_dep is null or v_arr is null or v_arr <= v_dep then
    raise exception 'Flight arrival must be after departure';
  end if;

  -- Join an existing flight (same number, same day in IST) or create it.
  select id into v_flight_id
  from public.flights
  where flight_number = upper(trim(p_flight ->> 'flight_number'))
    and (scheduled_departure at time zone 'Asia/Kolkata')::date
        = (v_dep at time zone 'Asia/Kolkata')::date
  limit 1;

  if v_flight_id is null then
    insert into public.flights (
      flight_number, airline, origin_code, origin_city,
      destination_code, destination_city, scheduled_departure, scheduled_arrival, gate
    ) values (
      upper(trim(p_flight ->> 'flight_number')), p_flight ->> 'airline',
      upper(trim(p_flight ->> 'origin_code')), p_flight ->> 'origin_city',
      upper(trim(p_flight ->> 'destination_code')), p_flight ->> 'destination_city',
      v_dep, v_arr, 'TBA'
    ) returning id into v_flight_id;
  end if;

  v_modes := array(select jsonb_array_elements_text(p_constraints -> 'preferred_modes'));
  if coalesce(array_length(v_modes, 1), 0) = 0 then
    v_modes := array['flight', 'train', 'bus'];
  end if;

  insert into public.passenger_bookings (
    user_id, flight_id, pnr, seat, max_budget_inr, latest_arrival, preferred_modes, final_destination
  ) values (
    v_uid, v_flight_id, upper(trim(p_flight ->> 'pnr')), p_flight ->> 'seat',
    (p_constraints ->> 'max_budget_inr')::int,
    (p_constraints ->> 'latest_arrival')::timestamptz,
    v_modes,
    p_constraints ->> 'final_destination'
  ) returning id into v_booking_id;

  insert into public.connecting_transport (
    booking_id, transport_type, transport_name, departure_location,
    departure_time, destination, ticket_reference
  ) values (
    v_booking_id, p_connection ->> 'type', p_connection ->> 'name',
    p_connection ->> 'departure_location',
    (p_connection ->> 'departure_time')::timestamptz,
    p_connection ->> 'destination', p_connection ->> 'ticket_reference'
  );

  return v_booking_id;
end;
$$;

-- 5b. Staff: mark a flight delayed or cancelled. Creates the disruption and one
-- notification for every passenger booked on that flight.
create or replace function public.mark_flight_disruption(
  p_flight_id uuid,
  p_type text,                              -- 'delay' or 'cancellation'
  p_new_departure timestamptz default null, -- required for delays
  p_reason text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_flight public.flights%rowtype;
  v_disruption_id uuid;
  v_delay integer := null;
  v_new_arrival timestamptz := null;
  v_title text;
  v_msg text;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Operational reasons');
begin
  if not public.is_staff_for_flight(p_flight_id) then
    raise exception 'Only staff of this flight airport can do this';
  end if;
  if p_type not in ('delay', 'cancellation') then
    raise exception 'Invalid disruption type';
  end if;

  select * into v_flight from public.flights where id = p_flight_id for update;
  if v_flight.status = 'cancelled' then
    raise exception 'This flight is already cancelled';
  end if;

  if p_type = 'delay' then
    if p_new_departure is null or p_new_departure <= v_flight.scheduled_departure then
      raise exception 'New departure must be later than the scheduled departure';
    end if;
    v_delay := round(extract(epoch from (p_new_departure - v_flight.scheduled_departure)) / 60)::int;
    v_new_arrival := v_flight.scheduled_arrival + (p_new_departure - v_flight.scheduled_departure);

    update public.flights
       set status = 'delayed',
           estimated_departure = p_new_departure,
           estimated_arrival = v_new_arrival,
           status_reason = v_reason
     where id = p_flight_id;

    v_title := 'Flight ' || v_flight.flight_number || ' delayed';
    v_msg := 'Your flight ' || v_flight.flight_number || ' (' || v_flight.origin_code || ' to '
          || v_flight.destination_code || ') is delayed by ' || (v_delay / 60) || 'h ' || (v_delay % 60)
          || 'm. New departure: ' || to_char(p_new_departure at time zone 'Asia/Kolkata', 'HH24:MI')
          || ' IST. Reason: ' || v_reason || '. Open your dashboard to see recovery options.';
  else
    update public.flights
       set status = 'cancelled',
           estimated_departure = null,
           estimated_arrival = null,
           status_reason = v_reason
     where id = p_flight_id;

    v_title := 'Flight ' || v_flight.flight_number || ' cancelled';
    v_msg := 'Your flight ' || v_flight.flight_number || ' (' || v_flight.origin_code || ' to '
          || v_flight.destination_code || ') has been cancelled. Reason: ' || v_reason
          || '. Open your dashboard to see recovery options.';
  end if;

  insert into public.disruptions (flight_id, type, delay_minutes, new_departure, new_arrival, reason, created_by)
  values (p_flight_id, p_type, v_delay, case when p_type = 'delay' then p_new_departure end,
          v_new_arrival, v_reason, auth.uid())
  returning id into v_disruption_id;

  insert into public.notifications (user_id, booking_id, disruption_id, title, message)
  select b.user_id, b.id, v_disruption_id, v_title, v_msg
  from public.passenger_bookings b
  where b.flight_id = p_flight_id;

  return v_disruption_id;
end;
$$;

-- 5c. Staff: pick a random scheduled flight at their airport and disrupt it (for demos).
create or replace function public.simulate_random_disruption()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_airport text;
  v_flight public.flights%rowtype;
  v_reasons text[] := array[
    'Air traffic congestion', 'Bad weather', 'Technical check on aircraft',
    'Late arrival of incoming aircraft', 'Crew availability'
  ];
  v_reason text;
  v_minutes integer;
begin
  if public.my_role() is distinct from 'staff' then
    raise exception 'Only staff can simulate disruptions';
  end if;
  v_airport := public.my_airport();

  -- Prefer flights that actually have passengers.
  select f.* into v_flight
  from public.flights f
  where f.status = 'scheduled'
    and (f.origin_code = v_airport or f.destination_code = v_airport)
  order by (exists (select 1 from public.passenger_bookings b where b.flight_id = f.id)) desc,
           random()
  limit 1;

  if not found then
    raise exception 'No scheduled flights left to disrupt. Use Restore on a flight first.';
  end if;

  v_reason := v_reasons[1 + floor(random() * array_length(v_reasons, 1))::int];

  if random() < 0.7 then
    v_minutes := (6 + floor(random() * 11))::int * 15;   -- 90 to 240 minutes
    return public.mark_flight_disruption(
      v_flight.id, 'delay',
      v_flight.scheduled_departure + make_interval(mins => v_minutes), v_reason);
  else
    return public.mark_flight_disruption(v_flight.id, 'cancellation', null, v_reason);
  end if;
end;
$$;

-- 5d. Staff: put a flight back to "scheduled" (demo helper).
create or replace function public.reset_flight_status(p_flight_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_for_flight(p_flight_id) then
    raise exception 'Not allowed';
  end if;
  update public.flights
     set status = 'scheduled', estimated_departure = null,
         estimated_arrival = null, status_reason = null
   where id = p_flight_id;
end;
$$;

-- 5e. Passenger: accept an alternative. Reserves a seat, creates the booking
-- reference and records the fare as "pending_settlement". NO real payment.
-- Must be called with the PASSENGER's JWT (it uses auth.uid()).
create or replace function public.accept_alternative(p_alternative_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_alt public.alternatives%rowtype;
  v_seats integer;
  v_ref text;
begin
  select * into v_alt from public.alternatives where id = p_alternative_id for update;
  if not found or not public.owns_booking(v_alt.booking_id) then
    raise exception 'Option not found';
  end if;

  if v_alt.status = 'accepted' then
    return jsonb_build_object('alternative_id', v_alt.id,
                              'booking_reference', v_alt.booking_reference,
                              'already_accepted', true);
  end if;
  if v_alt.status <> 'suggested' then
    raise exception 'This option is no longer available';
  end if;
  if exists (select 1 from public.alternatives
             where booking_id = v_alt.booking_id and disruption_id = v_alt.disruption_id
               and status = 'accepted') then
    raise exception 'You have already accepted an option for this disruption';
  end if;

  select seats_available into v_seats
  from public.transport_inventory where id = v_alt.inventory_id for update;
  if v_seats is null or v_seats < 1 then
    raise exception 'Sorry, no seats are left on this option';
  end if;

  update public.transport_inventory set seats_available = seats_available - 1
   where id = v_alt.inventory_id;

  v_ref := 'REC-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));

  update public.alternatives
     set status = 'accepted', booking_reference = v_ref, accepted_at = now()
   where id = v_alt.id;

  update public.alternatives
     set status = 'superseded'
   where booking_id = v_alt.booking_id and disruption_id = v_alt.disruption_id
     and id <> v_alt.id and status = 'suggested';

  insert into public.payments_ledger (user_id, booking_id, alternative_id, amount_inr, status, reference, note)
  values (auth.uid(), v_alt.booking_id, v_alt.id, v_alt.price_inr, 'pending_settlement', v_ref,
          'Simulated fare. To be settled with the airport authority later. No real payment taken.');

  return jsonb_build_object('alternative_id', v_alt.id, 'booking_reference', v_ref,
                            'already_accepted', false);
end;
$$;

-- ---------- 6. TURN ON ROW LEVEL SECURITY ----------
-- (Policies are in 002_rls.sql. With RLS on and no policy, access is denied.)
alter table public.profiles             enable row level security;
alter table public.flights              enable row level security;
alter table public.passenger_bookings   enable row level security;
alter table public.connecting_transport enable row level security;
alter table public.disruptions          enable row level security;
alter table public.notifications        enable row level security;
alter table public.transport_inventory  enable row level security;
alter table public.recovery_assessments enable row level security;
alter table public.alternatives         enable row level security;
alter table public.recovery_itineraries enable row level security;
alter table public.payments_ledger      enable row level security;

-- ---------- 7. REALTIME ----------
-- Lets the browser subscribe to new notifications and flight status changes.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'flights') then
    alter publication supabase_realtime add table public.flights;
  end if;
end $$;