import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { homePathFor } from '../lib/paths'

// Demo accounts created by 003_seed.sql (password for all: Demo@1234).
const DEMO_ACCOUNTS = {
  passenger: [
    { label: 'Passenger 1 (DEL to BOM)', email: 'passenger1@example.com' },
    { label: 'Passenger 6 (DEL to PNQ)', email: 'passenger6@example.com' },
    { label: 'Passenger 10 (BOM to GOI)', email: 'passenger10@example.com' },
  ],
  staff: [
    { label: 'Delhi staff (DEL)', email: 'staff.del@example.com' },
    { label: 'Mumbai staff (BOM)', email: 'staff.bom@example.com' },
  ],
}

export default function Login() {
  const { signIn, signOut, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // The landing page can open this page on the Staff tab.
  const [mode, setMode] = useState(location.state?.mode === 'staff' ? 'staff' : 'passenger')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already logged in? Go straight to the right dashboard.
  if (!loading && profile && !busy) {
    return <Navigate to={homePathFor(profile)} replace />
  }

  function switchMode(next) {
    setMode(next)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { user: signedIn } = await signIn(email.trim(), password)

      // Check the account type matches the tab the person chose.
      const { data: p, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', signedIn.id)
        .maybeSingle()
      if (profileError) throw profileError
      if (!p) throw new Error('No profile found for this account. Please contact support.')

      if (p.role !== mode) {
        await signOut()
        throw new Error(
          p.role === 'staff'
            ? 'This is a staff account. Please use the "Airport staff" tab.'
            : 'This is a passenger account. Please use the "Passenger" tab.',
        )
      }

      // Go back to the page they wanted, if it matches their role.
      const home = homePathFor(p)
      const from = location.state?.from?.pathname
      navigate(from && from.startsWith(home) ? from : home, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto flex max-w-md flex-col px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Log in to continue.</p>

          {/* Passenger / Staff tabs */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {[
              ['passenger', 'Passenger'],
              ['staff', 'Airport staff'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === value ? 'bg-white text-indigo-700 shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
              <div className="flex gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              disabled={busy}
              className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Signing in...' : `Sign in as ${mode === 'staff' ? 'staff' : 'passenger'}`}
            </button>
          </form>

          {mode === 'passenger' && (
            <p className="mt-4 text-center text-sm text-slate-500">
              New here?{' '}
              <Link to="/signup" className="font-medium text-indigo-600 hover:underline">
                Create a passenger account
              </Link>
            </p>
          )}

          {/* One-click demo accounts (from the seed data) */}
          <div className="mt-6 rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Demo accounts (password: Demo@1234)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS[mode].map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email)
                    setPassword('Demo@1234')
                    setError('')
                  }}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}