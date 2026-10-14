// A small coloured pill showing a flight's status.
const STYLES = {
  scheduled: 'bg-emerald-100 text-emerald-800',
  delayed: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
}

const LABELS = {
  scheduled: 'On time',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STYLES[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  )
}