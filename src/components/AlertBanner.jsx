import Icon from './Icon'

// Red banner shown when staff report a disruption (arrives live via Supabase Realtime).
export default function AlertBanner({ notification, extraCount = 0, flash = false, onDismiss, onView }) {
  if (!notification) return null

  return (
    <div
      role="alert"
      className={`animate-pop overflow-hidden rounded-2xl bg-linear-to-r from-red-600 via-rose-600 to-orange-600 p-px shadow-lg shadow-red-300/50 ${
        flash ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex flex-col gap-4 rounded-[15px] bg-linear-to-r from-red-600 via-rose-600 to-orange-600 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-white/20" />
            <Icon name="bell" className="relative h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-bold">{notification.title}</p>
            <p className="mt-0.5 text-sm text-red-50">{notification.message}</p>
            {extraCount > 0 && (
              <p className="mt-1 text-xs text-red-100">
                +{extraCount} more unread alert{extraCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onView}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            View recovery plan <Icon name="arrowRight" className="h-4 w-4" />
          </button>
          <button
            onClick={onDismiss}
            className="rounded-xl border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}