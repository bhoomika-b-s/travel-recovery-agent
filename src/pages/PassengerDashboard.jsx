import { useCallback, useEffect, useRef, useState } from 'react'
import AlertBanner from '../components/AlertBanner'
import Icon from '../components/Icon'
import ItineraryView from '../components/ItineraryView'
import Navbar from '../components/Navbar'
import OptionCard from '../components/OptionCard'
import PriorityCard from '../components/PriorityCard'
import SimulatedBanner from '../components/SimulatedBanner'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { callAgent } from '../lib/agent'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, formatDuration } from '../lib/time'

const EMPTY_RECOVERY = { disruption: null, assessment: null, alternatives: [], itinerary: null, payment: null }
const MODE_ICON = { flight: 'plane', train: 'train', bus: 'bus' }
const TONES = {
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-100 text-emerald-800',
}

// Shown while the agent runs: three steps light up one after another.
function AgentWorking() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setActive((n) => (n + 1) % 3), 1100)
    return () => clearInterval(timer)
  }, [])

  const steps = ['Scoring your priority', 'Filtering the inventory', 'Ranking the options']

  return (
    <div className="animate-pop rounded-3xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-300/60">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-indigo-400/40" />
          <Icon name="sparkles" className="relative h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-slate-900">The recovery agent is working</p>
          <p className="text-sm text-slate-500">This usually takes a few seconds.</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-500 ${
              i === active ? 'bg-white font-semibold text-indigo-700 shadow-sm' : 'text-slate-400'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                i < active ? 'bg-emerald-500 text-white' : i === active ? 'bg-indigo-600 text-white' : 'bg-slate-200'
              }`}
            >
              {i < active ? (
                <Icon name="check" className="h-3 w-3" strokeWidth={3} />
              ) : i === active ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              ) : null}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// A small label above a value, used inside the trip card.
function Detail({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{children}</p>
    </div>
  )
}

// A section heading with a coloured icon tile.
function SectionTitle({ icon, tone = 'bg-indigo-100 text-indigo-700', title, text }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon name={icon} className="size-4.5" />
      </span>
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {text && <p className="text-sm text-slate-500">{text}</p>}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div className="skeleton h-9 w-64" />
      <div className="skeleton h-64 w-full rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="skeleton h-48 rounded-3xl" />
        <div className="skeleton h-48 rounded-3xl" />
      </div>
    </main>
  )
}

export default function PassengerDashboard() {
  const { user, profile } = useAuth()
  const toast = useToast()
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
      toast.success('Booking confirmed. Your recovery itinerary is ready.')
    } catch (err) {
      setAgentError(err.message)
      toast.error(err.message)
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

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <LoadingSkeleton />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-600">
            <Icon name="ticket" className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">No trip found</h1>
          <p className="mt-2 text-sm text-slate-600">
            This account has no flight booking yet. Sign up again with a new email to add your trip details.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </main>
      </div>
    )
  }

  const status = connectionStatus()
  const firstName = (profile?.full_name || 'traveller').split(' ')[0]

  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50/60 via-slate-50 to-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Greeting */}
        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Hello, <span className="text-gradient">{firstName}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">Your trip and recovery plan. All times are IST.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Listening for live alerts
          </span>
        </div>

        {bookings.length > 1 && (
          <select
            value={booking.id}
            onChange={(e) => handleSelectBooking(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
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
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* ===== My flight: boarding pass ===== */}
        <section className="animate-fade-up overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-indigo-100/60">
          <div className="flex items-center justify-between bg-linear-to-r from-indigo-600 to-violet-600 px-5 py-3 text-white">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="plane" className="h-4 w-4" />
              {flight.airline}
            </span>
            <span className="font-mono text-sm font-bold">{flight.flight_number}</span>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">My flight</p>
              <StatusBadge status={flight.status} />
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div>
                <p className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{flight.origin_code}</p>
                <p className="text-sm text-slate-500">{flight.origin_city}</p>
              </div>
              <div className="relative min-w-17.5 flex-1">
                <div className="border-t-2 border-dashed border-slate-300" />
                <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-float-slow items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300/60">
                  <Icon name="plane" className="h-4 w-4 rotate-45" />
                </span>
              </div>
              <div className="text-right">
                <p className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                  {flight.destination_code}
                </p>
                <p className="text-sm text-slate-500">{flight.destination_city}</p>
              </div>
            </div>
          </div>

          {/* Perforated divider with side notches */}
          <div className="relative border-t-2 border-dashed border-slate-200">
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
          </div>

          <div className="grid gap-x-6 gap-y-4 p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Departure">
              {flight.status === 'delayed' ? (
                <>
                  <span className="mr-1 text-xs font-normal text-slate-400 line-through">
                    {formatDateTimeIST(flight.scheduled_departure)}
                  </span>
                  <span className="text-amber-600">{formatDateTimeIST(flight.estimated_departure)}</span>
                </>
              ) : (
                formatDateTimeIST(flight.scheduled_departure)
              )}
            </Detail>
            <Detail label="Arrival">
              {flight.status === 'delayed' ? (
                <>
                  <span className="mr-1 text-xs font-normal text-slate-400 line-through">
                    {formatDateTimeIST(flight.scheduled_arrival)}
                  </span>
                  <span className="text-amber-600">{formatDateTimeIST(flight.estimated_arrival)}</span>
                </>
              ) : (
                formatDateTimeIST(flight.scheduled_arrival)
              )}
            </Detail>
            <Detail label="PNR / Seat">
              <span className="font-mono">
                {booking.pnr || '-'} / {booking.seat || '-'}
              </span>
            </Detail>
            <Detail label="Gate">
              <span className="font-mono">{flight.gate || '-'}</span>
            </Detail>
          </div>

          {flight.status_reason && flight.status !== 'scheduled' && (
            <p className="mx-6 mb-6 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                <span className="font-semibold">Reason:</span> {flight.status_reason}
              </span>
            </p>
          )}
        </section>

        {/* ===== Connecting transport + constraints ===== */}
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card-hover animate-fade-up rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Connecting transport</p>
            {connection ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Icon name={MODE_ICON[connection.transport_type] ?? 'bus'} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{connection.transport_name}</p>
                    <p className="text-sm text-slate-500">
                      {connection.departure_location} → {connection.destination}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <Detail label="Departs">{formatDateTimeIST(connection.departure_time)}</Detail>
                  <Detail label="Ticket">
                    <span className="font-mono">{connection.ticket_reference || '-'}</span>
                  </Detail>
                </div>
                {status && (
                  <p className={`mt-4 rounded-xl px-3.5 py-2.5 text-sm font-semibold ${TONES[status.tone]}`}>
                    {status.text}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No connecting transport recorded.</p>
            )}
          </section>

          <section className="card-hover animate-fade-up rounded-3xl border border-slate-200 bg-white p-6 shadow-sm [animation-delay:100ms]">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">My constraints</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                ['wallet', 'Max budget', `₹${booking.max_budget_inr.toLocaleString('en-IN')}`],
                ['clock', 'Latest arrival', formatDateTimeIST(booking.latest_arrival)],
                ['target', 'Preferred modes', booking.preferred_modes.join(', ')],
                ['mapPin', 'Final destination', booking.final_destination],
              ].map(([icon, label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                    <Icon name={icon} className="h-4 w-4" />
                  </span>
                  <p className="mt-2 text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-semibold capitalize text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ===== Recovery section ===== */}
        <div id="recovery" className="scroll-mt-20 space-y-6">
          {!disruption && (
            <div className="flex animate-fade-up items-start gap-4 rounded-3xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-300/60">
                <Icon name="shield" className="h-6 w-6" />
              </span>
              <div>
                <p className="text-lg font-bold text-emerald-900">No disruption on your flight</p>
                <p className="mt-1 text-sm text-emerald-800">
                  If airport staff report a delay or cancellation you will get an alert here instantly, and the agent
                  will prepare your recovery options.
                </p>
              </div>
            </div>
          )}

          {disruption && restored && (
            <div className="flex animate-fade-up items-start gap-4 rounded-3xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-300/60">
                <Icon name="check" className="h-6 w-6" strokeWidth={3} />
              </span>
              <div>
                <p className="text-lg font-bold text-emerald-900">Your flight is back on time</p>
                <p className="mt-1 text-sm text-emerald-800">
                  The earlier disruption ({disruption.type === 'delay' ? 'delay' : 'cancellation'}) was cleared by
                  airport staff, so no recovery is needed.
                </p>
              </div>
            </div>
          )}

          {disruption && !restored && (
            <>
              {/* What happened */}
              <div
                className={`flex animate-fade-up items-start gap-4 rounded-3xl border p-5 ${
                  disruption.type === 'cancellation'
                    ? 'border-red-200 bg-linear-to-br from-red-50 to-white'
                    : 'border-amber-200 bg-linear-to-br from-amber-50 to-white'
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
                    disruption.type === 'cancellation'
                      ? 'bg-red-500 shadow-red-300/60'
                      : 'bg-amber-500 shadow-amber-300/60'
                  }`}
                >
                  <Icon name={disruption.type === 'cancellation' ? 'alert' : 'clock'} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {disruption.type === 'cancellation'
                      ? `Flight ${flight.flight_number} was cancelled`
                      : `Flight ${flight.flight_number} is delayed by ${formatDuration(disruption.delay_minutes)}`}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    Reason: {disruption.reason || 'Operational reasons'} · reported{' '}
                    {formatDateTimeIST(disruption.created_at)} IST
                  </p>
                </div>
              </div>

              {agentError && (
                <div
                  role="alert"
                  className="animate-pop rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <p className="flex items-start gap-2">
                    <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                    {agentError}
                  </p>
                  {agentStatus === 'error' && !assessment && (
                    <button
                      onClick={() => runAgent(false)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      <Icon name="refresh" className="h-4 w-4" /> Try again
                    </button>
                  )}
                </div>
              )}

              {!assessment && agentStatus !== 'error' && <AgentWorking />}

              <PriorityCard assessment={assessment} />

              {/* Choose an option */}
              {assessment && !accepted && (
                <div className="space-y-5">
                  <SectionTitle
                    icon="search"
                    title="Recommended alternatives"
                    text="Filtered by your destination, budget, seats and deadline, then ranked by arrival time, price and preferred mode."
                  />
                  <SimulatedBanner />

                  {notice && (
                    <p
                      role="status"
                      className="flex animate-pop items-start gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
                    >
                      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                      {notice}
                    </p>
                  )}

                  {suggested.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
                      <p className="text-base font-bold text-slate-900">No simulated option fits right now</p>
                      <p className="mt-1">
                        Nothing matches your budget, deadline and destination. Please speak to the airport staff desk.
                      </p>
                      <button
                        onClick={() => runAgent(false)}
                        disabled={agentStatus === 'running'}
                        className="btn-secondary mt-4 px-4! py-2! text-sm! disabled:opacity-60"
                      >
                        <Icon name="refresh" className="h-4 w-4" /> Search again
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-5 pt-2">
                        {suggested.map((opt) => (
                          <OptionCard
                            key={opt.id}
                            option={opt}
                            onAccept={handleAccept}
                            disabled={busy !== ''}
                            busy={busy === 'accept'}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => runAgent(true)}
                        disabled={busy !== ''}
                        className="btn-secondary disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <Icon name="refresh" className={`h-4 w-4 ${busy === 'regenerate' ? 'animate-spin' : ''}`} />
                        {busy === 'regenerate' ? 'Finding another option...' : 'Request another option'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Accepted: itinerary */}
              {accepted && (
                <div className="space-y-5">
                  <SimulatedBanner />
                  {itinerary ? (
                    <ItineraryView itinerary={itinerary} alternative={accepted} payment={payment} />
                  ) : (
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
                      <p className="text-base font-bold text-slate-900">
                        Your option is booked, but the itinerary is missing
                      </p>
                      <button
                        onClick={() => handleAccept(accepted)}
                        disabled={busy !== ''}
                        className="btn-primary mt-4 px-5! py-2.5! text-sm! disabled:opacity-60"
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