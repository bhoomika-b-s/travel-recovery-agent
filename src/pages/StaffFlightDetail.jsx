import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DisruptionModal from '../components/DisruptionModal'
import Icon from '../components/Icon'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, formatDuration } from '../lib/time'

const BAR = {
  scheduled: 'from-emerald-400 to-teal-500',
  delayed: 'from-amber-400 to-orange-500',
  cancelled: 'from-red-500 to-rose-600',
}

const TYPE_ICON = { flight: 'plane', train: 'train', bus: 'bus' }

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default function StaffFlightDetail() {
  const { flightId } = useParams()
  const toast = useToast()

  const [flight, setFlight] = useState(null)
  const [bookings, setBookings] = useState([])
  const [disruptions, setDisruptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalMode, setModalMode] = useState(null) // null | 'delay' | 'cancel'
  const [restoring, setRestoring] = useState(false)

  // Load the flight, its passengers (with connecting transport) and its disruption history.
  const loadAll = useCallback(async () => {
    const [flightRes, bookingsRes, disruptionsRes] = await Promise.all([
      supabase.from('flights').select('*').eq('id', flightId).maybeSingle(),
      supabase
        .from('passenger_bookings')
        .select('*, profiles(full_name, email, phone), connecting_transport(*)')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: true }),
      supabase
        .from('disruptions')
        .select('*')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: false }),
    ])

    const firstError = flightRes.error || bookingsRes.error || disruptionsRes.error
    if (firstError) setError(firstError.message)
    else setError('')

    setFlight(flightRes.data ?? null)
    setBookings(bookingsRes.data ?? [])
    setDisruptions(disruptionsRes.data ?? [])
    setLoading(false)
  }, [flightId])

  // Load once, then refresh whenever this flight changes (Supabase Realtime).
  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel(`staff-flight-${flightId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flights', filter: `id=eq.${flightId}` },
        () => loadAll(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [flightId, loadAll])

  // Called by the modal after the RPC succeeded.
  async function handleDisruptionDone(type) {
    setModalMode(null)
    toast.success(
      `Flight marked ${type === 'delay' ? 'delayed' : 'cancelled'}. ${bookings.length} passenger${
        bookings.length === 1 ? '' : 's'
      } notified.`,
    )
    await loadAll()
  }

  // Demo helper: put the flight back to "on time" so you can run the demo again.
  async function handleRestore() {
    setRestoring(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('reset_flight_status', { p_flight_id: flightId })
      if (rpcError) throw rpcError
      toast.info('Flight restored to on time. Earlier notifications are kept.')
      await loadAll()
    } catch (err) {
      const message = err.message || 'Could not restore the flight.'
      setError(message)
      toast.error(message)
    } finally {
      setRestoring(false)
    }
  }

  // Minutes between the flight landing and the passenger's connecting transport leaving.
  function connectionGap(booking) {
    const ct = booking.connecting_transport?.[0]
    if (!ct || !flight) return null
    if (flight.status === 'cancelled') return null
    const arrival = new Date(flight.estimated_arrival ?? flight.scheduled_arrival).getTime()
    return Math.round((new Date(ct.departure_time).getTime() - arrival) / 60000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-44 w-full rounded-3xl" />
          <div className="skeleton h-64 w-full rounded-3xl" />
        </main>
      </div>
    )
  }

  // Not found, or not one of this staff member's flights (Row Level Security hides it).
  if (!flight) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-slate-600">
            <Icon name="search" className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Flight not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            This flight does not exist, or it does not arrive at or depart from your airport.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <Link to="/staff" className="btn-primary mt-5">
            <Icon name="arrowLeft" className="h-4 w-4" /> Back to dashboard
          </Link>
        </main>
      </div>
    )
  }

  const isCancelled = flight.status === 'cancelled'
  const isScheduled = flight.status === 'scheduled'

  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50/60 via-slate-50 to-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/staff"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition hover:text-indigo-800"
        >
          <Icon name="arrowLeft" className="h-4 w-4" /> Back to all flights
        </Link>

        {/* Flight summary */}
        <section className="mt-4 animate-fade-up overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-indigo-100/50">
          <div className={`h-1.5 bg-linear-to-r ${BAR[flight.status] ?? BAR.scheduled}`} />
          <div className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-mono text-2xl font-extrabold text-slate-900">{flight.flight_number}</h1>
                  <StatusBadge status={flight.status} />
                  <span className="text-sm text-slate-500">{flight.airline}</span>
                </div>

                {/* Route graphic */}
                <div className="mt-5 flex items-center gap-4">
                  <div>
                    <p className="text-4xl font-extrabold tracking-tight text-slate-900">{flight.origin_code}</p>
                    <p className="text-sm text-slate-500">{flight.origin_city}</p>
                  </div>
                  <div className="relative min-w-22.5 flex-1 sm:min-w-40">
                    <div className="border-t-2 border-dashed border-slate-300" />
                    <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300/60">
                      <Icon name="plane" className="h-4 w-4 rotate-45" />
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-extrabold tracking-tight text-slate-900">{flight.destination_code}</p>
                    <p className="text-sm text-slate-500">{flight.destination_city}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setModalMode('delay')}
                  disabled={isCancelled}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-300/50 transition hover:-translate-y-0.5 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  <Icon name="clock" className="h-4 w-4" /> Mark Delayed
                </button>
                <button
                  onClick={() => setModalMode('cancel')}
                  disabled={isCancelled}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-300/50 transition hover:-translate-y-0.5 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  <Icon name="x" className="h-4 w-4" /> Mark Cancelled
                </button>
                {!isScheduled && (
                  <button
                    onClick={handleRestore}
                    disabled={restoring}
                    className="btn-secondary px-4! py-2.5! text-sm! disabled:opacity-60"
                  >
                    <Icon name="refresh" className={`h-4 w-4 ${restoring ? 'animate-spin' : ''}`} />
                    {restoring ? 'Restoring...' : 'Restore to on time'}
                  </button>
                )}
              </div>
            </div>

            <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-slate-500">Scheduled departure</dt>
                <dd className="font-mono font-semibold text-slate-900">{formatDateTimeIST(flight.scheduled_departure)} IST</dd>
              </div>
              <div>
                <dt className="text-slate-500">Scheduled arrival</dt>
                <dd className="font-mono font-semibold text-slate-900">{formatDateTimeIST(flight.scheduled_arrival)} IST</dd>
              </div>
              <div>
                <dt className="text-slate-500">New departure / arrival</dt>
                <dd className="font-mono font-semibold text-amber-600">
                  {flight.status === 'delayed'
                    ? `${formatDateTimeIST(flight.estimated_departure)} / ${formatDateTimeIST(flight.estimated_arrival)}`
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Gate</dt>
                <dd className="font-mono font-semibold text-slate-900">{flight.gate || '-'}</dd>
              </div>
            </dl>

            {flight.status_reason && !isScheduled && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
                <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  <span className="font-semibold">Reason:</span> {flight.status_reason}
                </span>
              </p>
            )}
          </div>
        </section>

        {error && (
          <p role="alert" className="mt-4 flex animate-pop items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {/* Passenger list */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Icon name="users" className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">Passengers ({bookings.length})</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            "Connection gap" is the time between this flight landing and the passenger's connecting transport leaving.
            Short gaps are the most at risk.
          </p>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Passenger</th>
                  <th className="px-4 py-3">PNR / Seat</th>
                  <th className="px-4 py-3">Connecting transport</th>
                  <th className="px-4 py-3">Connection gap</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Final destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No passengers are booked on this flight yet.
                    </td>
                  </tr>
                )}

                {bookings.map((b, i) => {
                  const ct = b.connecting_transport?.[0]
                  const gap = connectionGap(b)
                  return (
                    <tr
                      key={b.id}
                      style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}
                      className="animate-slide-in align-top transition hover:bg-indigo-50/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
                            {initials(b.profiles?.full_name)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{b.profiles?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{b.profiles?.email}</p>
                            <p className="text-xs text-slate-500">{b.profiles?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">
                        {b.pnr || '-'} / {b.seat || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {ct ? (
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <Icon name={TYPE_ICON[ct.transport_type] ?? 'bus'} className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-medium text-slate-900">{ct.transport_name}</p>
                              <p className="text-xs text-slate-500">
                                {ct.departure_location} → {ct.destination}
                              </p>
                              <p className="text-xs text-slate-500">Departs {formatDateTimeIST(ct.departure_time)} IST</p>
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {isCancelled ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                            Flight cancelled
                          </span>
                        ) : gap === null ? (
                          '-'
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              gap < 0
                                ? 'bg-red-100 text-red-800'
                                : gap < 60
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {gap < 0 ? `Missed by ${formatDuration(-gap)}` : formatDuration(gap)}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono">₹{b.max_budget_inr.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{b.final_destination}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Disruption history */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Icon name="clock" className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">Disruption history</h2>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {disruptions.length === 0 ? (
              <p className="text-sm text-slate-500">No disruptions have been recorded for this flight.</p>
            ) : (
              <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6">
                {disruptions.map((d) => (
                  <li key={d.id} className="relative">
                    <span
                      className={`absolute -left-8.25 top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                        d.type === 'delay' ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <span
                          className={`mr-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            d.type === 'delay' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {d.type === 'delay' ? `Delay · ${formatDuration(d.delay_minutes)}` : 'Cancellation'}
                        </span>
                        {d.reason}
                      </span>
                      <span className="font-mono text-xs text-slate-500">{formatDateTimeIST(d.created_at)} IST</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </main>

      {/* The pop-up is only rendered while open, so its fields reset every time. */}
      {modalMode && (
        <DisruptionModal
          mode={modalMode}
          flight={flight}
          onClose={() => setModalMode(null)}
          onDone={handleDisruptionDone}
        />
      )}
    </div>
  )
}