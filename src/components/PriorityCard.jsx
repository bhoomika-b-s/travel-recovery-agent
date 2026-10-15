import { useEffect, useState } from 'react'
import CountUp from './CountUp'
import Icon from './Icon'

// Shows the priority level, an animated gauge, the explanation and the full rule-by-rule breakdown.
// The breakdown comes from recovery_assessments.factors (saved by the Edge Function).

const LEVELS = {
  High: {
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-600',
    border: 'border-red-200',
    stroke: ['#f97316', '#ef4444'],
    bar: 'from-orange-400 to-red-500',
    note: 'Act now: your onward journey is at serious risk.',
  },
  Medium: {
    badge: 'bg-amber-100 text-amber-800',
    text: 'text-amber-600',
    border: 'border-amber-200',
    stroke: ['#fbbf24', '#f59e0b'],
    bar: 'from-yellow-400 to-amber-500',
    note: 'Keep an eye on it: your connection is under pressure.',
  },
  Low: {
    badge: 'bg-emerald-100 text-emerald-800',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    stroke: ['#34d399', '#10b981'],
    bar: 'from-emerald-400 to-teal-500',
    note: 'Low risk: you should be able to carry on as planned.',
  },
}

const RADIUS = 60
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function PriorityCard({ assessment }) {
  // Hooks come first. "go" flips to true just after the card appears, so the CSS transitions play.
  const [go, setGo] = useState(false)
  const assessmentId = assessment?.id
  useEffect(() => {
    setGo(false)
    const timer = setTimeout(() => setGo(true), 200)
    return () => clearTimeout(timer)
  }, [assessmentId])

  if (!assessment) return null

  const style = LEVELS[assessment.priority_level] ?? LEVELS.Low
  const factors = assessment.factors ?? {}
  const items = Array.isArray(factors.items) ? factors.items : []
  const fired = items.filter((f) => f.fired && f.points > 0)
  const notFired = items.filter((f) => !(f.fired && f.points > 0))
  const score = assessment.priority_score
  const gradientId = `gauge-${assessment.priority_level}`

  return (
    <section className={`animate-fade-up overflow-hidden rounded-3xl border bg-white shadow-lg shadow-slate-200/60 ${style.border}`}>
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <Icon name="chart" className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">Priority assessment</h2>
        </div>

        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* Animated gauge */}
          <div className="relative h-40 w-40 shrink-0">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={style.stroke[0]} />
                  <stop offset="100%" stopColor={style.stroke[1]} />
                </linearGradient>
              </defs>
              <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth="13" />
              <circle
                cx="70"
                cy="70"
                r={RADIUS}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="13"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={go ? CIRCUMFERENCE * (1 - Math.min(100, score) / 100) : CIRCUMFERENCE}
                style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-extrabold tracking-tight text-slate-900">
                <CountUp end={score} duration={1500} />
              </span>
              <span className="text-xs font-medium text-slate-400">out of 100</span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <span className={`inline-block rounded-full px-3.5 py-1 text-sm font-bold ${style.badge}`}>
              {assessment.priority_level} priority
            </span>
            <p className={`mt-2 text-sm font-medium ${style.text}`}>{style.note}</p>

            {/* Low / Medium / High scale with a marker */}
            <div className="mt-4">
              <div className="relative">
                <div className="flex h-2.5 overflow-hidden rounded-full">
                  <span className="bg-emerald-300" style={{ width: '40%' }} />
                  <span className="bg-amber-300" style={{ width: '30%' }} />
                  <span className="bg-red-300" style={{ width: '30%' }} />
                </div>
                <span
                  className="absolute -top-1 h-4.5 w-4.5 -translate-x-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow-md"
                  style={{
                    left: go ? `${Math.min(100, Math.max(0, score))}%` : '0%',
                    height: '18px',
                    width: '18px',
                    transition: 'left 1.6s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>
              <div className="relative mt-1.5 h-4 text-[11px] font-medium text-slate-500">
                <span className="absolute left-0">Low</span>
                <span className="absolute -translate-x-1/2" style={{ left: '40%' }}>
                  Medium 40
                </span>
                <span className="absolute -translate-x-1/2" style={{ left: '70%' }}>
                  High 70
                </span>
              </div>
            </div>
          </div>
        </div>

        {assessment.explanation && (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {assessment.explanation}
          </p>
        )}

        {/* Factor breakdown */}
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No factor breakdown is stored for this assessment. Reset the demo data and run the agent again.
          </p>
        ) : (
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">How the score was built</h3>

            <ul className="mt-3 space-y-3">
              {fired.map((f, i) => (
                <li key={f.key}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{f.label}</p>
                      <p className="text-xs text-slate-500">{f.detail}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-bold text-indigo-700">
                      +{f.points}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-linear-to-r ${style.bar}`}
                      style={{
                        width: go ? `${Math.min(100, (f.points / 40) * 100)}%` : '0%',
                        transition: `width 900ms cubic-bezier(0.22, 1, 0.36, 1) ${400 + i * 150}ms`,
                      }}
                    />
                  </div>
                </li>
              ))}
              {fired.length === 0 && <li className="text-sm text-slate-500">No rule fired, so the score is 0.</li>}
            </ul>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
              <span className="font-semibold">
                Total{factors.capped ? ` (raw ${factors.raw_score}, capped at 100)` : ''}
              </span>
              <span className="text-lg font-extrabold">{score}</span>
            </div>

            {notFired.length > 0 && (
              <details className="group mt-3 text-sm">
                <summary className="cursor-pointer select-none font-medium text-slate-600 transition hover:text-slate-900">
                  Rules that did not apply ({notFired.length})
                </summary>
                <ul className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3">
                  {notFired.map((f) => (
                    <li key={f.key} className="flex justify-between gap-4 text-slate-500">
                      <span>
                        {f.label}
                        <span className="text-xs"> · {f.detail}</span>
                      </span>
                      <span className="shrink-0">+0</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  )
}