# TravelRecover AI

An agent that detects flight delays and cancellations, finds the affected
bookings, evaluates alternatives and builds a recovery itinerary within each
traveller's own constraints. Problem Statement 4.1.

**All alternative flights, trains and buses are simulated data. No real ticket
is booked and no real payment is taken.** Fares are only recorded in a ledger as
`pending_settlement` for the airport authority.

## Tech stack

- Frontend: React (Vite), React Router, Tailwind CSS v4
- Backend: Supabase (Postgres, Auth, Row Level Security, Realtime, Edge Functions)
- Decision engine: rule-based, runs in the Edge Functions. No external AI service.

## How it works

1. Airport staff mark a flight delayed or cancelled (or use "Simulate random disruption").
   One database call updates the flight, saves a disruption and notifies every passenger on it.
2. The passenger dashboard gets the alert live through Supabase Realtime.
3. The `prioritize-and-recommend` function scores priority (0 to 100), filters the
   simulated inventory and ranks the top 3 options.
4. The passenger accepts an option (or asks for another one). The
   `generate-itinerary` function reserves the seat, records the fare as
   `pending_settlement` and saves a step-by-step recovery itinerary.

## Priority score (all numbers live in `supabase/functions/_shared/config.ts`)

| Factor | Points |
|---|---|
| New arrival is after the connection departs | +40 |
| Buffer under 60 min / 60 to 120 min | +30 / +15 |
| Connecting transport: flight / train / bus | +20 / +15 / +8 |
| Flight cancelled | +20 |
| Delay over 180 min / 60 to 180 min | +15 / +10 |
| New arrival is after the latest acceptable arrival | +15 |

The score is capped at 100. Levels: High 70 or more, Medium 40 to 69, Low below 40.
A cancelled flight counts as "will miss the connection", "buffer under 60" and
"latest arrival breached", because the flight never lands.

## Option ranking

Options are filtered by destination, budget, seats left and the passenger's
deadline, then scored: arrival time 0.5, price 0.3, preferred mode 0.2.
The top 3 are shown. "Request another option" returns the next best ones.

## Setup

1. Prerequisites: Node.js 20 or newer, a Supabase project.
2. Install: `npm install`
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (Supabase Dashboard, Project Settings, API).
4. In the Supabase SQL Editor run, in order:
   `supabase/migrations/001_schema.sql`, `002_rls.sql`, `003_seed.sql`, `004_rule_engine.sql`.
5. In Supabase, Authentication, Providers, Email: turn **Confirm email** off.
6. Link and deploy the functions:

```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy prioritize-and-recommend --no-verify-jwt
   npx supabase functions deploy generate-itinerary --no-verify-jwt
```

   (Add `--use-api` if Docker is not running.) No function secrets are needed.
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase.
7. Start the app: `npm run dev` and open http://localhost:5173

## Demo accounts (password `Demo@1234`)

| Account | Role |
|---|---|
| staff.del@example.com | Staff, Delhi (DEL) |
| staff.bom@example.com | Staff, Mumbai (BOM) |
| passenger1@example.com to passenger10@example.com | Passengers |

## Useful files

- `supabase/demo_reset.sql`: reset the demo to a clean state.
- `supabase/smoke_check.sql`: database health and Row Level Security checks.
- `supabase/functions/_shared/config.ts`: every weight and threshold.
- `supabase/functions/_shared/scoring.ts`: the scoring and ranking functions.

## Security notes

- Roles cannot be chosen at sign-up. Staff accounts are promoted with SQL only.
- Passengers see only their own rows. Staff see only flights and passengers for their airport.
- Disruptions, trips and acceptances run through database functions that check the caller's role.
- The `service_role` key exists only inside Edge Functions and is never in the browser.

## Known limits

- Disruptions are reported by staff (or simulated). There is no live flight-status feed.
- Alternatives come from a seeded, daily-recurring inventory table.
- The agent uses the passenger's first connecting transport.