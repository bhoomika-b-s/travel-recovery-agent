import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatDateTimeIST, isoToISTInput, istInputToISO, istInputToMs } from '../lib/time'
import { inputBase } from './FormField'
import Icon from './Icon'

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
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-pop overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Coloured header */}
        <div
          className={`flex items-start gap-3 px-6 py-5 text-white ${
            isDelay ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-rose-600'
          }`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
            <Icon name={isDelay ? 'clock' : 'alert'} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">{isDelay ? 'Mark flight delayed' : 'Mark flight cancelled'}</h2>
            <p className="mt-0.5 text-sm text-white/85">
              {flight.flight_number} · {flight.origin_code} → {flight.destination_code} · scheduled{' '}
              {formatDateTimeIST(flight.scheduled_departure)} IST
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {isDelay && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">New departure time (IST)</span>
              <input
                type="datetime-local"
                value={newDeparture}
                onChange={(e) => setNewDeparture(e.target.value)}
                className={inputBase}
              />
              <span className="mt-1 block text-xs text-slate-500">
                The arrival time is shifted by the same amount automatically.
              </span>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bad weather"
              className={inputBase}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    reason === r
                      ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700'
                      : 'border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </label>

          <p
            className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
              isDelay ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'
            }`}
          >
            <Icon name="bell" className="mt-0.5 h-4 w-4 shrink-0" />
            Every passenger on this flight will get an instant notification.
          </p>

          {error && (
            <p
              role="alert"
              className="flex animate-pop items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary !px-5 !py-2.5 disabled:opacity-60">
            Back
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-70 ${
              isDelay ? 'bg-amber-600 shadow-amber-300/50 hover:bg-amber-700' : 'bg-red-600 shadow-red-300/50 hover:bg-red-700'
            }`}
          >
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {busy ? 'Notifying passengers...' : isDelay ? 'Confirm delay' : 'Confirm cancellation'}
          </button>
        </div>
      </form>
    </div>
  )
}