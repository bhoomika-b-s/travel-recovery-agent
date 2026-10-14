import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathFor } from '../lib/paths'

// Top bar shown on every page. Changes depending on whether you are logged in.
export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      navigate('/')
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-indigo-700">
          <span aria-hidden="true">✈️</span>
          TravelRecover AI
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                to={homePathFor(profile)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Dashboard
              </Link>
              {profile && (
                <span className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
                  {profile.full_name || user.email}
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {profile.role === 'staff' ? `Staff · ${profile.airport_code}` : 'Passenger'}
                  </span>
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}