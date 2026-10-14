import { formatDateTimeIST } from '../lib/time'

const STEP_ICON = { info: 'ℹ️', admin: '📝', action: '📍', travel: '🧭', arrive: '🏁' }

const PAYMENT_LABEL = {
  pending_settlement: 'Pending settlement',
  settled: 'Settled',
  cancelled: 'Cancelled',
}

// Shows the accepted booking, the step-by-step recovery itinerary and the ledger entry.
export default function ItineraryView({ itinerary, alternative, payment }) {
  const inv = alternative?.transport_inventory
  const steps = Array.isArray(itinerary?.steps) ? itinerary.steps : []

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Your recovery itinerary</h2>
          {inv && (
            <p className="mt-1 text-sm text-slate-600">
              {inv.carrier} {inv.service_number} · {inv.origin_hub} → {inv.destination_hub}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">Confirmed</span>
          {alternative?.booking_reference && (
            <p className="mt-1 text-xs text-slate-500">
              Reference <span className="font-mono font-semibold text-slate-800">{alternative.booking_reference}</span>
            </p>
          )}
        </div>
      </div>

      {itinerary?.summary && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900">
          {itinerary.summary}
        </p>
      )}

      {/* Timeline */}
      <ol className="mt-5 space-y-0">
        {steps.map((step, i) => {
          const isAction = step.type === 'action' && /^Proceed to/i.test(step.title)
          return (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {i < steps.length - 1 && <span className="absolute left-5 top-10 h-full w-px bg-slate-200" />}
              <span
                className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                  isAction ? 'bg-indigo-600' : 'bg-slate-100'
                }`}
                aria-hidden="true"
              >
                {STEP_ICON[step.type] ?? '•'}
              </span>
              <div
                className={`flex-1 rounded-xl border p-3 ${
                  isAction ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`font-semibold ${isAction ? 'text-indigo-900' : 'text-slate-900'}`}>{step.title}</p>
                  <span className="text-xs font-medium text-slate-500">
                    {step.at ? `${formatDateTimeIST(step.at)} IST` : 'Now'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
              </div>
            </li>
          )
        })}
        {steps.length === 0 && <li className="text-sm text-slate-500">No steps were saved.</li>}
      </ol>

      {/* Ledger entry */}
      {payment && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fare record (simulated)</h3>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-semibold text-slate-900">₹{payment.amount_inr.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {PAYMENT_LABEL[payment.status] ?? payment.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Settle with</dt>
              <dd className="font-medium text-slate-900">{payment.settle_with}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Reference</dt>
              <dd className="font-mono font-medium text-slate-900">{payment.reference}</dd>
            </div>
          </dl>
          {payment.note && <p className="mt-3 text-xs text-slate-500">{payment.note}</p>}
        </div>
      )}
    </section>
  )
}