import Icon from './Icon'

// Clear label shown wherever alternative transport is displayed.
export default function SimulatedBanner({ className = '' }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-200/70 text-amber-800">
        <Icon name="info" className="h-4 w-4" />
      </span>
      <p>
        <strong>Simulated data:</strong> the flights, trains and buses below come from a demo inventory. No real
        ticket is booked and no real payment is taken. Fares are only recorded as "pending settlement" with the
        airport authority.
      </p>
    </div>
  )
}