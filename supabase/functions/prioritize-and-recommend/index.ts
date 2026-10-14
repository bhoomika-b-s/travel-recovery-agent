// Function 1: prioritize-and-recommend  (rule-based, no external AI)
// Input:  { disruption_id, booking_id, regenerate?: boolean }
// Output: { assessment, alternatives, source, regenerated, simulated, ... }
// The assessment's "factors" JSON holds the full priority breakdown, and every
// alternative has a "score_breakdown" JSON.

import { corsHeaders, isUuid, json } from '../_shared/cors.ts'
import { adminClient, authenticate, must } from '../_shared/clients.ts'
import { RANKING_CONFIG } from '../_shared/config.ts'
import {
  type BookingRow,
  type ConnectionRow,
  type DisruptionRow,
  type FlightRow,
  type InventoryRow,
  buildCandidates,
  buildPriorityInput,
  explainOption,
  explainPriority,
  rankCandidates,
  scorePriority,
  toFactorsJson,
} from '../_shared/scoring.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  try {
    // 1) Who is calling?
    const auth = await authenticate(req)
    if (!auth.ok) return json({ error: auth.error }, 401)

    // 2) Read and check the input.
    const body = await req.json().catch(() => null)
    const disruptionId = body?.disruption_id
    const bookingId = body?.booking_id
    const regenerate = body?.regenerate === true
    if (!isUuid(disruptionId) || !isUuid(bookingId)) {
      return json({ error: 'disruption_id and booking_id (UUIDs) are required.' }, 400)
    }

    const admin = adminClient()

    // 3) Load the data. The admin client bypasses RLS, so we check ownership ourselves.
    const booking = must(
      await admin.from('passenger_bookings').select('*').eq('id', bookingId).maybeSingle(),
    ) as BookingRow | null
    if (!booking || booking.user_id !== auth.user.id) return json({ error: 'Booking not found.' }, 404)

    const disruption = must(
      await admin.from('disruptions').select('*').eq('id', disruptionId).maybeSingle(),
    ) as DisruptionRow | null
    if (!disruption || disruption.flight_id !== booking.flight_id) {
      return json({ error: 'This disruption does not belong to your booking.' }, 400)
    }

    const flight = must(
      await admin.from('flights').select('*').eq('id', booking.flight_id).maybeSingle(),
    ) as FlightRow | null
    if (!flight) return json({ error: 'Flight not found.' }, 404)

    const connections = must(
      await admin
        .from('connecting_transport')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })
        .limit(1),
    ) as ConnectionRow[] | null
    const connection = connections?.[0] ?? null

    // Everything ever suggested for this passenger and disruption.
    const existing =
      (must(
        await admin
          .from('alternatives')
          .select('id, inventory_id, status')
          .eq('booking_id', bookingId)
          .eq('disruption_id', disruptionId),
      ) as { id: string; inventory_id: string; status: string }[] | null) ?? []

    async function loadAssessment() {
      return must(
        await admin
          .from('recovery_assessments')
          .select('*')
          .eq('booking_id', bookingId)
          .eq('disruption_id', disruptionId)
          .maybeSingle(),
      ) as Record<string, unknown> | null
    }

    // Returns the passenger's current options (suggested or accepted), best rank first.
    async function currentAlternatives() {
      const rows = must(
        await admin
          .from('alternatives')
          .select('*, transport_inventory(*)')
          .eq('booking_id', bookingId)
          .eq('disruption_id', disruptionId)
          .in('status', ['suggested', 'accepted'])
          .order('rank', { ascending: true }),
      ) as Record<string, unknown>[] | null
      return rows ?? []
    }

    const existingAssessment = await loadAssessment()

    // 4) Already have an answer? Return it.
    const hasAccepted = existing.some((a) => a.status === 'accepted')
    const hasSuggested = existing.some((a) => a.status === 'suggested')

    if (hasAccepted) {
      if (regenerate) return json({ error: 'You have already accepted an option for this disruption.' }, 409)
      return json({
        assessment: existingAssessment,
        alternatives: await currentAlternatives(),
        source: 'rule_based',
        regenerated: false,
        simulated: true,
      })
    }
    if (hasSuggested && !regenerate) {
      return json({
        assessment: existingAssessment,
        alternatives: await currentAlternatives(),
        source: 'rule_based',
        regenerated: false,
        simulated: true,
      })
    }

    // 5) Priority score (pure rules).
    const priorityInput = buildPriorityInput(flight, disruption, booking, connection)
    const priority = scorePriority(priorityInput)
    const explanation = explainPriority({
      result: priority,
      input: priorityInput,
      flightNumber: flight.flight_number,
      connectionName: connection?.transport_name ?? null,
    })

    // Saves the assessment (priority score, level, text, factor breakdown JSON).
    async function saveAssessment() {
      return must(
        await admin
          .from('recovery_assessments')
          .upsert(
            {
              disruption_id: disruptionId,
              booking_id: bookingId,
              priority_score: priority.score,
              priority_level: priority.level,
              explanation,
              factors: toFactorsJson(priority),
              source: 'rule_based',
            },
            { onConflict: 'disruption_id,booking_id' },
          )
          .select()
          .single(),
      ) as Record<string, unknown>
    }

    // 6) Filter the simulated inventory (destination, budget, seats, deadline), then rank.
    const inventory =
      (must(
        await admin
          .from('transport_inventory')
          .select('*')
          .gt('seats_available', 0)
          .lte('price_inr', booking.max_budget_inr),
      ) as InventoryRow[] | null) ?? []

    const excludeIds = new Set<string>(existing.map((a) => a.inventory_id)) // never repeat an option
    const candidates = buildCandidates({
      inventory,
      flight,
      booking,
      cancelled: priorityInput.cancelled,
      newArrivalMs: priorityInput.newArrivalMs,
      excludeIds,
    })
    const top = rankCandidates(candidates).slice(0, RANKING_CONFIG.topN)

    // 7) Nothing left to suggest.
    if (top.length === 0) {
      if (regenerate) {
        return json({
          assessment: existingAssessment,
          alternatives: await currentAlternatives(),
          source: 'rule_based',
          no_more_options: true,
          message: 'There are no more options that fit your budget, deadline and destination.',
          regenerated: true,
          simulated: true,
        })
      }
      const assessment = existingAssessment ?? (await saveAssessment())
      return json({
        assessment,
        alternatives: [],
        source: 'rule_based',
        message: 'No simulated option fits your budget, deadline and destination. Try asking airport staff for help.',
        regenerated: false,
        simulated: true,
      })
    }

    // 8) Guard against two calls running at the same moment (double clicks, React StrictMode).
    if (!regenerate) {
      const raced = must(
        await admin
          .from('alternatives')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('disruption_id', disruptionId)
          .limit(1),
      ) as { id: string }[] | null
      if (raced && raced.length > 0) {
        return json({
          assessment: (await loadAssessment()) ?? existingAssessment,
          alternatives: await currentAlternatives(),
          source: 'rule_based',
          regenerated: false,
          simulated: true,
        })
      }
    }

    // 9) Save the assessment (first run only) and the alternatives.
    const assessment = existingAssessment ?? (await saveAssessment())

    if (regenerate) {
      // The passenger asked for another option: retire the current suggestions.
      must(
        await admin
          .from('alternatives')
          .update({ status: 'rejected' })
          .eq('booking_id', bookingId)
          .eq('disruption_id', disruptionId)
          .eq('status', 'suggested'),
      )
    }

    const rows = top.map((c, i) => ({
      disruption_id: disruptionId,
      booking_id: bookingId,
      inventory_id: c.inventory_id,
      rank: i + 1,
      score: c.rule_score,
      departure_at: c.departure_at,
      arrival_at: c.arrival_at,
      price_inr: c.price_inr,
      reasoning: explainOption(c, i + 1),
      score_breakdown: c.score_breakdown,
      source: 'rule_based',
      status: 'suggested',
    }))
    must(await admin.from('alternatives').insert(rows))

    return json({
      assessment,
      alternatives: await currentAlternatives(),
      source: 'rule_based',
      regenerated: regenerate,
      simulated: true,
    })
  } catch (e) {
    console.error('prioritize-and-recommend failed:', e)
    return json({ error: `Something went wrong: ${(e as Error).message}` }, 500)
  }
})