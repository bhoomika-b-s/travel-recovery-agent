// The rule-based decision engine. Small PURE functions: the same input always
// gives the same output, and nothing here calls the network or the database.
// All numbers come from config.ts.

import { PRIORITY_CONFIG, RANKING_CONFIG } from './config.ts'

export const MIN = 60_000 // milliseconds in a minute
export const IST_OFFSET_MS = 330 * MIN // India is UTC+05:30
const DAY_MS = 24 * 60 * MIN

export type PriorityLevel = 'High' | 'Medium' | 'Low'

// ---------- Row types (the columns we use) ----------

export interface FlightRow {
  id: string
  flight_number: string
  airline: string
  origin_code: string
  origin_city: string
  destination_code: string
  destination_city: string
  scheduled_departure: string
  scheduled_arrival: string
  estimated_departure: string | null
  estimated_arrival: string | null
  status: string
  gate: string | null
}

export interface DisruptionRow {
  id: string
  flight_id: string
  type: 'delay' | 'cancellation'
  delay_minutes: number | null
  new_departure: string | null
  new_arrival: string | null
  reason: string | null
  created_at: string
}

export interface BookingRow {
  id: string
  user_id: string
  flight_id: string
  pnr: string | null
  seat: string | null
  max_budget_inr: number
  latest_arrival: string
  preferred_modes: string[]
  final_destination: string
}

export interface ConnectionRow {
  transport_type: string
  transport_name: string
  departure_location: string
  departure_time: string
  destination: string
  ticket_reference: string | null
}

export interface InventoryRow {
  id: string
  mode: 'flight' | 'train' | 'bus'
  carrier: string
  service_number: string
  origin_city: string
  origin_hub: string
  destination_city: string
  destination_hub: string
  departure_time: string // time of day, e.g. "12:20:00" (IST)
  duration_minutes: number
  price_inr: number
  seats_available: number
  travel_class: string | null
  boarding_point: string | null
  boarding_offset_minutes: number
}

// ---------- Small helpers ----------

export const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase()
const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const round1 = (n: number) => Math.round(n * 10) / 10

// "14:10" in IST
export function hhmm(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// "13 Oct 14:10" in IST
export function dayTime(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hhmm(ms)}`
}

export function inr(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

// 135 -> "2h 15m"
export function minutesText(total: number): string {
  const sign = total < 0 ? '-' : ''
  const m = Math.abs(Math.round(total))
  const h = Math.floor(m / 60)
  return h === 0 ? `${sign}${m % 60}m` : `${sign}${h}h ${m % 60}m`
}

// "40 minutes" / "1 hour 5 minutes" (used in explanation sentences)
export function minutesWords(total: number): string {
  const m = Math.abs(Math.round(total))
  const h = Math.floor(m / 60)
  const rest = m % 60
  const hourPart = h > 0 ? `${h} hour${h === 1 ? '' : 's'}` : ''
  const minPart = rest > 0 || h === 0 ? `${rest} minute${rest === 1 ? '' : 's'}` : ''
  return [hourPart, minPart].filter(Boolean).join(' ')
}

// UTC milliseconds of the IST midnight that starts the IST day containing `ms`.
function istDayStart(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS
}

// Inventory only stores a time of day. Find the first departure of that service
// that the passenger can still reach: they must be at the boarding point
// `offsetMin` minutes early, and cannot be there before `readyMs`.
export function nextDeparture(timeOfDay: string, readyMs: number, offsetMin: number): number {
  const [h, m] = timeOfDay.split(':').map(Number)
  let dep = istDayStart(readyMs) + (h * 60 + m) * MIN
  while (dep - offsetMin * MIN < readyMs) dep += DAY_MS
  return dep
}

// ============================================================
// PART 1: PRIORITY SCORE
// ============================================================

// Everything the priority score needs, as plain numbers (no database rows).
export interface PriorityInput {
  cancelled: boolean
  delayMinutes: number | null
  newArrivalMs: number | null // null when the flight is cancelled
  connectionDepartureMs: number | null // null when there is no connecting transport
  connectionType: string | null // 'flight' | 'train' | 'bus'
  latestArrivalMs: number // passenger's latest acceptable arrival
}

export interface PriorityFactor {
  key: string
  label: string
  possible: number // points this factor gives when it fires
  points: number // points actually awarded (0 when it did not fire)
  fired: boolean
  detail: string // plain-English reason
}

export interface PriorityResult {
  score: number // capped
  rawScore: number // before the cap
  level: PriorityLevel
  factors: PriorityFactor[]
  inputs: Record<string, unknown>
}

// Converts database rows into the plain PriorityInput.
export function buildPriorityInput(
  flight: FlightRow,
  disruption: DisruptionRow,
  booking: BookingRow,
  connection: ConnectionRow | null,
): PriorityInput {
  const cancelled = disruption.type === 'cancellation'
  return {
    cancelled,
    delayMinutes: cancelled ? null : disruption.delay_minutes,
    newArrivalMs: cancelled ? null : Date.parse(disruption.new_arrival ?? flight.scheduled_arrival),
    connectionDepartureMs: connection ? Date.parse(connection.departure_time) : null,
    connectionType: connection ? connection.transport_type.toLowerCase() : null,
    latestArrivalMs: Date.parse(booking.latest_arrival),
  }
}

export function levelFor(score: number): PriorityLevel {
  if (score >= PRIORITY_CONFIG.levels.high) return 'High'
  if (score >= PRIORITY_CONFIG.levels.medium) return 'Medium'
  return 'Low'
}

// Minutes between landing and the connection leaving. Null if it cannot be worked out.
export function connectionBuffer(input: PriorityInput): number | null {
  if (input.cancelled || input.newArrivalMs === null || input.connectionDepartureMs === null) return null
  return Math.round((input.connectionDepartureMs - input.newArrivalMs) / MIN)
}

// A cancelled flight never lands, so the connection is lost.
export function willMissConnection(input: PriorityInput): boolean {
  if (input.connectionDepartureMs === null) return false
  if (input.cancelled) return true
  const buffer = connectionBuffer(input)
  return buffer !== null && buffer < 0
}

export function breachesLatestArrival(input: PriorityInput): boolean {
  if (input.cancelled) return true // the flight never arrives
  return input.newArrivalMs !== null && input.newArrivalMs > input.latestArrivalMs
}

export type DelayBand = 'over180' | '60to180' | 'none'

export function delayBand(input: PriorityInput): DelayBand {
  const T = PRIORITY_CONFIG.thresholds
  if (input.cancelled || input.delayMinutes === null) return 'none'
  if (input.delayMinutes > T.delayLongMinutes) return 'over180'
  if (input.delayMinutes >= T.delayMediumMinutes) return '60to180'
  return 'none'
}

function factor(key: string, label: string, possible: number, fired: boolean, detail: string): PriorityFactor {
  return { key, label, possible, points: fired ? possible : 0, fired, detail }
}

// Checks every rule and returns ALL of them (fired or not), so the UI can show a full breakdown.
export function evaluateFactors(input: PriorityInput): PriorityFactor[] {
  const P = PRIORITY_CONFIG.points
  const T = PRIORITY_CONFIG.thresholds

  const hasConnection = input.connectionDepartureMs !== null
  const buffer = connectionBuffer(input)
  const miss = willMissConnection(input)
  const tight = hasConnection && (input.cancelled || (buffer !== null && buffer < T.bufferTightMinutes))
  const moderate =
    hasConnection &&
    !input.cancelled &&
    buffer !== null &&
    buffer >= T.bufferTightMinutes &&
    buffer <= T.bufferModerateMinutes
  const band = delayBand(input)
  const breach = breachesLatestArrival(input)
  const typePoints = hasConnection ? (P.connectionType[input.connectionType ?? ''] ?? 0) : 0
  const delay = input.delayMinutes ?? 0

  return [
    factor(
      'missed_connection',
      'Connection will be missed',
      P.missedConnection,
      miss,
      miss
        ? input.cancelled
          ? 'The flight is cancelled, so the connection cannot be made.'
          : `The new arrival is ${minutesText(-(buffer ?? 0))} after the connection leaves.`
        : hasConnection
          ? 'The connection can still be made.'
          : 'No connecting transport is recorded.',
    ),
    factor(
      'buffer_under_60',
      `Buffer under ${T.bufferTightMinutes} min`,
      P.bufferUnder60,
      tight,
      tight
        ? input.cancelled
          ? 'There is no flight, so there is no buffer.'
          : `Buffer is ${minutesText(buffer ?? 0)}.`
        : 'Buffer is comfortable or there is no connection.',
    ),
    factor(
      'buffer_60_120',
      `Buffer ${T.bufferTightMinutes} to ${T.bufferModerateMinutes} min`,
      P.buffer60to120,
      moderate,
      moderate ? `Buffer is ${minutesText(buffer ?? 0)}.` : 'Buffer is outside this range.',
    ),
    factor(
      'connection_type',
      hasConnection ? `Connecting ${input.connectionType}` : 'Connecting transport type',
      typePoints,
      hasConnection && typePoints > 0,
      hasConnection
        ? `A missed ${input.connectionType} is weighted at +${typePoints}.`
        : 'No connecting transport is recorded.',
    ),
    factor(
      'cancelled',
      'Flight cancelled',
      P.cancelled,
      input.cancelled,
      input.cancelled ? 'The flight has been cancelled.' : 'The flight is not cancelled.',
    ),
    factor(
      'delay_over_180',
      `Delay over ${T.delayLongMinutes} min`,
      P.delayOver180,
      band === 'over180',
      band === 'over180' ? `The delay is ${minutesText(delay)}.` : 'The delay is not that long.',
    ),
    factor(
      'delay_60_180',
      `Delay ${T.delayMediumMinutes} to ${T.delayLongMinutes} min`,
      P.delay60to180,
      band === '60to180',
      band === '60to180' ? `The delay is ${minutesText(delay)}.` : 'The delay is outside this range.',
    ),
    factor(
      'latest_arrival_breach',
      'Latest arrival breached',
      P.latestArrivalBreach,
      breach,
      breach
        ? input.cancelled
          ? 'The flight will not arrive at all.'
          : `The new arrival is after your latest acceptable arrival of ${dayTime(input.latestArrivalMs)}.`
        : 'The new arrival is within your latest acceptable arrival.',
    ),
  ]
}

// Adds the points, applies the cap and picks the level.
export function scorePriority(input: PriorityInput): PriorityResult {
  const factors = evaluateFactors(input)
  const rawScore = factors.reduce((sum, f) => sum + f.points, 0)
  const score = Math.min(PRIORITY_CONFIG.maxScore, rawScore)

  return {
    score,
    rawScore,
    level: levelFor(score),
    factors,
    inputs: {
      cancelled: input.cancelled,
      delay_minutes: input.delayMinutes,
      buffer_minutes: connectionBuffer(input),
      will_miss_connection: willMissConnection(input),
      connection_type: input.connectionType,
      new_arrival_at: input.newArrivalMs === null ? null : new Date(input.newArrivalMs).toISOString(),
      connection_departure_at:
        input.connectionDepartureMs === null ? null : new Date(input.connectionDepartureMs).toISOString(),
      latest_arrival_at: new Date(input.latestArrivalMs).toISOString(),
    },
  }
}

// The JSON saved in recovery_assessments.factors (and shown on the dashboard).
export function toFactorsJson(result: PriorityResult) {
  return {
    engine: 'rule_based',
    raw_score: result.rawScore,
    capped: result.rawScore > result.score,
    items: result.factors,
    inputs: result.inputs,
  }
}

// Plain-English explanation built from a template, using only facts that fired.
export function explainPriority(args: {
  result: PriorityResult
  input: PriorityInput
  flightNumber: string
  connectionName: string | null
}): string {
  const { result, input, flightNumber, connectionName } = args
  const T = PRIORITY_CONFIG.thresholds
  const parts: string[] = [`${result.level} priority (${result.score}/100):`]

  const buffer = connectionBuffer(input)
  const type = input.connectionType
  const dep = input.connectionDepartureMs
  const what = type && connectionName ? `${type} (${connectionName})` : (type ?? 'connection')

  if (dep === null || type === null) {
    parts.push(`no connecting transport is recorded, so this depends on the disruption itself.`)
  } else if (input.cancelled) {
    parts.push(`flight ${flightNumber} is cancelled, so you cannot make your ${hhmm(dep)} ${what}.`)
  } else if (buffer !== null && buffer < 0) {
    parts.push(
      `your delayed flight now lands ${minutesWords(-buffer)} after your ${hhmm(dep)} ${what} departs.`,
    )
  } else if (buffer !== null && buffer < T.bufferTightMinutes) {
    parts.push(
      `your delayed flight lands only ${minutesWords(buffer)} before your ${hhmm(dep)} ${what} departs, which is too tight.`,
    )
  } else if (buffer !== null && buffer <= T.bufferModerateMinutes) {
    parts.push(
      `your delayed flight leaves a ${minutesWords(buffer)} buffer before your ${hhmm(dep)} ${what} departs.`,
    )
  } else if (buffer !== null) {
    parts.push(`you can still make your ${hhmm(dep)} ${what} with ${minutesWords(buffer)} to spare.`)
  }

  if (delayBand(input) !== 'none' && input.delayMinutes !== null) {
    parts.push(`The delay is ${minutesWords(input.delayMinutes)}.`)
  }
  if (!input.cancelled && breachesLatestArrival(input)) {
    parts.push(`The new arrival is after your latest acceptable arrival of ${dayTime(input.latestArrivalMs)}.`)
  }

  const fired = result.factors.filter((f) => f.fired && f.points > 0)
  if (fired.length > 0) {
    const list = fired.map((f) => `${f.label} +${f.points}`).join(', ')
    parts.push(`Points: ${list}${result.rawScore > result.score ? ` (capped at ${result.score})` : ''}.`)
  }
  return parts.join(' ')
}

// ============================================================
// PART 2: ALTERNATIVES (filter, then rank)
// ============================================================

export interface ScoreBreakdown {
  arrival: { arrives_at: string; normalized: number; weight: number; points: number }
  price: { price_inr: number; normalized: number; weight: number; points: number }
  preferred_mode: { mode: string; preferred: boolean; normalized: number; weight: number; points: number }
  total: number
}

export interface Candidate {
  inventory_id: string
  mode: string
  carrier: string
  service_number: string
  origin_city: string
  origin_hub: string
  destination_city: string
  destination_hub: string
  travel_class: string | null
  boarding_point: string | null
  boarding_offset_minutes: number
  seats_available: number
  price_inr: number
  departure_at: string // ISO
  arrival_at: string // ISO
  duration_minutes: number
  // from_origin  = skip the disrupted flight and travel from the flight's origin city
  // from_landing = continue from the flight's destination city after a delayed landing
  route_type: 'from_origin' | 'from_landing'
  in_preferred_mode: boolean
  slack_minutes: number // minutes before the passenger's latest acceptable arrival
  rule_score: number // 0 to 100, filled by rankCandidates
  score_breakdown: ScoreBreakdown | null
  tags: string[]
}

// Filters the simulated inventory: destination, budget, seats, route and deadline.
export function buildCandidates(args: {
  inventory: InventoryRow[]
  flight: FlightRow
  booking: BookingRow
  cancelled: boolean
  newArrivalMs: number | null
  excludeIds: Set<string>
}): Candidate[] {
  const { inventory, flight, booking, cancelled, newArrivalMs, excludeIds } = args

  const finalDest = norm(booking.final_destination)
  const originCity = norm(flight.origin_city)
  const landingCity = norm(flight.destination_city)
  const preferred = new Set(booking.preferred_modes.map((m) => m.toLowerCase()))
  const latestMs = Date.parse(booking.latest_arrival)
  const scheduledDepMs = Date.parse(flight.scheduled_departure)
  const landingMs = newArrivalMs ?? Date.parse(flight.scheduled_arrival)
  const landingBuffer = RANKING_CONFIG.landingBufferMinutes

  const out: Candidate[] = []

  for (const item of inventory) {
    if (excludeIds.has(item.id)) continue
    if (item.seats_available < 1) continue // seats available
    if (item.price_inr > booking.max_budget_inr) continue // budget
    if (norm(item.destination_city) !== finalDest) continue // destination

    let routeType: 'from_origin' | 'from_landing'
    let readyMs: number

    if (norm(item.origin_city) === originCity && originCity !== finalDest) {
      // Passenger is still at the origin airport around the scheduled departure.
      routeType = 'from_origin'
      readyMs = scheduledDepMs
    } else if (!cancelled && norm(item.origin_city) === landingCity && landingCity !== finalDest) {
      // After landing, allow time to leave the airport and reach the hub.
      routeType = 'from_landing'
      readyMs = landingMs + (item.mode === 'flight' ? landingBuffer.flight : landingBuffer.other) * MIN
    } else {
      continue
    }

    const depMs = nextDeparture(item.departure_time, readyMs, item.boarding_offset_minutes)
    const arrMs = depMs + item.duration_minutes * MIN
    if (arrMs > latestMs) continue // the passenger's deadline

    out.push({
      inventory_id: item.id,
      mode: item.mode,
      carrier: item.carrier,
      service_number: item.service_number,
      origin_city: item.origin_city,
      origin_hub: item.origin_hub,
      destination_city: item.destination_city,
      destination_hub: item.destination_hub,
      travel_class: item.travel_class,
      boarding_point: item.boarding_point,
      boarding_offset_minutes: item.boarding_offset_minutes,
      seats_available: item.seats_available,
      price_inr: item.price_inr,
      departure_at: new Date(depMs).toISOString(),
      arrival_at: new Date(arrMs).toISOString(),
      duration_minutes: item.duration_minutes,
      route_type: routeType,
      in_preferred_mode: preferred.has(item.mode),
      slack_minutes: Math.round((latestMs - arrMs) / MIN),
      rule_score: 0,
      score_breakdown: null,
      tags: [],
    })
  }
  return out
}

// 100 for the lowest value, 0 for the highest. All equal -> 100.
export function normalizeLowIsBetter(value: number, lo: number, hi: number): number {
  return hi === lo ? 100 : 100 * (1 - (value - lo) / (hi - lo))
}

// Scores every candidate 0 to 100 with the weights from config.ts and sorts best first.
export function rankCandidates(cands: Candidate[], weights = RANKING_CONFIG.weights): Candidate[] {
  if (cands.length === 0) return []

  const arrivals = cands.map((c) => Date.parse(c.arrival_at))
  const prices = cands.map((c) => c.price_inr)
  const minA = Math.min(...arrivals)
  const maxA = Math.max(...arrivals)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const weightSum = weights.arrival + weights.price + weights.preferredMode || 1

  const scored = cands.map((c) => {
    const arr = Date.parse(c.arrival_at)
    const arrivalNorm = normalizeLowIsBetter(arr, minA, maxA)
    const priceNorm = normalizeLowIsBetter(c.price_inr, minP, maxP)
    const modeNorm = c.in_preferred_mode ? 100 : 0

    const arrivalPts = (weights.arrival / weightSum) * arrivalNorm
    const pricePts = (weights.price / weightSum) * priceNorm
    const modePts = (weights.preferredMode / weightSum) * modeNorm
    const total = arrivalPts + pricePts + modePts

    const tags: string[] = []
    if (arr === minA) tags.push('Fastest arrival')
    if (c.price_inr === minP) tags.push('Cheapest')
    if (c.in_preferred_mode) tags.push('Preferred mode')
    if (c.seats_available < RANKING_CONFIG.lowSeatsThreshold) tags.push(`Only ${c.seats_available} seats left`)

    const breakdown: ScoreBreakdown = {
      arrival: {
        arrives_at: c.arrival_at,
        normalized: round1(arrivalNorm),
        weight: weights.arrival,
        points: round1(arrivalPts),
      },
      price: { price_inr: c.price_inr, normalized: round1(priceNorm), weight: weights.price, points: round1(pricePts) },
      preferred_mode: {
        mode: c.mode,
        preferred: c.in_preferred_mode,
        normalized: modeNorm,
        weight: weights.preferredMode,
        points: round1(modePts),
      },
      total: round1(total),
    }

    return { ...c, rule_score: round1(total), score_breakdown: breakdown, tags }
  })

  return scored.sort(
    (a, b) =>
      b.rule_score - a.rule_score ||
      Date.parse(a.arrival_at) - Date.parse(b.arrival_at) ||
      a.price_inr - b.price_inr,
  )
}

// Template text for one ranked option.
export function explainOption(c: Candidate, rank: number): string {
  const parts = [
    `${c.carrier} ${c.service_number} leaves ${hhmm(Date.parse(c.departure_at))} from ${c.origin_hub} and reaches ` +
      `${c.destination_city} at ${dayTime(Date.parse(c.arrival_at))}, ${minutesText(c.slack_minutes)} before your deadline.`,
    `Fare ${inr(c.price_inr)}.`,
  ]
  if (c.tags.length) parts.push(`${c.tags.join(', ')}.`)
  if (!c.in_preferred_mode) parts.push('This is not one of your preferred modes.')
  if (c.route_type === 'from_origin') parts.push('Leaves from your origin city, so you skip the disrupted flight.')
  else parts.push('Continues from the city where your delayed flight lands.')
  parts.push(`Rank ${rank} with a ranking score of ${c.rule_score}/100.`)
  return parts.join(' ')
}