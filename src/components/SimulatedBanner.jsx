// Clear label shown wherever alternative transport is displayed.
export default function SimulatedBanner({ className = '' }) {
  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <strong>Simulated data:</strong> the flights, trains and buses below come from a demo inventory. No real
      ticket is booked and no real payment is taken. Fares are only recorded as "pending settlement" with the
      airport authority.
    </div>
  )
}