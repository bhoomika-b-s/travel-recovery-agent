import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthShell, { AuthCard } from '../components/AuthShell'
import { IconInput } from '../components/FormField'
import Icon from '../components/Icon'
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
    <AuthShell>
      <AuthCard>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in to see your trip and recovery plan.</p>

        {/* Passenger / Staff switch with a sliding highlight */}
        <div className="relative mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <span
            className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow transition-transform duration-300 ease-out ${
              mode === 'staff' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          {[
            ['passenger', 'Passenger', 'user'],
            ['staff', 'Airport staff', 'badge'],
          ].map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              className={`relative z-10 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                mode === value ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon name={icon} className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
            <IconInput
              icon="mail"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
            <IconInput
              icon="lock"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              right={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} className="size-4.5" />
                </button>
              }
            />
          </label>

          {error && (
            <p
              role="alert"
              className="flex animate-pop items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button disabled={busy} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70">
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Signing in...
              </>
            ) : (
              <>
                Sign in as {mode === 'staff' ? 'staff' : 'passenger'}
                <Icon name="arrowRight" className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'passenger' && (
          <p className="mt-5 text-center text-sm text-slate-500">
            New here?{' '}
            <Link to="/signup" className="font-semibold text-indigo-600 hover:underline">
              Create a passenger account
            </Link>
          </p>
        )}

        {/* One-click demo accounts (from the seed data) */}
        <div className="mt-6 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            Demo accounts · password Demo@1234
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS[mode].map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword('Demo@1234')
                  setError('')
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:text-indigo-700 hover:shadow"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  )
}