-- ============================================================
-- 003_seed.sql
-- Demo data: 2 staff, 10 passengers, 10 flights, 48 simulated transport options.
-- Run this THIRD. Safe to run twice (it skips rows that already exist).
--
-- DEMO LOGIN (all accounts): password  Demo@1234
--   staff.del@example.com   -> Delhi (DEL) staff
--   staff.bom@example.com   -> Mumbai (BOM) staff
--   passenger1@example.com ... passenger10@example.com
-- ============================================================

-- ---------- 1. USERS ----------
-- Inserting into auth.users fires the profile trigger automatically.
do $$
declare
  r record;
  v_pw text := extensions.crypt('Demo@1234', extensions.gen_salt('bf'));
begin
  for r in
    select * from (values
      ('a0000000-0000-0000-0000-000000000001'::uuid, 'staff.del@example.com', 'Delhi Airport Staff', '+91 98100 10001'),
      ('a0000000-0000-0000-0000-000000000002'::uuid, 'staff.bom@example.com', 'Mumbai Airport Staff', '+91 98200 10002'),
      ('a1000000-0000-0000-0000-000000000001'::uuid, 'passenger1@example.com',  'Aarav Sharma', '+91 98100 20001'),
      ('a1000000-0000-0000-0000-000000000002'::uuid, 'passenger2@example.com',  'Diya Patel',   '+91 98100 20002'),
      ('a1000000-0000-0000-0000-000000000003'::uuid, 'passenger3@example.com',  'Rohan Mehta',  '+91 98100 20003'),
      ('a1000000-0000-0000-0000-000000000004'::uuid, 'passenger4@example.com',  'Ananya Iyer',  '+91 98100 20004'),
      ('a1000000-0000-0000-0000-000000000005'::uuid, 'passenger5@example.com',  'Kabir Singh',  '+91 98100 20005'),
      ('a1000000-0000-0000-0000-000000000006'::uuid, 'passenger6@example.com',  'Meera Nair',   '+91 98100 20006'),
      ('a1000000-0000-0000-0000-000000000007'::uuid, 'passenger7@example.com',  'Arjun Reddy',  '+91 98100 20007'),
      ('a1000000-0000-0000-0000-000000000008'::uuid, 'passenger8@example.com',  'Isha Kapoor',  '+91 98100 20008'),
      ('a1000000-0000-0000-0000-000000000009'::uuid, 'passenger9@example.com',  'Vikram Joshi', '+91 98100 20009'),
      ('a1000000-0000-0000-0000-000000000010'::uuid, 'passenger10@example.com', 'Sneha Rao',    '+91 98100 20010')
    ) as t(id, email, full_name, phone)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.email, v_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name, 'phone', r.phone),
      now(), now(), '', '', '', '', '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, r.id::text, 'email',
      jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
      now(), now(), now()
    ) on conflict do nothing;
  end loop;
end $$;

-- Promote the two staff users (the trigger created them as passengers).
update public.profiles set role = 'staff', airport_code = 'DEL'
 where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set role = 'staff', airport_code = 'BOM'
 where id = 'a0000000-0000-0000-0000-000000000002';

-- ---------- 2. FLIGHTS, BOOKINGS, CONNECTING TRANSPORT ----------
-- All times are "today" in IST, so the demo always looks current.
do $$
declare
  v_day timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  insert into public.flights
    (id, flight_number, airline, origin_code, origin_city, destination_code, destination_city,
     scheduled_departure, scheduled_arrival, gate)
  values
    ('f0000000-0000-0000-0000-000000000001', '6E-2041', 'IndiGo',            'DEL', 'Delhi',  'BOM', 'Mumbai',    v_day + interval '9 hours',         v_day + interval '11 hours 10 minutes', 'A4'),
    ('f0000000-0000-0000-0000-000000000002', 'AI-805',  'Air India',         'DEL', 'Delhi',  'BLR', 'Bengaluru', v_day + interval '10 hours 30 minutes', v_day + interval '13 hours 15 minutes', 'B7'),
    ('f0000000-0000-0000-0000-000000000003', 'QP-1301', 'Akasa Air',         'DEL', 'Delhi',  'HYD', 'Hyderabad', v_day + interval '12 hours 15 minutes', v_day + interval '14 hours 25 minutes', 'C2'),
    ('f0000000-0000-0000-0000-000000000004', '6E-6402', 'IndiGo',            'DEL', 'Delhi',  'PNQ', 'Pune',      v_day + interval '14 hours',        v_day + interval '16 hours 10 minutes', 'A9'),
    ('f0000000-0000-0000-0000-000000000005', '6E-6115', 'IndiGo',            'BOM', 'Mumbai', 'DEL', 'Delhi',     v_day + interval '8 hours 30 minutes',  v_day + interval '10 hours 35 minutes', 'D3'),
    ('f0000000-0000-0000-0000-000000000006', 'AI-639',  'Air India',         'BOM', 'Mumbai', 'BLR', 'Bengaluru', v_day + interval '11 hours',        v_day + interval '12 hours 40 minutes', 'E5'),
    ('f0000000-0000-0000-0000-000000000007', '6E-5382', 'IndiGo',            'BOM', 'Mumbai', 'GOI', 'Goa',       v_day + interval '13 hours 30 minutes', v_day + interval '14 hours 35 minutes', 'D8'),
    ('f0000000-0000-0000-0000-000000000008', 'IX-1296', 'Air India Express', 'BOM', 'Mumbai', 'MAA', 'Chennai',   v_day + interval '15 hours 15 minutes', v_day + interval '17 hours',            'E1'),
    ('f0000000-0000-0000-0000-000000000009', '6E-2194', 'IndiGo',            'DEL', 'Delhi',  'BOM', 'Mumbai',    v_day + interval '18 hours 30 minutes', v_day + interval '20 hours 40 minutes', 'A6'),
    ('f0000000-0000-0000-0000-000000000010', 'AI-864',  'Air India',         'BOM', 'Mumbai', 'DEL', 'Delhi',     v_day + interval '19 hours 30 minutes', v_day + interval '21 hours 40 minutes', 'D6')
  on conflict (id) do nothing;

  -- One booking per passenger, with their recovery constraints.
  insert into public.passenger_bookings
    (id, user_id, flight_id, pnr, seat, max_budget_inr, latest_arrival, preferred_modes, final_destination)
  values
    ('b0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'AB12CD', '14A',  7000, v_day + interval '18 hours',            array['flight','train','bus'], 'Pune'),
    ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'EF34GH', '14B',  9000, v_day + interval '20 hours',            array['flight','train'],       'Goa'),
    ('b0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', 'IJ56KL', '8C',   8000, v_day + interval '22 hours',            array['flight','train'],       'Chennai'),
    ('b0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', 'MN78OP', '21F',  5000, v_day + interval '1 day 8 hours',       array['bus','train','flight'], 'Hyderabad'),
    ('b0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003', 'QR90ST', '5D',  10000, v_day + interval '23 hours 30 minutes', array['flight','train'],       'Bengaluru'),
    ('b0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000004', 'UV12WX', '12A',  5200, v_day + interval '23 hours',            array['bus','train','flight'], 'Mumbai'),
    ('b0000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000005', 'YZ34AB', '3A',   8000, v_day + interval '19 hours',            array['flight','train'],       'Jaipur'),
    ('b0000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000010', 'CD56EF', '17C',  7000, v_day + interval '1 day 20 hours',      array['bus','train','flight'], 'Jaipur'),
    ('b0000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000006', 'GH78IJ', '9E',   6500, v_day + interval '23 hours 30 minutes', array['bus','train','flight'], 'Chennai'),
    ('b0000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000007', 'KL90MN', '2B',   4500, v_day + interval '1 day 8 hours',       array['bus','train','flight'], 'Goa')
  on conflict (id) do nothing;

  -- The onward transport each passenger already holds.
  insert into public.connecting_transport
    (id, booking_id, transport_type, transport_name, departure_location, departure_time, destination, ticket_reference)
  values
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'bus',    'MSRTC Shivneri 1245',          'Mumbai Airport T2 Bus Bay', v_day + interval '12 hours 45 minutes', 'Pune',      'MSRTC-88231'),
    ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'flight', '6E-6341 (IndiGo)',             'Mumbai Airport T1',         v_day + interval '13 hours 45 minutes', 'Goa',       'TKT-6E6341-X9'),
    ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'train',  '12028 Shatabdi Express',       'KSR Bengaluru City Jn',     v_day + interval '15 hours',            'Chennai',   'PNR-4521098763'),
    ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'bus',    'VRL Travels Sleeper',          'Majestic Bus Stand',        v_day + interval '19 hours 30 minutes', 'Hyderabad', 'VRL-5560123'),
    ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'train',  '12785 Bengaluru Express',      'Kacheguda Station',         v_day + interval '17 hours 30 minutes', 'Bengaluru', 'PNR-2831904455'),
    ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 'bus',    'MSRTC Shivneri Pune-Mumbai',   'Pune Airport Bus Bay',      v_day + interval '17 hours 30 minutes', 'Mumbai',    'MSRTC-70412'),
    ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'train',  '12413 Jaipur SF Express',      'New Delhi (NDLS)',          v_day + interval '12 hours 20 minutes', 'Jaipur',    'PNR-6103884021'),
    ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', 'bus',    'RSRTC Volvo Delhi-Jaipur',     'Kashmere Gate ISBT',        v_day + interval '23 hours 30 minutes', 'Jaipur',    'RSRTC-33907'),
    ('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009', 'bus',    'KPN Travels Multi-Axle',       'Majestic Bus Stand',        v_day + interval '15 hours',            'Chennai',   'KPN-912045'),
    ('c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010', 'bus',    'Kadamba KTCL Airport Shuttle', 'Goa Airport Bus Stop',      v_day + interval '15 hours 30 minutes', 'Goa',       'KTCL-120874')
  on conflict (id) do nothing;
end $$;

-- ---------- 3. SIMULATED TRANSPORT INVENTORY (48 options) ----------
-- Times are daily-recurring, IST. ALL OF THIS IS SIMULATED DATA.
insert into public.transport_inventory
  (mode, carrier, service_number, origin_city, origin_hub, destination_city, destination_hub,
   departure_time, duration_minutes, price_inr, seats_available, travel_class, boarding_point, boarding_offset_minutes)
values
  -- Delhi -> Pune
  ('flight','IndiGo','6E-2711','Delhi','DEL T3 (IGI Airport)','Pune','Pune Airport (PNQ)','12:20',130,5900,12,'Economy','Gate A12',45),
  ('flight','Air India Express','IX-1123','Delhi','DEL T3 (IGI Airport)','Pune','Pune Airport (PNQ)','13:40',135,6300,5,'Economy','Gate B3',45),
  ('flight','Akasa Air','QP-1507','Delhi','DEL T3 (IGI Airport)','Pune','Pune Airport (PNQ)','15:05',130,5400,18,'Economy','Gate C6',45),
  ('flight','IndiGo','6E-2093','Delhi','DEL T3 (IGI Airport)','Pune','Pune Airport (PNQ)','18:10',130,4900,22,'Economy','Gate A15',45),
  ('train','Indian Railways','12263 Pune Duronto','Delhi','Hazrat Nizamuddin (NZM)','Pune','Pune Jn (PUNE)','11:30',1260,2350,24,'AC 3-tier','Platform 4',15),
  -- Delhi -> Goa
  ('flight','IndiGo','6E-2231','Delhi','DEL T3 (IGI Airport)','Goa','Goa Airport (GOI)','11:40',165,7200,3,'Economy','Gate A7',45),
  ('flight','SpiceJet','SG-8321','Delhi','DEL T3 (IGI Airport)','Goa','Goa Airport (GOI)','13:10',160,7650,8,'Economy','Gate B10',45),
  ('flight','Air India','AI-883','Delhi','DEL T3 (IGI Airport)','Goa','Goa Airport (GOI)','15:30',165,8100,10,'Economy','Gate C4',45),
  ('flight','Akasa Air','QP-1411','Delhi','DEL T3 (IGI Airport)','Goa','Goa Airport (GOI)','17:50',165,6800,15,'Economy','Gate A11',45),
  ('train','Indian Railways','22414 Goa Rajdhani','Delhi','Hazrat Nizamuddin (NZM)','Goa','Madgaon (MAO)','15:20',1560,3900,30,'AC 3-tier','Platform 6',15),
  -- Delhi -> Chennai
  ('flight','IndiGo','6E-2503','Delhi','DEL T3 (IGI Airport)','Chennai','Chennai Airport (MAA)','11:00',175,6200,11,'Economy','Gate A5',45),
  ('flight','Air India','AI-540','Delhi','DEL T3 (IGI Airport)','Chennai','Chennai Airport (MAA)','13:30',175,7400,7,'Economy','Gate B9',45),
  ('flight','IndiGo','6E-5171','Delhi','DEL T3 (IGI Airport)','Chennai','Chennai Airport (MAA)','16:30',175,5900,20,'Economy','Gate A14',45),
  ('flight','SpiceJet','SG-8935','Delhi','DEL T3 (IGI Airport)','Chennai','Chennai Airport (MAA)','20:30',175,5200,25,'Economy','Gate C8',45),
  ('train','Indian Railways','12433 Chennai Rajdhani','Delhi','Hazrat Nizamuddin (NZM)','Chennai','Chennai Central (MAS)','15:30',1680,4100,14,'AC 3-tier','Platform 8',15),
  -- Delhi -> Hyderabad
  ('flight','IndiGo','6E-2811','Delhi','DEL T3 (IGI Airport)','Hyderabad','Hyderabad Airport (HYD)','12:00',130,4700,9,'Economy','Gate A3',45),
  ('flight','Akasa Air','QP-1311','Delhi','DEL T3 (IGI Airport)','Hyderabad','Hyderabad Airport (HYD)','14:40',135,4350,6,'Economy','Gate C1',45),
  ('flight','Air India','AI-559','Delhi','DEL T3 (IGI Airport)','Hyderabad','Hyderabad Airport (HYD)','18:20',135,5900,4,'Economy','Gate B12',45),
  ('flight','IndiGo','6E-2915','Delhi','DEL T3 (IGI Airport)','Hyderabad','Hyderabad Airport (HYD)','21:05',130,4100,14,'Economy','Gate A8',45),
  ('train','Indian Railways','12723 Telangana Express','Delhi','Hazrat Nizamuddin (NZM)','Hyderabad','Secunderabad (SC)','06:50',1650,1750,40,'AC 3-tier','Platform 7',15),
  -- Delhi -> Bengaluru
  ('flight','IndiGo','6E-2703','Delhi','DEL T3 (IGI Airport)','Bengaluru','Bengaluru Airport (BLR)','13:00',165,7800,10,'Economy','Gate A2',45),
  ('flight','Air India','AI-807','Delhi','DEL T3 (IGI Airport)','Bengaluru','Bengaluru Airport (BLR)','15:30',170,9200,6,'Economy','Gate B5',45),
  ('flight','Akasa Air','QP-1203','Delhi','DEL T3 (IGI Airport)','Bengaluru','Bengaluru Airport (BLR)','17:20',165,6900,19,'Economy','Gate C3',45),
  ('flight','IndiGo','6E-2907','Delhi','DEL T3 (IGI Airport)','Bengaluru','Bengaluru Airport (BLR)','19:45',165,6400,21,'Economy','Gate A13',45),
  ('train','Indian Railways','22691 Bengaluru Rajdhani','Delhi','Hazrat Nizamuddin (NZM)','Bengaluru','KSR Bengaluru City (SBC)','20:50',2040,4600,12,'AC 3-tier','Platform 2',15),
  -- Delhi -> Mumbai
  ('flight','IndiGo','6E-2127','Delhi','DEL T3 (IGI Airport)','Mumbai','BOM T2 (CSMIA)','15:00',130,5500,16,'Economy','Gate A10',45),
  ('flight','Akasa Air','QP-1101','Delhi','DEL T3 (IGI Airport)','Mumbai','BOM T2 (CSMIA)','16:20',135,4900,12,'Economy','Gate C9',45),
  ('flight','Air India Express','IX-2417','Delhi','DEL T3 (IGI Airport)','Mumbai','BOM T2 (CSMIA)','17:30',130,3950,7,'Economy','Gate B2',45),
  ('flight','SpiceJet','SG-8701','Delhi','DEL T3 (IGI Airport)','Mumbai','BOM T2 (CSMIA)','19:40',130,3800,13,'Economy','Gate A1',45),
  ('flight','IndiGo','6E-6011','Delhi','DEL T3 (IGI Airport)','Mumbai','BOM T2 (CSMIA)','21:00',130,3500,18,'Economy','Gate A16',45),
  ('train','Indian Railways','12951 Mumbai Rajdhani','Delhi','New Delhi (NDLS)','Mumbai','Mumbai Central (BCT)','16:55',920,3100,20,'AC 3-tier','Platform 5',15),
  -- Mumbai -> Jaipur
  ('flight','IndiGo','6E-7203','Mumbai','BOM T2 (CSMIA)','Jaipur','Jaipur Airport (JAI)','10:15',125,5800,9,'Economy','Gate D2',45),
  ('flight','SpiceJet','SG-8195','Mumbai','BOM T2 (CSMIA)','Jaipur','Jaipur Airport (JAI)','12:45',125,5400,6,'Economy','Gate D9',45),
  ('flight','Air India','AI-613','Mumbai','BOM T2 (CSMIA)','Jaipur','Jaipur Airport (JAI)','14:30',130,7100,5,'Economy','Gate E3',45),
  ('flight','IndiGo','6E-7291','Mumbai','BOM T2 (CSMIA)','Jaipur','Jaipur Airport (JAI)','18:45',125,4900,17,'Economy','Gate D5',45),
  ('flight','IndiGo','6E-7385','Mumbai','BOM T2 (CSMIA)','Jaipur','Jaipur Airport (JAI)','22:10',125,4300,20,'Economy','Gate D11',45),
  ('bus','RSRTC','RSRTC Volvo MJ-21','Mumbai','Mumbai Central Bus Terminus','Jaipur','Sindhi Camp Bus Stand','20:00',1260,2200,18,'AC Sleeper','Bay 12',15),
  ('train','Indian Railways','12956 Jaipur SF Express','Mumbai','Mumbai Central (BCT)','Jaipur','Jaipur Jn (JP)','19:55',1080,1950,22,'AC 3-tier','Platform 3',15),
  -- Mumbai -> Chennai
  ('flight','IndiGo','6E-5301','Mumbai','BOM T2 (CSMIA)','Chennai','Chennai Airport (MAA)','12:10',115,4900,8,'Economy','Gate D4',45),
  ('flight','Air India','AI-571','Mumbai','BOM T2 (CSMIA)','Chennai','Chennai Airport (MAA)','14:50',120,6300,4,'Economy','Gate E6',45),
  ('flight','IndiGo','6E-5417','Mumbai','BOM T2 (CSMIA)','Chennai','Chennai Airport (MAA)','17:10',115,4400,16,'Economy','Gate D7',45),
  ('flight','SpiceJet','SG-8403','Mumbai','BOM T2 (CSMIA)','Chennai','Chennai Airport (MAA)','20:40',115,3900,24,'Economy','Gate D12',45),
  ('train','Indian Railways','11041 Chennai Express','Mumbai','Mumbai CSMT','Chennai','Chennai Central (MAS)','14:00',1470,1850,35,'AC 3-tier','Platform 7',15),
  -- Mumbai -> Goa
  ('flight','IndiGo','6E-5611','Mumbai','BOM T2 (CSMIA)','Goa','Goa Airport (GOI)','15:00',65,4800,10,'Economy','Gate D1',45),
  ('flight','Akasa Air','QP-1721','Mumbai','BOM T2 (CSMIA)','Goa','Goa Airport (GOI)','17:45',70,4200,12,'Economy','Gate D10',45),
  ('bus','Paulo Travels','PT-1180 Volvo Sleeper','Mumbai','Dadar Bus Stop','Goa','Panaji Kadamba Bus Stand','17:30',840,1500,14,'AC Sleeper','Bay 7',15),
  ('bus','Neeta Tours','NT-2204 Multi-Axle','Mumbai','Dadar Bus Stop','Goa','Panaji Kadamba Bus Stand','19:00',780,1300,20,'AC Sleeper','Bay 3',15),
  ('train','Indian Railways','22119 Tejas Express','Mumbai','Mumbai CSMT','Goa','Madgaon (MAO)','15:50',510,2000,8,'AC Chair Car','Platform 12',15)
on conflict (service_number, origin_city, destination_city, departure_time) do nothing;