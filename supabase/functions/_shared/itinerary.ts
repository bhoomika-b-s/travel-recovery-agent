// Builds the recovery itinerary from templates. Every time, gate, place and price
// comes straight from the database rows, so nothing can be wrong or invented.

import {
  type BookingRow,
  type ConnectionRow,
  type DisruptionRow,
  type FlightRow,
  type InventoryRow,
  MIN,
  dayTime,
  hhmm,
  inr,
  norm,
} from './scoring.ts'

export type StepType = 'info' | 'admin' | 'action' | 'travel' | 'arrive'

export interface ItineraryStep {
  at: string | null // ISO time, or null for steps that are not tied to a clock time
  type: StepType
  title: string
  detail: string
}

export interface Itinerary {
  summary: string
  steps: ItineraryStep[]
}

export interface ItineraryInput {
  flight: FlightRow
  disruption: DisruptionRow
  booking: BookingRow
  connection: ConnectionRow | null
  inventory: InventoryRow
  alt: { departure_at: string; arrival_at: string; price_inr: number; booking_reference: string }
}

export function buildItinerary(i: ItineraryInput): Itinerary {
  const { flight, disruption, booking, connection, inventory: inv, alt } = i

  const depMs = Date.parse(alt.departure_at)
  const arrMs = Date.parse(alt.arrival_at)
  const boardByMs = depMs - inv.boarding_offset_minutes * MIN
  const latestMs = Date.parse(booking.latest_arrival)
  const spare = Math.round((latestMs - arrMs) / MIN)
  const cancelled = disruption.type === 'cancellation'
  const fromOrigin = norm(inv.origin_city) === norm(flight.origin_city)
  const point = inv.boarding_point || inv.origin_hub
  const service = `${inv.carrier} ${inv.service_number}`
  const newArrivalMs = Date.parse(disruption.new_arrival ?? flight.scheduled_arrival)

  const steps: ItineraryStep[] = []

  steps.push({
    at: null,
    type: 'info',
    title: cancelled ? `Flight ${flight.flight_number} is cancelled` : `Flight ${flight.flight_number} is delayed`,
    detail: cancelled
      ? `Reason: ${disruption.reason ?? 'operational reasons'}. You need another way to reach ${booking.final_destination}.`
      : `New expected arrival at ${flight.destination_city} is ${hhmm(newArrivalMs)}. Reason: ${disruption.reason ?? 'operational reasons'}.`,
  })

  steps.push({
    at: null,
    type: 'admin',
    title: 'Recovery booking confirmed (simulated)',
    detail: `Reference ${alt.booking_reference}. The fare of ${inr(alt.price_inr)} is recorded as "pending settlement" with the airport authority. No payment was taken.`,
  })

  if (fromOrigin) {
    steps.push({
      at: null,
      type: 'admin',
      title: `Release your original flight ${flight.flight_number}`,
      detail: `Tell the ${flight.airline} desk at ${flight.origin_code} that you are switching to ${service}. Ask about a refund or rebooking for the unused flight.`,
    })
  } else {
    steps.push({
      at: new Date(newArrivalMs).toISOString(),
      type: 'travel',
      title: `Land at ${flight.destination_city}`,
      detail: `Flight ${flight.flight_number} is expected to land at ${hhmm(newArrivalMs)}.`,
    })
  }

  if (connection) {
    steps.push({
      at: null,
      type: 'admin',
      title: `Cancel or change your original ${connection.transport_type}`,
      detail: `${connection.transport_name} (ticket ${connection.ticket_reference ?? 'n/a'}) departs at ${hhmm(Date.parse(connection.departure_time))}. You will not use it, so ask about a refund or change.`,
    })
  }

  if (fromOrigin) {
    steps.push({
      at: new Date(boardByMs - 30 * MIN).toISOString(),
      type: 'action',
      title: `Go to ${inv.origin_hub}`,
      detail: `Head there in good time for ${service}.`,
    })
  } else {
    const buffer = inv.mode === 'flight' ? 30 : 60
    steps.push({
      at: new Date(newArrivalMs + 15 * MIN).toISOString(),
      type: 'action',
      title: `Go to ${inv.origin_hub}`,
      detail: `Allow about ${buffer} minutes to leave the airport and reach it.`,
    })
  }

  steps.push({
    at: new Date(boardByMs).toISOString(),
    type: 'action',
    title: `Proceed to ${point} by ${hhmm(boardByMs)}`,
    detail: `${service} departs at ${hhmm(depMs)}. Be at the boarding point ${inv.boarding_offset_minutes} minutes before departure and keep reference ${alt.booking_reference} ready.`,
  })

  steps.push({
    at: new Date(depMs).toISOString(),
    type: 'travel',
    title: `Depart on ${service}`,
    detail: `${inv.mode.charAt(0).toUpperCase() + inv.mode.slice(1)} from ${inv.origin_hub} to ${inv.destination_hub}${inv.travel_class ? ` (${inv.travel_class})` : ''}.`,
  })

  steps.push({
    at: new Date(arrMs).toISOString(),
    type: 'arrive',
    title: `Arrive in ${inv.destination_city}`,
    detail: `You reach ${inv.destination_hub} at ${dayTime(arrMs)}, ${Math.max(0, spare)} minutes before your latest acceptable arrival of ${dayTime(latestMs)}.`,
  })

  return {
    summary:
      `Flight ${flight.flight_number} ${cancelled ? 'was cancelled' : 'is delayed'}. Take ${service} from ${inv.origin_hub} ` +
      `at ${hhmm(depMs)} and reach ${inv.destination_city} at ${dayTime(arrMs)}, ${Math.max(0, spare)} minutes before your deadline.`,
    steps,
  }
}