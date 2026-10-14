import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathFor } from '../lib/paths'

// Wrap a page with this to require login (and optionally a specific role).
//   <ProtectedRoute role="staff"><StaffDashboard /></ProtectedRoute>
export default function ProtectedRoute({ role, children }) {
  const { user, profile, loading, signOut } = useAuth()
  const location = useLocation()

  // Still checking the session / profile: show a spinner (avoids redirect flicker).
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    )
  }

  // Not logged in: go to login and remember where they wanted to go.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Logged in but no profile row (the sign-up trigger did not run).
  if (!profile) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Profile not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account exists but has no profile row. Check that the trigger from 001_schema.sql ran, then sign in again.
        </p>
        <button
          onClick={signOut}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Sign out
        </button>
      </div>
    )
  }

  // Wrong role (e.g. a passenger opening /staff): send them to their own dashboard.
  if (role && profile.role !== role) {
    return <Navigate to={homePathFor(profile)} replace />
  }

  return children
}