import { useInView } from '../hooks/useInView'
import { formatDateTimeIST } from '../lib/time'
import Icon from './Icon'

const PAYMENT_LABEL = {
  pending_settlement: 'Pending settlement',
  settled: 'Settled',
  cancelled: 'Cancelled',
}

const MODE_ICON = { flight: 'plane', train: 'train', bus: 'bus' }

// Shows the accepted booking, the step-by-step recovery itinerary and the ledger entry.
export default function ItineraryView({ itinerary, alternative, payment }) {
  const [ref, inView] = useInView({ threshold: 0.1 })
  const inv = alternative?.transport_inventory
  const steps = Array.isArray(itinerary?.steps) ? itinerary.steps : []

  // Each kind of step gets its own icon.
  function stepIcon(step) {
    if (step.type === 'info') return 'info'
    if (step.type === 'admin') return 'receipt'
    if (step.type === 'action') return 'mapPin'
    if (step.type === 'arrive') return 'check'
    return MODE_ICON[inv?.mode] ?? 'plane'
  }

  return (
    <section className="animate-fade-up overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg shadow-emerald-100/60">
      {/* Confirmed header */}
      <div className="relative overflow-hidden bg-linear-to-r from-emerald-500 via-emerald-600 to-teal-600 p-6 text-white">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 right-24 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 animate-pop items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/40">
              <Icon name="check" className="h-7 w-7" strokeWidth={3} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Recovery confirmed</p>
              <h2 className="text-2xl font-extrabold">Your recovery itinerary</h2>
              {inv && (
                <p className="mt-0.5 text-sm text-emerald-50">
                  {inv.carrier} {inv.service_number} · {inv.origin_hub} → {inv.destination_hub}
                </p>
              )}
            </div>
          </div>
          {alternative?.booking_reference && (
            <div className="rounded-2xl bg-white/15 px-4 py-2.5 text-right ring-1 ring-white/30">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-100">Reference</p>
              <p className="font-mono text-lg font-extrabold">{alternative.booking_reference}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {itinerary?.summary && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
            {itinerary.summary}
          </p>
        )}

        {/* Timeline: the line draws itself, then the steps appear one by one */}
        <div ref={ref} className="relative mt-6">
          <div className="absolute bottom-5 left-5 top-5 w-0.5 -translate-x-1/2 bg-slate-200">
            <div
              className="w-full bg-linear-to-b from-emerald-400 via-indigo-500 to-violet-500"
              style={{
                height: inView ? '100%' : '0%',
                transition: `height ${Math.max(1.2, steps.length * 0.25)}s ease-out`,
              }}
            />
          </div>

          <ol>
            {steps.map((step, i) => {
              const isAction = step.type === 'action' && /^Proceed to/i.test(step.title)
              return (
                <li
                  key={i}
                  style={{ transitionDelay: `${i * 170}ms` }}
                  className={`relative flex gap-4 pb-5 transition-all duration-700 last:pb-0 ${
                    inView ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                  }`}
                >
                  <span
                    className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                      isAction
                        ? 'bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-300/60'
                        : step.type === 'arrive'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon name={stepIcon(step)} className="size-4.5" />
                  </span>
                  <div
                    className={`flex-1 rounded-2xl border p-3.5 ${
                      isAction ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`font-semibold ${isAction ? 'text-indigo-900' : 'text-slate-900'}`}>
                        {step.title}
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
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
        </div>

        {/* Ledger entry */}
        {payment && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Icon name="receipt" className="h-4 w-4" /> Fare record (simulated)
            </h3>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Amount</dt>
                <dd className="text-lg font-extrabold text-slate-900">₹{payment.amount_inr.toLocaleString('en-IN')}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    {PAYMENT_LABEL[payment.status] ?? payment.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Settle with</dt>
                <dd className="font-semibold text-slate-900">{payment.settle_with}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Reference</dt>
                <dd className="font-mono font-semibold text-slate-900">{payment.reference}</dd>
              </div>
            </dl>
            {payment.note && <p className="mt-3 text-xs text-slate-500">{payment.note}</p>}
          </div>
        )}
      </div>
    </section>
  )
}