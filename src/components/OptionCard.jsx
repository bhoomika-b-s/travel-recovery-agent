import { useEffect, useState } from 'react'
import { formatDateTimeIST, formatDuration, formatTimeIST } from '../lib/time'
import Icon from './Icon'

const MODE = {
  flight: { icon: 'plane', tile: 'from-sky-500 to-blue-600', shadow: 'shadow-sky-300/60' },
  train: { icon: 'train', tile: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-300/60' },
  bus: { icon: 'bus', tile: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-300/60' },
}

// One ranked alternative. `option` is a row from "alternatives" with its transport_inventory embedded.
export default function OptionCard({ option, onAccept, disabled, busy }) {
  const [confirming, setConfirming] = useState(false)
  const [go, setGo] = useState(false)

  // The ranking bars grow just after the card appears.
  useEffect(() => {
    const timer = setTimeout(() => setGo(true), 250)
    return () => clearTimeout(timer)
  }, [])

  const inv = option.transport_inventory
  if (!inv) return null

  const mode = MODE[inv.mode] ?? MODE.bus
  const best = option.rank === 1
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
      style={{ animationDelay: `${(option.rank - 1) * 120}ms` }}
      className={`card-hover relative animate-fade-up rounded-3xl border bg-white p-5 shadow-sm ${
        best ? 'border-indigo-300 ring-4 ring-indigo-100' : 'border-slate-200'
      }`}
    >
      {best && (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-indigo-300/60">
          <Icon name="sparkles" className="h-3.5 w-3.5" /> Best match
        </span>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg ${mode.tile} ${mode.shadow}`}
          >
            <Icon name={mode.icon} className="h-6 w-6" />
          </span>
          <div>
            <p className="flex items-center gap-2 font-bold text-slate-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-700">
                {option.rank}
              </span>
              {inv.carrier} · <span className="font-mono">{inv.service_number}</span>
            </p>
            <p className="text-xs text-slate-500">
              {inv.mode.charAt(0).toUpperCase() + inv.mode.slice(1)}
              {inv.travel_class ? ` · ${inv.travel_class}` : ''} · {inv.seats_available} seat
              {inv.seats_available === 1 ? '' : 's'} left
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold tracking-tight text-slate-900">
            ₹{option.price_inr.toLocaleString('en-IN')}
          </p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            Simulated
          </span>
        </div>
      </div>

      {/* Route and times */}
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
        <div>
          <p className="font-mono text-2xl font-extrabold text-slate-900">{formatTimeIST(option.departure_at)}</p>
          <p className="font-medium text-slate-700">{inv.origin_hub}</p>
          <p className="text-xs text-slate-500">{formatDateTimeIST(option.departure_at)} IST</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-xs text-slate-500">
          <span className="rounded-full bg-white px-2.5 py-0.5 font-semibold text-slate-700 shadow-sm">
            {formatDuration((arriveMs - departMs) / 60000)}
          </span>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span className="w-10 border-t-2 border-dashed border-slate-300 sm:w-16" />
            <Icon name={mode.icon} className="h-3.5 w-3.5 text-indigo-600" />
            <span className="w-10 border-t-2 border-dashed border-slate-300 sm:w-16" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-extrabold text-slate-900">{formatTimeIST(option.arrival_at)}</p>
          <p className="font-medium text-slate-700">{inv.destination_hub}</p>
          <p className="text-xs text-slate-500">{formatDateTimeIST(option.arrival_at)} IST</p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <Icon name="mapPin" className="h-4 w-4 text-indigo-500" />
        Be at <span className="font-semibold text-slate-900">{inv.boarding_point || inv.origin_hub}</span> by{' '}
        <span className="font-mono font-semibold text-slate-900">{formatTimeIST(boardBy)}</span>
      </p>

      {option.reasoning && <p className="mt-3 text-sm leading-relaxed text-slate-600">{option.reasoning}</p>}

      {/* Ranking score breakdown */}
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Ranking score {option.score ?? b.total ?? '-'} / 100
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {parts.map(([label, points, weight], i) => {
            const max = (weight ?? 0) * 100
            const pct = max > 0 ? Math.min(100, ((points ?? 0) / max) * 100) : 0
            return (
              <div key={label}>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{label}</span>
                  <span className="font-semibold">
                    {points ?? 0}
                    {weight !== undefined ? ` / ${Math.round(max)}` : ''}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-indigo-500 to-violet-500"
                    style={{
                      width: go ? `${pct}%` : '0%',
                      transition: `width 900ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 150}ms`,
                    }}
                  />
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
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
          >
            Accept this option <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        ) : (
          <div className="animate-pop rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm text-indigo-900">
              Confirm{' '}
              <strong>
                {inv.carrier} {inv.service_number}
              </strong>
              ? The fare of ₹{option.price_inr.toLocaleString('en-IN')} is recorded as{' '}
              <strong>pending settlement</strong> with the airport authority. No real payment is taken.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onAccept(option)}
                disabled={disabled || busy}
                className="btn-primary px-5! py-2! text-sm! disabled:opacity-70"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Icon name="check" className="h-4 w-4" strokeWidth={3} /> Confirm booking
                  </>
                )}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="btn-secondary px-5! py-2! text-sm! disabled:opacity-60"
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