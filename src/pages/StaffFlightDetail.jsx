import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DisruptionModal from '../components/DisruptionModal'
import Navbar from '../components/Navbar'
import StatusBadge from '../components/StatusBadge'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, formatDuration } from '../lib/time'

export default function StaffFlightDetail() {
  const { flightId } = useParams()

  const [flight, setFlight] = useState(null)
  const [bookings, setBookings] = useState([])
  const [disruptions, setDisruptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalMode, setModalMode] = useState(null) // null | 'delay' | 'cancel'
  const [restoring, setRestoring] = useState(false)
  const [success, setSuccess] = useState('')

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
    setSuccess(
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
    setSuccess('')
    try {
      const { error: rpcError } = await supabase.rpc('reset_flight_status', { p_flight_id: flightId })
      if (rpcError) throw rpcError
      setSuccess('Flight restored to on time. (Earlier notifications are kept.)')
      await loadAll()
    } catch (err) {
      setError(err.message || 'Could not restore the flight.')
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
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      </div>
    )
  }

  // Not found, or not one of this staff member's flights (Row Level Security hides it).
  if (!flight) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-slate-900">Flight not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            This flight does not exist, or it does not arrive at or depart from your airport.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <Link
            to="/staff"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to dashboard
          </Link>
        </main>
      </div>
    )
  }

  const isCancelled = flight.status === 'cancelled'
  const isScheduled = flight.status === 'scheduled'

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link to="/staff" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to all flights
        </Link>

        {/* Flight summary */}
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{flight.flight_number}</h1>
                <StatusBadge status={flight.status} />
              </div>
              <p className="mt-1 text-slate-600">
                {flight.airline} · {flight.origin_city} ({flight.origin_code}) → {flight.destination_city} (
                {flight.destination_code})
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setModalMode('delay')}
                disabled={isCancelled}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark Delayed
              </button>
              <button
                onClick={() => setModalMode('cancel')}
                disabled={isCancelled}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark Cancelled
              </button>
              {!isScheduled && (
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {restoring ? 'Restoring...' : 'Restore to on time'}
                </button>
              )}
            </div>
          </div>

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-slate-500">Scheduled departure</dt>
              <dd className="font-medium text-slate-900">{formatDateTimeIST(flight.scheduled_departure)} IST</dd>
            </div>
            <div>
              <dt className="text-slate-500">Scheduled arrival</dt>
              <dd className="font-medium text-slate-900">{formatDateTimeIST(flight.scheduled_arrival)} IST</dd>
            </div>
            <div>
              <dt className="text-slate-500">New departure / arrival</dt>
              <dd className="font-medium text-amber-700">
                {flight.status === 'delayed'
                  ? `${formatDateTimeIST(flight.estimated_departure)} / ${formatDateTimeIST(flight.estimated_arrival)}`
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Gate</dt>
              <dd className="font-medium text-slate-900">{flight.gate || '-'}</dd>
            </div>
          </dl>

          {flight.status_reason && !isScheduled && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">Reason:</span> {flight.status_reason}
            </p>
          )}
        </section>

        {success && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Passenger list */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Passengers ({bookings.length})</h2>
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
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No passengers are booked on this flight yet.
                    </td>
                  </tr>
                )}

                {bookings.map((b) => {
                  const ct = b.connecting_transport?.[0]
                  const gap = connectionGap(b)
                  return (
                    <tr key={b.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{b.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{b.profiles?.email}</p>
                        <p className="text-xs text-slate-500">{b.profiles?.phone}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {b.pnr || '-'} / {b.seat || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {ct ? (
                          <>
                            <p className="font-medium text-slate-900">
                              {ct.transport_type === 'flight' ? '✈️' : ct.transport_type === 'train' ? '🚆' : '🚌'}{' '}
                              {ct.transport_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {ct.departure_location} → {ct.destination}
                            </p>
                            <p className="text-xs text-slate-500">
                              Departs {formatDateTimeIST(ct.departure_time)} IST
                            </p>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {isCancelled ? (
                          <span className="font-medium text-red-700">Flight cancelled</span>
                        ) : gap === null ? (
                          '-'
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                      <td className="whitespace-nowrap px-4 py-3">₹{b.max_budget_inr.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{b.final_destination}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Disruption history */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900">Disruption history</h2>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {disruptions.length === 0 ? (
              <p className="text-sm text-slate-500">No disruptions have been recorded for this flight.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {disruptions.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between">
                    <span>
                      <span
                        className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          d.type === 'delay' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {d.type === 'delay' ? `Delay · ${formatDuration(d.delay_minutes)}` : 'Cancellation'}
                      </span>
                      {d.reason}
                    </span>
                    <span className="text-slate-500">{formatDateTimeIST(d.created_at)} IST</span>
                  </li>
                ))}
              </ul>
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