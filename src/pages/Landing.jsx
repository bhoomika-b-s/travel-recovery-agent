import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CountUp from '../components/CountUp'
import Navbar from '../components/Navbar'
import Reveal from '../components/Reveal'
import { useInView } from '../hooks/useInView'

// ---------- Static content ----------

const STEPS = [
  { icon: '📡', title: 'Detect', text: 'Airport staff mark a flight delayed or cancelled. One action alerts every booked passenger.' },
  { icon: '🧠', title: 'Prioritise', text: 'The agent scores urgency from the connection gap, delay length and your own deadline.' },
  { icon: '🔎', title: 'Evaluate', text: 'Flights, trains and buses are filtered by budget, seats and destination, then ranked.' },
  { icon: '🗺️', title: 'Recover', text: 'Accept an option and get a step-by-step itinerary with exactly what to do next.' },
]

const FEATURES = [
  { icon: '⚡', title: 'Real-time alerts', text: 'Passengers see the disruption the moment staff report it, with no refresh needed.', grad: 'from-amber-400 to-orange-500' },
  { icon: '📊', title: 'Explainable priority', text: 'A 0 to 100 score where every point traces back to a named rule you can read.', grad: 'from-indigo-500 to-violet-600' },
  { icon: '🎯', title: 'Constraint-aware options', text: 'Your budget, deadline and preferred modes decide which alternatives you see.', grad: 'from-emerald-400 to-teal-600' },
  { icon: '🛫', title: 'Route around the problem', text: 'If your flight is the problem, the agent can leave from your origin city instead.', grad: 'from-sky-400 to-blue-600' },
  { icon: '🧾', title: 'Settlement ledger', text: 'Fares are recorded as pending settlement with the airport authority. No payment gateway.', grad: 'from-fuchsia-500 to-pink-600' },
  { icon: '🔐', title: 'Secure by design', text: 'Row Level Security keeps passengers to their own data and staff to their own airport.', grad: 'from-slate-600 to-slate-900' },
]

const STATS = [
  { end: 8, label: 'Transparent scoring rules' },
  { end: 3, label: 'Ranked options per disruption' },
  { end: 11, label: 'Tables protected by RLS' },
  { end: 0, label: 'Black-box models' },
]

// ---------- The animated sample card in the hero ----------

function HeroPreview() {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setGo(true), 400)
    return () => clearTimeout(timer)
  }, [])

  const radius = 52
  const circumference = 2 * Math.PI * radius
  const score = 88
  const factors = [
    ['Connection will be missed', '+40'],
    ['Buffer under 60 min', '+30'],
    ['Connecting bus', '+8'],
    ['Delay 60 to 180 min', '+10'],
  ]

  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-up [animation-delay:200ms]">
      {/* glow behind the card */}
      <div className="absolute -inset-4 rounded-4xl bg-linear-to-r from-indigo-400/30 via-violet-400/30 to-fuchsia-400/30 blur-2xl" />

      {/* floating chips */}
      <div className="absolute -right-3 -top-5 z-10 animate-float rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-lg">
        🚨 Live alert received
      </div>
      <div className="absolute -bottom-5 -left-3 z-10 animate-float-slow rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-lg">
        ✅ Fare: pending settlement
      </div>

      <div className="relative rounded-3xl border border-white/70 bg-white/85 p-5 shadow-2xl shadow-indigo-200/60 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flight</p>
            <p className="text-lg font-bold text-slate-900">6E-2041 · DEL → BOM</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Delayed 2h</span>
        </div>

        <div className="mt-4 flex items-center gap-5">
          {/* Animated gauge */}
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="11" />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={go ? circumference * (1 - score / 100) : circumference}
                style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-slate-900">
                {go ? <CountUp end={score} duration={1500} /> : 0}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-red-600">High priority</span>
            </div>
          </div>

          {/* Factor rows that slide in */}
          <ul className="flex-1 space-y-2">
            {factors.map(([label, points], i) => (
              <li
                key={label}
                style={{ transitionDelay: `${700 + i * 160}ms` }}
                className={`flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs transition-all duration-500 ${
                  go ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                }`}
              >
                <span className="text-slate-600">{label}</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-bold text-indigo-700">{points}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* A sample option */}
        <div
          style={{ transitionDelay: '1500ms' }}
          className={`mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3 transition-all duration-700 ${
            go ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              <span className="mr-2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">#1</span>
              ✈️ IndiGo 6E-2711
            </p>
            <p className="text-lg font-bold text-slate-900">₹5,900</p>
          </div>
          <p className="mt-1 text-xs text-slate-600">Delhi → Pune · leaves 12:20 · arrives 14:30</p>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-400">Sample preview with simulated data</p>
      </div>
    </div>
  )
}

// ---------- The journey line (draws itself when scrolled into view) ----------

function Journey() {
  const [ref, inView] = useInView({ threshold: 0.3 })

  return (
    <div ref={ref} className="relative mt-12">
      {/* connector line (desktop only) */}
      <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-0.5 bg-slate-200 lg:block">
        <div
          className="h-full bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-1800 ease-out"
          style={{ width: inView ? '100%' : '0%' }}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            style={{ transitionDelay: `${i * 220}ms` }}
            className={`relative text-center transition-all duration-700 ${
              inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-3xl shadow-lg shadow-indigo-100">
              <span aria-hidden="true">{step.icon}</span>
              <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">{step.title}</h3>
            <p className="mx-auto mt-1 max-w-[16rem] text-sm text-slate-600">{step.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- The page ----------

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <Navbar />

      {/* ===== Hero ===== */}
      <section className="relative -mt-15 overflow-hidden pt-15">
        <div className="bg-grid absolute inset-0 -z-10 mask-b-to-85%" />
        <div className="absolute -left-24 top-10 -z-10 h-80 w-80 animate-blob rounded-full bg-indigo-300/50 blur-3xl" />
        <div className="absolute right-0 top-0 -z-10 h-96 w-96 animate-blob rounded-full bg-fuchsia-300/40 blur-3xl [animation-delay:-5s]" />
        <div className="absolute bottom-0 left-1/3 -z-10 h-72 w-72 animate-blob rounded-full bg-sky-300/40 blur-3xl [animation-delay:-9s]" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div className="text-center lg:text-left">
            <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              AI Agent for Travel Disruption Recovery
            </span>

            <h1 className="mt-5 animate-fade-up text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 [animation-delay:100ms] sm:text-5xl lg:text-6xl">
              Flight disrupted? Your <span className="text-gradient">recovery plan</span> is already on its way.
            </h1>

            <p className="mx-auto mt-5 max-w-xl animate-fade-up text-lg text-slate-600 [animation-delay:200ms] lg:mx-0">
              When a flight is delayed or cancelled, our agent finds your affected booking, compares alternatives within
              your budget and deadline, and builds a recovery itinerary in seconds.
            </p>

            <div className="mt-8 flex animate-fade-up flex-col items-center gap-3 [animation-delay:300ms] sm:flex-row lg:justify-start justify-center">
              <Link to="/signup" className="btn-primary w-full sm:w-auto">
                Get started as a passenger <span aria-hidden="true">→</span>
              </Link>
              <Link to="/login" className="btn-secondary w-full sm:w-auto">
                Login
              </Link>
            </div>

            <p className="mt-5 animate-fade-up text-sm text-slate-500 [animation-delay:400ms]">
              Airport staff?{' '}
              <Link to="/login" state={{ mode: 'staff' }} className="font-semibold text-indigo-600 hover:underline">
                Use the staff login
              </Link>
            </p>
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* ===== Stats strip ===== */}
      <section className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-white px-4 py-6 text-center">
                <p className="text-4xl font-extrabold text-gradient">
                  <CountUp end={s.end} />
                </p>
                <p className="mt-1 text-sm text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <Reveal className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            From disruption to a new plan in four steps
          </h2>
        </Reveal>
        <Journey />
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Features</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Built to be fast, fair and explainable
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 120}>
                <div className="card-hover group h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${f.grad} text-2xl shadow-lg transition duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  >
                    <span aria-hidden="true">{f.icon}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Two audiences ===== */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-20 md:grid-cols-2">
        <Reveal>
          <div className="card-hover h-full rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-white p-8 shadow-sm">
            <span className="text-3xl" aria-hidden="true">🧳</span>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">For passengers</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              <li className="flex gap-2"><span className="text-indigo-600">✓</span> Save your flight, connection and constraints once.</li>
              <li className="flex gap-2"><span className="text-indigo-600">✓</span> Get a live alert the moment staff report a disruption.</li>
              <li className="flex gap-2"><span className="text-indigo-600">✓</span> See a priority score and the top 3 ranked alternatives.</li>
              <li className="flex gap-2"><span className="text-indigo-600">✓</span> Accept in one tap and receive your recovery itinerary.</li>
            </ul>
            <Link to="/signup" className="btn-primary mt-6">
              Create passenger account
            </Link>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="card-hover h-full rounded-3xl border border-slate-200 bg-linear-to-br from-slate-100 to-white p-8 shadow-sm">
            <span className="text-3xl" aria-hidden="true">🛂</span>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">For airport staff</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              <li className="flex gap-2"><span className="text-slate-700">✓</span> See every flight arriving at or leaving your airport.</li>
              <li className="flex gap-2"><span className="text-slate-700">✓</span> Review passengers and who is at risk of missing a connection.</li>
              <li className="flex gap-2"><span className="text-slate-700">✓</span> Mark a flight delayed or cancelled with a reason.</li>
              <li className="flex gap-2"><span className="text-slate-700">✓</span> Every affected passenger is notified automatically.</li>
            </ul>
            <Link to="/login" state={{ mode: 'staff' }} className="btn-secondary mt-6">
              Staff login
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ===== Call to action ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-size-[200%_200%] animate-gradient p-10 text-center shadow-2xl shadow-indigo-300/50 sm:p-14">
            <div className="absolute -left-10 -top-10 h-40 w-40 animate-float-slow rounded-full bg-white/10" />
            <div className="absolute -bottom-12 -right-8 h-52 w-52 animate-float rounded-full bg-white/10" />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              See the agent recover a trip, live
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-indigo-100">
              Sign up with sample data in under a minute, then watch a disruption turn into a confirmed plan.
            </p>
            <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-6 py-3 font-semibold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
              >
                Try it now →
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== Simulation notice ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span aria-hidden="true" className="text-xl">⚠️</span>
          <p>
            <strong>Demo notice:</strong> all alternative flights, trains and buses are <strong>simulated data</strong>.
            No real tickets are booked and no real payment is taken. Fares are only recorded as "pending settlement"
            with the airport authority.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <p className="font-semibold text-slate-700">✈️ TravelRecover AI</p>
        <p className="mt-1">Hackathon project · Problem Statement 4.1 · React, Vite, Tailwind and Supabase</p>
      </footer>
    </div>
  )
}