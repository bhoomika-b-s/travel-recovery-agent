import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CountUp from '../components/CountUp'
import Icon from '../components/Icon'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, formatTimeIST } from '../lib/time'

// A live clock in IST. It lives in its own component so only it re-renders every second.
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <span className="font-mono tabular-nums">
      {now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })} IST
    </span>
  )
}

const TONES = {
  slate: 'from-slate-600 to-slate-800 shadow-slate-300/60',
  amber: 'from-amber-400 to-orange-500 shadow-amber-300/60',
  red: 'from-red-500 to-rose-600 shadow-red-300/60',
  indigo: 'from-indigo-500 to-violet-600 shadow-indigo-300/60',
}

function StatCard({ label, value, icon, tone, delay }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="card-hover animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-lg ${TONES[tone]}`}>
          <Icon name={icon} className="size-4.5" />
        </span>
      </div>
      <p className="mt-2 text-4xl font-extrabold text-slate-900">
        <CountUp end={value} duration={900} />
      </p>
    </div>
  )
}

// A row of pill buttons used for the filters.
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${
            value === v ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function StaffDashboard() {
  const { profile, airportCode } = useAuth()
  const toast = useToast()

  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [direction, setDirection] = useState('all') // all | departing | arriving
  const [statusFilter, setStatusFilter] = useState('all') // all | scheduled | delayed | cancelled
  const [simulating, setSimulating] = useState(false)
  const [notice, setNotice] = useState(null) // { text, flightId }

  // Load every flight arriving at or departing from this staff member's airport.
  // (Row Level Security already limits this; the filter just makes it explicit.)
  const loadFlights = useCallback(async () => {
    if (!airportCode) return
    const { data, error: queryError } = await supabase
      .from('flights')
      .select('*, passenger_bookings(count)')
      .or(`origin_code.eq.${airportCode},destination_code.eq.${airportCode}`)
      .order('scheduled_departure', { ascending: true })

    if (queryError) {
      setError(queryError.message)
    } else {
      setError('')
      setFlights(data ?? [])
    }
    setLoading(false)
  }, [airportCode])

  // Load once, then reload whenever any flight changes (Supabase Realtime).
  useEffect(() => {
    loadFlights()

    const channel = supabase
      .channel('staff-flights-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, () => loadFlights())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadFlights])

  // Demo button: the database picks a random flight and delays or cancels it.
  async function handleSimulate() {
    setSimulating(true)
    setNotice(null)
    setError('')
    try {
      const { data: disruptionId, error: rpcError } = await supabase.rpc('simulate_random_disruption')
      if (rpcError) throw rpcError

      // Fetch the disruption so we can tell the user what happened.
      const { data: d } = await supabase
        .from('disruptions')
        .select('type, delay_minutes, reason, flight_id, flights(flight_number, origin_code, destination_code)')
        .eq('id', disruptionId)
        .maybeSingle()

      if (d) {
        const what =
          d.type === 'delay' ? `delayed by ${Math.round(d.delay_minutes / 15) * 15} minutes` : 'cancelled'
        const text = `Flight ${d.flights.flight_number} (${d.flights.origin_code} → ${d.flights.destination_code}) ${what}. Reason: ${d.reason}.`
        setNotice({ text: `Simulated: ${text} Passengers have been notified.`, flightId: d.flight_id })
        toast.success(`Simulated: ${text}`)
      }
      await loadFlights()
    } catch (err) {
      const message = err.message || 'Could not simulate a disruption.'
      setError(message)
      toast.error(message)
    } finally {
      setSimulating(false)
    }
  }

  // Apply the two filters.
  const visible = useMemo(
    () =>
      flights.filter((f) => {
        const isDeparting = f.origin_code === airportCode
        if (direction === 'departing' && !isDeparting) return false
        if (direction === 'arriving' && isDeparting) return false
        if (statusFilter !== 'all' && f.status !== statusFilter) return false
        return true
      }),
    [flights, direction, statusFilter, airportCode],
  )

  // Numbers for the stat cards.
  const stats = useMemo(
    () => ({
      total: flights.length,
      delayed: flights.filter((f) => f.status === 'delayed').length,
      cancelled: flights.filter((f) => f.status === 'cancelled').length,
      passengers: flights.reduce((sum, f) => sum + (f.passenger_bookings?.[0]?.count ?? 0), 0),
    }),
    [flights],
  )

  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50/60 via-slate-50 to-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Heading + simulate button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Staff dashboard <span className="text-gradient">· {airportCode}</span>
              </h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-amber-300">
                <Icon name="clock" className="h-3.5 w-3.5" />
                <Clock />
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Welcome, {profile?.full_name}. Every flight arriving at or departing from {airportCode}. Times are IST.
            </p>
          </div>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {simulating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Simulating...
              </>
            ) : (
              <>
                <Icon name="dice" className="size-4.5" />
                Simulate random disruption
              </>
            )}
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Flights" value={stats.total} icon="plane" tone="slate" delay={0} />
          <StatCard label="Delayed" value={stats.delayed} icon="clock" tone="amber" delay={80} />
          <StatCard label="Cancelled" value={stats.cancelled} icon="alert" tone="red" delay={160} />
          <StatCard label="Passengers" value={stats.passengers} icon="users" tone="indigo" delay={240} />
        </div>

        {notice && (
          <div className="mt-4 flex animate-pop flex-col gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              {notice.text}
            </span>
            <span className="flex shrink-0 gap-3">
              <Link to={`/staff/flights/${notice.flightId}`} className="font-semibold underline">
                View flight
              </Link>
              <button onClick={() => setNotice(null)} className="text-indigo-700 hover:underline">
                Dismiss
              </button>
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 flex animate-pop items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Segmented
            value={direction}
            onChange={setDirection}
            options={[
              ['all', 'All'],
              ['departing', 'Departing'],
              ['arriving', 'Arriving'],
            ]}
          />
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              ['all', 'Any status'],
              ['scheduled', 'On time'],
              ['delayed', 'Delayed'],
              ['cancelled', 'Cancelled'],
            ]}
          />
        </div>

        {/* Flights table, styled as a departure board */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-slate-300/50">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-semibold uppercase tracking-widest text-amber-400">
              <Icon name="plane" className="h-4 w-4" />
              Flight board · {airportCode}
            </span>
            <span className="text-slate-400">
              Showing {visible.length} of {flights.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="text-[11px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Flight</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Departure</th>
                  <th className="px-4 py-3">Arrival</th>
                  <th className="px-4 py-3">Gate</th>
                  <th className="px-4 py-3">Pax</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading &&
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-4 py-3">
                        <div className="h-8 animate-pulse rounded-lg bg-slate-800" />
                      </td>
                    </tr>
                  ))}

                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                      No flights match these filters.
                    </td>
                  </tr>
                )}

                {visible.map((f, i) => {
                  const departing = f.origin_code === airportCode
                  return (
                    <tr
                      key={f.id}
                      style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                      className="animate-slide-in transition hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono text-base font-bold text-amber-300">{f.flight_number}</p>
                        <p className="text-xs text-slate-400">{f.airline}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-mono font-semibold">
                          {f.origin_code} → {f.destination_code}
                        </span>
                        <p className="text-xs text-slate-400">
                          {f.origin_city} to {f.destination_city}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            departing ? 'bg-sky-500/15 text-sky-300' : 'bg-violet-500/15 text-violet-300'
                          }`}
                        >
                          {departing ? 'Departing' : 'Arriving'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">
                        {f.status === 'delayed' ? (
                          <>
                            <span className="text-xs text-slate-500 line-through">
                              {formatTimeIST(f.scheduled_departure)}
                            </span>{' '}
                            <span className="font-semibold text-amber-300">
                              {formatDateTimeIST(f.estimated_departure)}
                            </span>
                          </>
                        ) : (
                          formatDateTimeIST(f.scheduled_departure)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">
                        {f.status === 'delayed' ? (
                          <>
                            <span className="text-xs text-slate-500 line-through">
                              {formatTimeIST(f.scheduled_arrival)}
                            </span>{' '}
                            <span className="font-semibold text-amber-300">
                              {formatDateTimeIST(f.estimated_arrival)}
                            </span>
                          </>
                        ) : (
                          formatDateTimeIST(f.scheduled_arrival)
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">{f.gate || '-'}</td>
                      <td className="px-4 py-3 font-mono">{f.passenger_bookings?.[0]?.count ?? 0}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={f.status} onDark />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/staff/flights/${f.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/10"
                        >
                          Manage <Icon name="arrowRight" className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}