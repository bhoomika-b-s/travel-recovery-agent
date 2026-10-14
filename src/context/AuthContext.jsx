import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // The Supabase auth session (null when logged out).
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  // The row from public.profiles, remembered together with the user id it belongs to.
  // This lets us know when the profile of the CURRENT user has finished loading.
  const [profileState, setProfileState] = useState({ id: null, data: null })

  // 1) Load the existing session once, then listen for login / logout / token refresh.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Keep this callback tiny. Do NOT call Supabase and await inside it.
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  // 2) Whenever the logged-in user changes, load their profile (role, airport_code ...).
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Could not load profile:', error.message)
        setProfileState({ id: userId, data: data ?? null })
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  // Profile belongs to the current user only if the ids match.
  const profile = userId && profileState.id === userId ? profileState.data : null

  // "loading" stays true until we know the session AND (if logged in) the profile.
  const loading = sessionLoading || (userId !== null && profileState.id !== userId)

  // Re-read the profile (useful after the user edits their details).
  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfileState({ id: userId, data: data ?? null })
  }, [userId])

  // ---------- Actions used by the Login / Signup pages ----------

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  // The name and phone are stored as metadata; the database trigger copies them into profiles.
  const signUp = useCallback(async ({ email, password, fullName, phone }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    })
    if (error) throw error
    // If "Confirm email" is still ON in Supabase, there is no session yet.
    if (!data.session) {
      throw new Error('Email confirmation is ON in Supabase. Turn it off: Authentication -> Providers -> Email.')
    }
    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      airportCode: profile?.airport_code ?? null,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Small hook so components can write: const { user, profile } = useAuth()
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}