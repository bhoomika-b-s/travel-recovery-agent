import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

const steps = [
  {
    icon: '📡',
    title: 'Detect',
    text: 'Airport staff mark a flight delayed or cancelled. Every affected passenger is alerted instantly.',
  },
  {
    icon: '🧠',
    title: 'Prioritise',
    text: 'The agent scores urgency from your connection gap, time left and your own constraints.',
  },
  {
    icon: '🔎',
    title: 'Evaluate',
    text: 'It searches flights, trains and buses, filtered by your budget, deadline and destination.',
  },
  {
    icon: '🗺️',
    title: 'Recover',
    text: 'Accept an option and get a step-by-step recovery itinerary with exactly what to do next.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero */}
      <section className="bg-linear-to-b from-indigo-50 to-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            AI Agent for Travel Disruption Recovery
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Flight disrupted? Your recovery plan is already on its way.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            When a flight is delayed or cancelled, our agent finds your affected bookings, compares alternatives
            within your budget and deadline, and builds a recovery itinerary in seconds.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow hover:bg-indigo-700 sm:w-auto"
            >
              Sign up as a passenger
            </Link>
            <Link
              to="/login"
              className="w-full rounded-xl border border-indigo-600 bg-white px-6 py-3 font-semibold text-indigo-700 hover:bg-indigo-50 sm:w-auto"
            >
              Login
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Airport staff?{' '}
            <Link to="/login" state={{ mode: 'staff' }} className="font-medium text-indigo-600 hover:underline">
              Use the staff login
            </Link>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-center text-2xl font-bold text-slate-900">How it works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{s.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Step {i + 1}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two audiences */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">For passengers</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>• Save your flight, connection and constraints once.</li>
            <li>• Get a live alert the moment staff report a disruption.</li>
            <li>• See a priority score and the top 3 ranked alternatives.</li>
            <li>• Accept one tap and receive your recovery itinerary.</li>
          </ul>
          <Link
            to="/signup"
            className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create passenger account
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">For airport staff</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>• See every flight arriving at or leaving your airport.</li>
            <li>• Review the passengers on each flight.</li>
            <li>• Mark a flight delayed or cancelled with a reason.</li>
            <li>• Every affected passenger is notified automatically.</li>
          </ul>
          <Link
            to="/login"
            state={{ mode: 'staff' }}
            className="mt-5 inline-block rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Staff login
          </Link>
        </div>
      </section>

      {/* Simulation notice */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Demo notice:</strong> all alternative flights, trains and buses are <strong>simulated data</strong>.
          No real tickets are booked and no real payment is taken. Fares are only recorded as
          "pending settlement" with the airport authority.
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        TravelRecover AI · Hackathon project · Problem Statement 4.1
      </footer>
    </div>
  )
}