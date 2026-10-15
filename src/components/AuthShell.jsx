import { Link } from 'react-router-dom'
import Icon from './Icon'

const POINTS = [
  ['zap', 'Instant alerts', 'Know the moment your flight changes.'],
  ['chart', 'Explainable priority', 'Every point of your score has a reason.'],
  ['shield', 'Secure by design', 'You only ever see your own data.'],
]

// Split-screen layout used by Login and Sign-up:
// a brand panel on the left (desktop only) and the page content on the right.
export default function AuthShell({ children, wide = false }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[5fr_7fr]">
      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-indigo-700 via-violet-700 to-fuchsia-700 p-10 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-30" />
        <div className="absolute -left-16 top-1/4 h-72 w-72 animate-blob rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-10 bottom-10 h-80 w-80 animate-blob rounded-full bg-fuchsia-300/20 blur-3xl [animation-delay:-6s]" />

        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <Icon name="plane" className="h-5 w-5" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">TravelRecover AI</span>
        </Link>

        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Flights change.
            <br />
            Your plan shouldn&apos;t fall apart.
          </h2>
          <p className="mt-3 max-w-md text-indigo-100">
            One account, one dashboard, and an agent that finds your way onward when a flight is disrupted.
          </p>

          {/* Flight arc with a floating plane */}
          <div className="relative mt-8 max-w-md">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 animate-float rounded-full bg-white/15 p-2.5 ring-1 ring-white/30 backdrop-blur">
              <Icon name="plane" className="h-5 w-5 rotate-45" />
            </div>
            <svg viewBox="0 0 400 130" fill="none" className="w-full opacity-80">
              <path d="M10 120 C 120 0, 280 0, 390 100" stroke="white" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="6 8" />
              <circle cx="10" cy="120" r="5" fill="white" />
              <circle cx="390" cy="100" r="5" fill="white" />
            </svg>
          </div>

          <ul className="mt-6 space-y-4">
            {POINTS.map(([icon, title, text]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                  <Icon name={icon} className="size-4.5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-indigo-100">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-200">
          Demo project. All alternative transport shown is simulated and no real payment is taken.
        </p>
      </aside>

      {/* ---------- Content ---------- */}
      <main className="relative flex min-h-screen flex-col items-center px-4 py-6 sm:px-8 lg:justify-center">
        <div className="absolute right-0 top-0 z-0 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />

        <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
          <div className="mb-6 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-slate-900 lg:invisible">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-indigo-600 to-violet-600 text-white">
                <Icon name="plane" className="h-4 w-4" />
              </span>
              TravelRecover
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-700"
            >
              <Icon name="arrowLeft" className="h-4 w-4" /> Back to home
            </Link>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}

// The white rounded card the forms sit in.
export function AuthCard({ children, className = '' }) {
  return (
    <div
      className={`animate-fade-up rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-100/60 sm:p-8 ${className}`}
    >
      {children}
    </div>
  )
}