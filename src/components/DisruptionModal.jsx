import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, isoToISTInput, istInputToISO, istInputToMs } from '../lib/time'

const REASONS = [
  'Air traffic congestion',
  'Bad weather',
  'Technical check on aircraft',
  'Late arrival of incoming aircraft',
  'Crew availability',
]

// A pop-up used for both "Mark Delayed" (mode="delay") and "Mark Cancelled" (mode="cancel").
// The parent only renders it while it is open, so its state starts fresh every time.
export default function DisruptionModal({ mode, flight, onClose, onDone }) {
  const isDelay = mode === 'delay'

  // Suggest 2 hours after the scheduled departure (or 1 hour after the current estimate).
  const [newDeparture, setNewDeparture] = useState(
    isDelay
      ? flight.estimated_departure
        ? isoToISTInput(flight.estimated_departure, 60)
        : isoToISTInput(flight.scheduled_departure, 120)
      : '',
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!reason.trim()) {
      setError('Please give a reason. Passengers will see it in their notification.')
      return
    }
    if (isDelay) {
      if (!newDeparture) {
        setError('Please enter the new departure time.')
        return
      }
      if (istInputToMs(newDeparture) <= new Date(flight.scheduled_departure).getTime()) {
        setError('The new departure must be later than the scheduled departure.')
        return
      }
    }

    setBusy(true)
    try {
      // One database call: updates the flight, creates the disruption record,
      // and notifies every passenger booked on this flight.
      const { error: rpcError } = await supabase.rpc('mark_flight_disruption', {
        p_flight_id: flight.id,
        p_type: isDelay ? 'delay' : 'cancellation',
        p_new_departure: isDelay ? istInputToISO(newDeparture) : null,
        p_reason: reason.trim(),
      })
      if (rpcError) throw rpcError
      onDone(isDelay ? 'delay' : 'cancellation')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={busy ? undefined : onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-bold text-slate-900">
          {isDelay ? 'Mark flight delayed' : 'Mark flight cancelled'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {flight.flight_number} · {flight.origin_code} → {flight.destination_code} · scheduled{' '}
          {formatDateTimeIST(flight.scheduled_departure)} IST
        </p>

        <div className="mt-5 space-y-4">
          {isDelay && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">New departure time (IST)</span>
              <input
                type="datetime-local"
                value={newDeparture}
                onChange={(e) => setNewDeparture(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <span className="mt-1 block text-xs text-slate-500">
                The arrival time is shifted by the same amount automatically.
              </span>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bad weather"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-700"
                >
                  {r}
                </button>
              ))}
            </div>
          </label>
        </div>

        <p
          className={`mt-4 rounded-lg p-3 text-sm ${
            isDelay ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'
          }`}
        >
          Every passenger on this flight will get an instant notification.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              isDelay ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy ? 'Notifying passengers...' : isDelay ? 'Confirm delay' : 'Confirm cancellation'}
          </button>
        </div>
      </form>
    </div>
  )
}