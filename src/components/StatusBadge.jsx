// A small coloured pill showing a flight's status.
// onDark = true gives a version that reads well on the dark flight board.
const STYLES = {
  scheduled: {
    light: 'bg-emerald-100 text-emerald-800',
    dark: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  delayed: {
    light: 'bg-amber-100 text-amber-800',
    dark: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  cancelled: {
    light: 'bg-red-100 text-red-800',
    dark: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
    dot: 'bg-red-500',
  },
}

const LABELS = {
  scheduled: 'On time',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
}

export default function StatusBadge({ status, onDark = false }) {
  const s = STYLES[status]
  const colour = s ? (onDark ? s.dark : s.light) : 'bg-slate-100 text-slate-700'

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${colour}`}
    >
      {s && (
        <span className="relative flex h-1.5 w-1.5">
          {status !== 'scheduled' && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${s.dot}`} />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${s.dot}`} />
        </span>
      )}
      {LABELS[status] ?? status}
    </span>
  )
}