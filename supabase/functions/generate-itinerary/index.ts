// Function 2: generate-itinerary  (template based, no external AI)
// Input:  { alternative_id }
// What it does: accepts the option (seat + pending_settlement ledger row, via the
// accept_alternative RPC with the passenger's own JWT), then builds and saves the
// recovery itinerary.
// Output: { alternative, itinerary, payment, source, simulated }

import { corsHeaders, isUuid, json } from '../_shared/cors.ts'
import { adminClient, authenticate, must } from '../_shared/clients.ts'
import { type ItineraryInput, buildItinerary } from '../_shared/itinerary.ts'
import type {
  BookingRow,
  ConnectionRow,
  DisruptionRow,
  FlightRow,
  InventoryRow,
} from '../_shared/scoring.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  try {
    // 1) Who is calling?
    const auth = await authenticate(req)
    if (!auth.ok) return json({ error: auth.error }, 401)

    const body = await req.json().catch(() => null)
    const alternativeId = body?.alternative_id
    if (!isUuid(alternativeId)) return json({ error: 'alternative_id (UUID) is required.' }, 400)

    const admin = adminClient()

    // Loads the alternative together with its inventory row.
    async function loadAlt() {
      return must(
        await admin
          .from('alternatives')
          .select('*, transport_inventory(*)')
          .eq('id', alternativeId)
          .maybeSingle(),
      ) as Record<string, unknown> | null
    }

    // Builds the final response from what is in the database.
    async function respond(itinerary: unknown) {
      const alternative = await loadAlt()
      const payment = must(
        await admin.from('payments_ledger').select('*').eq('alternative_id', alternativeId).maybeSingle(),
      )
      return json({ alternative, itinerary, payment, source: 'rule_based', simulated: true })
    }

    // 2) The option must exist and belong to the caller.
    let alt = await loadAlt()
    if (!alt) return json({ error: 'Option not found.' }, 404)

    const booking = must(
      await admin.from('passenger_bookings').select('*').eq('id', alt.booking_id as string).maybeSingle(),
    ) as BookingRow | null
    if (!booking || booking.user_id !== auth.user.id) return json({ error: 'Option not found.' }, 404)

    // 3) Already have an itinerary? Return it (safe to call twice).
    const savedItinerary = must(
      await admin.from('recovery_itineraries').select('*').eq('alternative_id', alternativeId).maybeSingle(),
    )
    if (savedItinerary) return await respond(savedItinerary)

    // 4) Accept the option (reserves a seat, creates the reference, writes the ledger row).
    //    This uses the PASSENGER's client so auth.uid() works inside the database function.
    if (alt.status === 'suggested') {
      const { error: acceptError } = await auth.userClient.rpc('accept_alternative', {
        p_alternative_id: alternativeId,
      })
      if (acceptError) return json({ error: acceptError.message }, 409)
      alt = await loadAlt()
      if (!alt) return json({ error: 'Option not found.' }, 404)
    }
    if (alt.status !== 'accepted') {
      return json({ error: 'This option is no longer available.' }, 409)
    }

    // 5) Load everything the itinerary needs.
    const disruption = must(
      await admin.from('disruptions').select('*').eq('id', alt.disruption_id as string).maybeSingle(),
    ) as DisruptionRow | null
    const flight = must(
      await admin.from('flights').select('*').eq('id', booking.flight_id).maybeSingle(),
    ) as FlightRow | null
    if (!disruption || !flight) return json({ error: 'Flight or disruption not found.' }, 404)

    const connections = must(
      await admin
        .from('connecting_transport')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: true })
        .limit(1),
    ) as ConnectionRow[] | null

    const input: ItineraryInput = {
      flight,
      disruption,
      booking,
      connection: connections?.[0] ?? null,
      inventory: alt.transport_inventory as InventoryRow,
      alt: {
        departure_at: alt.departure_at as string,
        arrival_at: alt.arrival_at as string,
        price_inr: alt.price_inr as number,
        booking_reference: alt.booking_reference as string,
      },
    }

    // 6) Build the itinerary from templates.
    const itinerary = buildItinerary(input)

    // 7) Save it. If two requests race, the unique constraint on alternative_id keeps one.
    const { data: saved, error: insertError } = await admin
      .from('recovery_itineraries')
      .insert({
        booking_id: booking.id,
        disruption_id: disruption.id,
        alternative_id: alternativeId,
        summary: itinerary.summary,
        steps: itinerary.steps,
        source: 'rule_based',
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        const again = must(
          await admin.from('recovery_itineraries').select('*').eq('alternative_id', alternativeId).maybeSingle(),
        )
        return await respond(again)
      }
      // The option IS accepted already; calling this function again will just build the itinerary.
      throw new Error(`Option accepted, but the itinerary could not be saved: ${insertError.message}`)
    }

    return await respond(saved)
  } catch (e) {
    console.error('generate-itinerary failed:', e)
    return json({ error: `Something went wrong: ${(e as Error).message}` }, 500)
  }
})