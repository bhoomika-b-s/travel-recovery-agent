import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, formatTimeIST } from '../lib/time'

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'

function StatCard({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  )
}

export default function StaffDashboard() {
  const { profile, airportCode } = useAuth()

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
        setNotice({
          text: `Simulated: flight ${d.flights.flight_number} (${d.flights.origin_code} → ${d.flights.destination_code}) ${what}. Reason: ${d.reason}. Passengers have been notified.`,
          flightId: d.flight_id,
        })
      }
      await loadFlights()
    } catch (err) {
      setError(err.message || 'Could not simulate a disruption.')
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
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Heading + simulate button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Staff dashboard · {airportCode}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Welcome, {profile?.full_name}. All flights arriving at or departing from {airportCode}. Times are IST.
            </p>
          </div>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            {simulating ? 'Simulating...' : '🎲 Simulate random disruption'}
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Flights" value={stats.total} tone="text-slate-900" />
          <StatCard label="Delayed" value={stats.delayed} tone="text-amber-600" />
          <StatCard label="Cancelled" value={stats.cancelled} tone="text-red-600" />
          <StatCard label="Passengers" value={stats.passengers} tone="text-indigo-600" />
        </div>

        {notice && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{notice.text}</span>
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
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select value={direction} onChange={(e) => setDirection(e.target.value)} className={selectClass}>
            <option value="all">Departing and arriving</option>
            <option value="departing">Departing only</option>
            <option value="arriving">Arriving only</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="all">All statuses</option>
            <option value="scheduled">On time</option>
            <option value="delayed">Delayed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="text-sm text-slate-500">
            Showing {visible.length} of {flights.length}
          </span>
        </div>

        {/* Flights table */}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    Loading flights...
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No flights match these filters.
                  </td>
                </tr>
              )}

              {visible.map((f) => {
                const departing = f.origin_code === airportCode
                return (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{f.flight_number}</p>
                      <p className="text-xs text-slate-500">{f.airline}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {f.origin_code} → {f.destination_code}
                      <p className="text-xs text-slate-500">
                        {f.origin_city} to {f.destination_city}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          departing ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        {departing ? 'Departing' : 'Arriving'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {f.status === 'delayed' ? (
                        <>
                          <span className="text-xs text-slate-400 line-through">
                            {formatTimeIST(f.scheduled_departure)}
                          </span>{' '}
                          <span className="font-semibold text-amber-700">
                            {formatDateTimeIST(f.estimated_departure)}
                          </span>
                        </>
                      ) : (
                        formatDateTimeIST(f.scheduled_departure)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {f.status === 'delayed' ? (
                        <>
                          <span className="text-xs text-slate-400 line-through">
                            {formatTimeIST(f.scheduled_arrival)}
                          </span>{' '}
                          <span className="font-semibold text-amber-700">
                            {formatDateTimeIST(f.estimated_arrival)}
                          </span>
                        </>
                      ) : (
                        formatDateTimeIST(f.scheduled_arrival)
                      )}
                    </td>
                    <td className="px-4 py-3">{f.gate || '-'}</td>
                    <td className="px-4 py-3">{f.passenger_bookings?.[0]?.count ?? 0}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/staff/flights/${f.id}`}
                        className="whitespace-nowrap rounded-lg border border-indigo-600 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}