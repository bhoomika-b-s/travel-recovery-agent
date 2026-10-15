import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon'

// Small pop-up messages in the bottom-right corner.
//   const toast = useToast()
//   toast.success('Saved!')   toast.error('Something failed')   toast.info('FYI')

const ToastContext = createContext(null)

const STYLES = {
  success: { box: 'border-emerald-200 bg-white', icon: 'check', iconBox: 'bg-emerald-100 text-emerald-700' },
  error: { box: 'border-red-200 bg-white', icon: 'alert', iconBox: 'bg-red-100 text-red-700' },
  info: { box: 'border-indigo-200 bg-white', icon: 'info', iconBox: 'bg-indigo-100 text-indigo-700' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type, message, ms) => {
      const id = ++idRef.current
      // Keep at most 4 on screen.
      setToasts((list) => [...list.slice(-3), { id, type, message }])
      setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (message, ms = 4500) => push('success', message, ms),
      error: (message, ms = 7000) => push('error', message, ms),
      info: (message, ms = 4500) => push('info', message, ms),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const s = STYLES[t.type]
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex animate-pop items-start gap-3 rounded-2xl border p-3.5 shadow-xl shadow-slate-300/50 ${s.box}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.iconBox}`}>
                <Icon name={s.icon} className="h-4 w-4" />
              </span>
              <p className="flex-1 pt-1 text-sm leading-snug text-slate-800">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}