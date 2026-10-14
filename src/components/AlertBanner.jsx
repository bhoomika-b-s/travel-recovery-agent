// Red banner shown when staff report a disruption (arrives live via Supabase Realtime).
export default function AlertBanner({ notification, extraCount = 0, flash = false, onDismiss, onView }) {
  if (!notification) return null

  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm ${flash ? 'animate-pulse' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="text-2xl" aria-hidden="true">
            🚨
          </span>
          <div>
            <p className="font-semibold text-red-900">{notification.title}</p>
            <p className="mt-1 text-sm text-red-800">{notification.message}</p>
            {extraCount > 0 && (
              <p className="mt-1 text-xs text-red-700">
                +{extraCount} more unread alert{extraCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onView}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            View recovery plan
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}