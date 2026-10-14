// Shows the priority level, score, explanation and the full rule-by-rule breakdown.
// The breakdown comes from recovery_assessments.factors (saved by the Edge Function).

const LEVELS = {
  High: { badge: 'bg-red-100 text-red-800', bar: 'bg-red-500', border: 'border-red-200' },
  Medium: { badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500', border: 'border-amber-200' },
  Low: { badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', border: 'border-emerald-200' },
}

export default function PriorityCard({ assessment }) {
  if (!assessment) return null

  const style = LEVELS[assessment.priority_level] ?? LEVELS.Low
  const factors = assessment.factors ?? {}
  const items = Array.isArray(factors.items) ? factors.items : []
  const fired = items.filter((f) => f.fired && f.points > 0)
  const notFired = items.filter((f) => !(f.fired && f.points > 0))
  const score = assessment.priority_score

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm ${style.border}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Priority assessment</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${style.badge}`}>
            {assessment.priority_level} priority
          </span>
        </div>
        <p className="text-3xl font-extrabold text-slate-900">
          {score}
          <span className="text-base font-medium text-slate-400"> / 100</span>
        </p>
      </div>

      {/* Score bar with the level cut-offs at 40 and 70 */}
      <div className="mt-4">
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, score)}%` }} />
          <span className="absolute inset-y-0 w-px bg-slate-400/70" style={{ left: '40%' }} />
          <span className="absolute inset-y-0 w-px bg-slate-400/70" style={{ left: '70%' }} />
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-slate-500">
          <span className="absolute left-0">Low</span>
          <span className="absolute -translate-x-1/2" style={{ left: '40%' }}>
            Medium 40
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: '70%' }}>
            High 70
          </span>
        </div>
      </div>

      {assessment.explanation && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
          {assessment.explanation}
        </p>
      )}

      {/* Factor breakdown */}
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No factor breakdown is stored for this assessment. Reset the demo data and run the agent again.
        </p>
      ) : (
        <div className="mt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">How the score was built</h3>

          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {fired.map((f) => (
              <li key={f.key} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{f.label}</p>
                  <p className="text-xs text-slate-500">{f.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-bold text-indigo-700">
                  +{f.points}
                </span>
              </li>
            ))}
            {fired.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-500">No rule fired, so the score is 0.</li>
            )}
            <li className="flex items-center justify-between bg-slate-50 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-700">
                Total{factors.capped ? ` (raw ${factors.raw_score}, capped at 100)` : ''}
              </span>
              <span className="font-bold text-slate-900">{score}</span>
            </li>
          </ul>

          {notFired.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-900">
                Rules that did not apply ({notFired.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
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
    </section>
  )
}