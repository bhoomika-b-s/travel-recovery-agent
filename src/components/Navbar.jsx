import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathFor } from '../lib/paths'
import Icon from './Icon'

// Top bar shown on every page. Turns into frosted glass once you scroll.
export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleSignOut() {
    try {
      await signOut()
    } finally {
      navigate('/')
    }
  }

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-200/70 bg-white/75 shadow-sm backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30 transition duration-300 group-hover:rotate-6 group-hover:scale-105">
            <Icon name="plane" className="h-[18px] w-[18px]" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            Travel<span className="text-gradient">Recover</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link
                to={homePathFor(profile)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Dashboard
              </Link>
              {profile && (
                <span className="hidden items-center gap-2 pl-2 text-sm text-slate-600 md:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
                    {(profile.full_name || user.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[10rem] truncate">{profile.full_name || user.email}</span>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {profile.role === 'staff' ? `Staff · ${profile.airport_code}` : 'Passenger'}
                  </span>
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="ml-1 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <a
                href="/#how"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-indigo-700 sm:block"
              >
                How it works
              </a>
              <a
                href="/#features"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-indigo-700 sm:block"
              >
                Features
              </a>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:shadow-lg"
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