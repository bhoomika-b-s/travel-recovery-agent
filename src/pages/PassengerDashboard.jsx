import { useCallback, useEffect, useRef, useState } from 'react'
import AlertBanner from '../components/AlertBanner'
import ItineraryView from '../components/ItineraryView'
import Navbar from '../components/Navbar'
import OptionCard from '../components/OptionCard'
import PriorityCard from '../components/PriorityCard'
import SimulatedBanner from '../components/SimulatedBanner'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { callAgent } from '../lib/agent'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, formatDuration } from '../lib/time'

const EMPTY_RECOVERY = { disruption: null, assessment: null, alternatives: [], itinerary: null, payment: null }
const MODE_ICON = { flight: '✈️', train: '🚆', bus: '🚌' }

function Spinner({ label }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  )
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{children}</span>
    </div>
  )
}

export default function PassengerDashboard() {
  const { user, profile } = useAuth()
  const userId = user.id

  const [bookings, setBookings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const selectedIdRef = useRef(null)

  const [recovery, setRecovery] = useState(EMPTY_RECOVERY)
  const [unread, setUnread] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [agentStatus, setAgentStatus] = useState('idle') // idle | running | error
  const [agentError, setAgentError] = useState('')
  const [busy, setBusy] = useState('') // '' | 'regenerate' | 'accept'
  const [notice, setNotice] = useState('')
  const [flash, setFlash] = useState(false)
  const agentRanFor = useRef('') // "bookingId:disruptionId" the agent was already started for

  // ---------- Load everything for the signed-in passenger ----------
  const refresh = useCallback(async () => {
    const { data: bks, error: bookingsError } = await supabase
      .from('passenger_bookings')
      .select('*, flights(*), connecting_transport(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (bookingsError) {
      setError(bookingsError.message)
      setLoading(false)
      return
    }

    const list = bks ?? []
    setBookings(list)
    const current = list.find((b) => b.id === selectedIdRef.current) ?? list[0] ?? null
    if (current && selectedIdRef.current !== current.id) {
      selectedIdRef.current = current.id
      setSelectedId(current.id)
    }

    // Unread alerts
    const { data: notes } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
    setUnread(notes ?? [])

    if (!current) {
      setRecovery(EMPTY_RECOVERY)
      setError('')
      setLoading(false)
      return
    }

    // The latest disruption on this passenger's flight
    const { data: dis, error: disError } = await supabase
      .from('disruptions')
      .select('*')
      .eq('flight_id', current.flight_id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (disError) {
      setError(disError.message)
      setLoading(false)
      return
    }

    const disruption = dis?.[0] ?? null
    if (!disruption) {
      setRecovery(EMPTY_RECOVERY)
      setError('')
      setLoading(false)
      return
    }

    // Agent output saved for this passenger and disruption
    const [assessRes, altRes, itinRes] = await Promise.all([
      supabase
        .from('recovery_assessments')
        .select('*')
        .eq('booking_id', current.id)
        .eq('disruption_id', disruption.id)
        .limit(1),
      supabase
        .from('alternatives')
        .select('*, transport_inventory(*)')
        .eq('booking_id', current.id)
        .eq('disruption_id', disruption.id)
        .in('status', ['suggested', 'accepted'])
        .order('rank', { ascending: true }),
      supabase
        .from('recovery_itineraries')
        .select('*')
        .eq('booking_id', current.id)
        .eq('disruption_id', disruption.id)
        .limit(1),
    ])

    const firstError = assessRes.error || altRes.error || itinRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const alternatives = altRes.data ?? []
    const accepted = alternatives.find((a) => a.status === 'accepted')
    let payment = null
    if (accepted) {
      const { data: pay } = await supabase
        .from('payments_ledger')
        .select('*')
        .eq('alternative_id', accepted.id)
        .limit(1)
      payment = pay?.[0] ?? null
    }

    setRecovery({
      disruption,
      assessment: assessRes.data?.[0] ?? null,
      alternatives,
      itinerary: itinRes.data?.[0] ?? null,
      payment,
    })
    setError('')
    setLoading(false)
  }, [userId])

  // Load once, then listen live: a new notification means staff reported a disruption.
  useEffect(() => {
    refresh()

    const channel = supabase
      .channel(`passenger-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          setFlash(true)
          refresh()
        },
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flights' }, () => refresh())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  // The alert pulses for a few seconds when it arrives live.
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(false), 4000)
    return () => clearTimeout(timer)
  }, [flash])

  // ---------- Values worked out from the loaded data ----------
  const booking = bookings.find((b) => b.id === selectedId) ?? bookings[0] ?? null
  const flight = booking?.flights ?? null
  const connection = booking?.connecting_transport?.[0] ?? null
  const { disruption, assessment, alternatives, itinerary, payment } = recovery
  const accepted = alternatives.find((a) => a.status === 'accepted') ?? null
  const suggested = alternatives.filter((a) => a.status === 'suggested')
  // Staff restored the flight and the passenger never accepted anything: nothing to recover.
  const restored = Boolean(disruption) && flight?.status === 'scheduled' && !accepted

  // ---------- Agent calls ----------
  const runAgent = useCallback(
    async (regenerate = false) => {
      if (!booking || !disruption) return
      setAgentError('')
      setNotice('')
      if (regenerate) setBusy('regenerate')
      else setAgentStatus('running')
      try {
        const data = await callAgent('prioritize-and-recommend', {
          disruption_id: disruption.id,
          booking_id: booking.id,
          regenerate,
        })
        if (data?.message) setNotice(data.message)
        await refresh()
        setAgentStatus('idle')
      } catch (err) {
        setAgentError(err.message)
        setAgentStatus('error')
      } finally {
        setBusy('')
      }
    },
    [booking?.id, disruption?.id, refresh], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Start the agent automatically the first time a disruption has no saved assessment.
  useEffect(() => {
    if (loading || !booking || !disruption || restored || assessment) return
    const key = `${booking.id}:${disruption.id}`
    if (agentRanFor.current === key) return
    agentRanFor.current = key
    runAgent(false)
  }, [loading, booking?.id, disruption?.id, restored, assessment, runAgent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Accept an option (also used to build a missing itinerary for an already accepted one).
  async function handleAccept(option) {
    setBusy('accept')
    setAgentError('')
    setNotice('')
    try {
      await callAgent('generate-itinerary', { alternative_id: option.id })
    } catch (err) {
      setAgentError(err.message)
    } finally {
      await refresh()
      setBusy('')
    }
  }

  async function dismissAlerts() {
    setFlash(false)
    setUnread([])
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  }

  function scrollToRecovery() {
    document.getElementById('recovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleSelectBooking(id) {
    selectedIdRef.current = id
    setSelectedId(id)
    setAgentStatus('idle')
    setAgentError('')
    setNotice('')
    refresh()
  }

  // How much time is there between landing and the connecting transport leaving?
  function connectionStatus() {
    if (!connection || !flight) return null
    if (flight.status === 'cancelled') return { tone: 'red', text: 'Flight cancelled: connection lost' }
    const landing = new Date(flight.estimated_arrival ?? flight.scheduled_arrival).getTime()
    const gap = Math.round((new Date(connection.departure_time).getTime() - landing) / 60000)
    if (gap < 0) return { tone: 'red', text: `Connection missed by ${formatDuration(-gap)}` }
    if (gap < 60) return { tone: 'amber', text: `Tight: ${formatDuration(gap)} to spare` }
    return { tone: 'green', text: `${formatDuration(gap)} to spare` }
  }

  const TONES = {
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    green: 'bg-emerald-100 text-emerald-800',
  }

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-slate-900">No trip found</h1>
          <p className="mt-2 text-sm text-slate-600">
            This account has no flight booking yet. Sign up again with a new email to add your trip details.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </main>
      </div>
    )
  }

  const status = connectionStatus()

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {profile?.full_name || 'traveller'}</h1>
          <p className="mt-1 text-sm text-slate-500">Your trip and recovery plan. All times are IST.</p>
        </div>

        {bookings.length > 1 && (
          <select
            value={booking.id}
            onChange={(e) => handleSelectBooking(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.flights?.flight_number} · {b.flights?.origin_code} → {b.flights?.destination_code}
              </option>
            ))}
          </select>
        )}

        <AlertBanner
          notification={unread[0]}
          extraCount={Math.max(0, unread.length - 1)}
          flash={flash}
          onDismiss={dismissAlerts}
          onView={scrollToRecovery}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* My flight, connecting transport and constraints */}
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard title="My flight">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold text-slate-900">
                {flight.flight_number} <span className="text-sm font-normal text-slate-500">{flight.airline}</span>
              </p>
              <StatusBadge status={flight.status} />
            </div>
            <Row label="Route">
              {flight.origin_code} → {flight.destination_code}
            </Row>
            <Row label="Departure">
              {flight.status === 'delayed' ? (
                <>
                  <span className="mr-1 text-xs text-slate-400 line-through">
                    {formatDateTimeIST(flight.scheduled_departure)}
                  </span>
                  <span className="text-amber-700">{formatDateTimeIST(flight.estimated_departure)}</span>
                </>
              ) : (
                formatDateTimeIST(flight.scheduled_departure)
              )}
            </Row>
            <Row label="Arrival">
              {flight.status === 'delayed' ? (
                <>
                  <span className="mr-1 text-xs text-slate-400 line-through">
                    {formatDateTimeIST(flight.scheduled_arrival)}
                  </span>
                  <span className="text-amber-700">{formatDateTimeIST(flight.estimated_arrival)}</span>
                </>
              ) : (
                formatDateTimeIST(flight.scheduled_arrival)
              )}
            </Row>
            <Row label="PNR / Seat">
              {booking.pnr || '-'} / {booking.seat || '-'}
            </Row>
            <Row label="Gate">{flight.gate || '-'}</Row>
            {flight.status_reason && flight.status !== 'scheduled' && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Reason: {flight.status_reason}</p>
            )}
          </InfoCard>

          <InfoCard title="Connecting transport">
            {connection ? (
              <>
                <p className="text-lg font-bold text-slate-900">
                  {MODE_ICON[connection.transport_type]} {connection.transport_name}
                </p>
                <Row label="From">{connection.departure_location}</Row>
                <Row label="To">{connection.destination}</Row>
                <Row label="Departs">{formatDateTimeIST(connection.departure_time)}</Row>
                <Row label="Ticket">{connection.ticket_reference || '-'}</Row>
                {status && (
                  <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${TONES[status.tone]}`}>{status.text}</p>
                )}
              </>
            ) : (
              <p className="text-slate-500">No connecting transport recorded.</p>
            )}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">My constraints</p>
              <div className="mt-2 space-y-2">
                <Row label="Max budget">₹{booking.max_budget_inr.toLocaleString('en-IN')}</Row>
                <Row label="Latest arrival">{formatDateTimeIST(booking.latest_arrival)}</Row>
                <Row label="Preferred modes">{booking.preferred_modes.join(', ')}</Row>
                <Row label="Final destination">{booking.final_destination}</Row>
              </div>
            </div>
          </InfoCard>
        </div>

        {/* ---------- Recovery section ---------- */}
        <div id="recovery" className="scroll-mt-20 space-y-5">
          {!disruption && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              <p className="font-semibold">No disruption on your flight.</p>
              <p className="mt-1">
                If airport staff report a delay or cancellation you will get an alert here instantly, and the agent will
                prepare your recovery options.
              </p>
            </div>
          )}

          {disruption && restored && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              <p className="font-semibold">Your flight is back on time.</p>
              <p className="mt-1">
                The earlier disruption ({disruption.type === 'delay' ? 'delay' : 'cancellation'}) was cleared by airport
                staff, so no recovery is needed.
              </p>
            </div>
          )}

          {disruption && !restored && (
            <>
              {/* What happened */}
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  disruption.type === 'cancellation'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <p className="font-semibold">
                  {disruption.type === 'cancellation'
                    ? `Flight ${flight.flight_number} was cancelled`
                    : `Flight ${flight.flight_number} is delayed by ${formatDuration(disruption.delay_minutes)}`}
                </p>
                <p className="mt-1">
                  Reason: {disruption.reason || 'Operational reasons'} · reported {formatDateTimeIST(disruption.created_at)} IST
                </p>
              </div>

              {agentError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p>{agentError}</p>
                  {agentStatus === 'error' && !assessment && (
                    <button
                      onClick={() => runAgent(false)}
                      className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}

              {!assessment && agentStatus !== 'error' && (
                <Spinner label="The recovery agent is scoring your priority and searching alternatives..." />
              )}

              <PriorityCard assessment={assessment} />

              {/* Choose an option */}
              {assessment && !accepted && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recommended alternatives</h2>
                    <p className="text-sm text-slate-500">
                      Filtered by your destination, budget, seats and deadline, then ranked by arrival time, price and
                      preferred mode.
                    </p>
                  </div>
                  <SimulatedBanner />

                  {notice && (
                    <p role="status" className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                      {notice}
                    </p>
                  )}

                  {suggested.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">No simulated option fits right now.</p>
                      <p className="mt-1">
                        Nothing matches your budget, deadline and destination. Please speak to the airport staff
                        desk.
                      </p>
                      <button
                        onClick={() => runAgent(false)}
                        disabled={agentStatus === 'running'}
                        className="mt-3 rounded-lg border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                      >
                        Search again
                      </button>
                    </div>
                  ) : (
                    <>
                      {suggested.map((opt) => (
                        <OptionCard
                          key={opt.id}
                          option={opt}
                          onAccept={handleAccept}
                          disabled={busy !== ''}
                          busy={busy === 'accept'}
                        />
                      ))}
                      <button
                        onClick={() => runAgent(true)}
                        disabled={busy !== ''}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {busy === 'regenerate' ? 'Finding another option...' : '↻ Request another option'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Accepted: itinerary */}
              {accepted && (
                <div className="space-y-4">
                  <SimulatedBanner />
                  {itinerary ? (
                    <ItineraryView itinerary={itinerary} alternative={accepted} payment={payment} />
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">Your option is booked, but the itinerary is missing.</p>
                      <button
                        onClick={() => handleAccept(accepted)}
                        disabled={busy !== ''}
                        className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {busy === 'accept' ? 'Generating...' : 'Generate itinerary'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}