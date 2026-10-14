import { useState } from 'react'
import { formatDateTimeIST, formatDuration, formatTimeIST } from '../lib/time'

const MODE_ICON = { flight: '✈️', train: '🚆', bus: '🚌' }

// One ranked alternative. `option` is a row from "alternatives" with its transport_inventory embedded.
export default function OptionCard({ option, onAccept, disabled, busy }) {
  const [confirming, setConfirming] = useState(false)
  const inv = option.transport_inventory
  if (!inv) return null

  const b = option.score_breakdown ?? {}
  const departMs = new Date(option.departure_at).getTime()
  const arriveMs = new Date(option.arrival_at).getTime()
  const boardBy = new Date(departMs - (inv.boarding_offset_minutes ?? 0) * 60000)

  // Three small bars showing where the ranking points came from.
  const parts = [
    ['Arrival', b.arrival?.points, b.arrival?.weight],
    ['Price', b.price?.points, b.price?.weight],
    ['Preferred mode', b.preferred_mode?.points, b.preferred_mode?.weight],
  ]

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        option.rank === 1 ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
              option.rank === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            #{option.rank}
          </span>
          <div>
            <p className="font-semibold text-slate-900">
              {MODE_ICON[inv.mode]} {inv.carrier} · {inv.service_number}
            </p>
            <p className="text-xs text-slate-500">
              {inv.mode.charAt(0).toUpperCase() + inv.mode.slice(1)}
              {inv.travel_class ? ` · ${inv.travel_class}` : ''} · {inv.seats_available} seat
              {inv.seats_available === 1 ? '' : 's'} left
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">₹{option.price_inr.toLocaleString('en-IN')}</p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            Simulated
          </span>
        </div>
      </div>

      {/* Route and times */}
      <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="font-semibold text-slate-900">{formatTimeIST(option.departure_at)}</p>
          <p className="text-slate-600">{inv.origin_hub}</p>
          <p className="text-xs text-slate-500">{formatDateTimeIST(option.departure_at)} IST</p>
        </div>
        <div className="text-center text-xs text-slate-500">
          <p>→</p>
          <p>{formatDuration((arriveMs - departMs) / 60000)}</p>
        </div>
        <div className="sm:text-right">
          <p className="font-semibold text-slate-900">{formatTimeIST(option.arrival_at)}</p>
          <p className="text-slate-600">{inv.destination_hub}</p>
          <p className="text-xs text-slate-500">{formatDateTimeIST(option.arrival_at)} IST</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Be at <span className="font-medium text-slate-900">{inv.boarding_point || inv.origin_hub}</span> by{' '}
        <span className="font-medium text-slate-900">{formatTimeIST(boardBy)}</span>.
      </p>

      {option.reasoning && <p className="mt-3 text-sm leading-relaxed text-slate-700">{option.reasoning}</p>}

      {/* Ranking score breakdown */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ranking score {option.score ?? b.total ?? '-'} / 100
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {parts.map(([label, points, weight]) => {
            const max = (weight ?? 0) * 100
            const pct = max > 0 ? Math.min(100, ((points ?? 0) / max) * 100) : 0
            return (
              <div key={label}>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{label}</span>
                  <span>
                    {points ?? 0}
                    {weight !== undefined ? ` / ${Math.round(max)}` : ''}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Accept (with a confirm step) */}
      <div className="mt-5">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={disabled}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Accept this option
          </button>
        ) : (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-sm text-indigo-900">
              Confirm <strong>{inv.carrier} {inv.service_number}</strong>? The fare of ₹
              {option.price_inr.toLocaleString('en-IN')} is recorded as <strong>pending settlement</strong> with the
              airport authority. No real payment is taken.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onAccept(option)}
                disabled={disabled || busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy ? 'Booking...' : 'Confirm booking'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}