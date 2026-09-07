import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(undefined)

// Default weekly training split seeded onto a brand-new profile (see
// loadProfile below). weekday is ISO: 1=Monday .. 7=Sunday. Matches the
// current Morocco shred-plan structure — fully editable from the Plan tab,
// and irrelevant to anyone else who ever uses this build.
const DEFAULT_TRAINING_PLAN = [
  { weekday: 1, label: 'Pull + light run or cardio (Zone 2–3)', required: true, sort_order: 0 },
  { weekday: 2, label: 'Freeletics', required: true, sort_order: 0 },
  { weekday: 2, label: 'Pilates or Vinyasa Yoga (optional)', required: false, sort_order: 1 },
  { weekday: 3, label: 'Push + cardio (run, tennis, swim, etc.)', required: true, sort_order: 0 },
  { weekday: 4, label: 'Freeletics', required: true, sort_order: 0 },
  { weekday: 4, label: 'Pilates or Vinyasa Yoga (optional)', required: false, sort_order: 1 },
  { weekday: 5, label: 'Leg day', required: true, sort_order: 0 },
  { weekday: 6, label: 'Rest — recreational sports only', required: false, sort_order: 0 },
  { weekday: 7, label: 'Rest — optional Pilates/Vinyasa Yoga', required: false, sort_order: 0 },
]

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error

    if (data) {
      setProfile(data)
      return data
    }

    // First login for this user — create the empty profiles row per SPEC §4.1.
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId })
      .select()
      .single()

    if (insertError) throw insertError

    // Seed a default weekly training split alongside the new profile so the
    // Plan screen isn't empty on first run. Best-effort — a failure here
    // shouldn't block login, the user can just add days manually.
    try {
      await supabase.from('training_plan_days').insert(DEFAULT_TRAINING_PLAN.map((row) => ({ user_id: userId, ...row })))
    } catch {
      // non-fatal
    }

    setProfile(created)
    return created
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return null
    return loadProfile(session.user.id)
  }, [session, loadProfile])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!active) return
      setSession(initialSession)
      if (initialSession?.user?.id) {
        await loadProfile(initialSession.user.id)
      }
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return
      setSession(newSession)
      if (newSession?.user?.id) {
        await loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const needsOnboarding = Boolean(session) && !profile?.protocol_start_date

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    needsOnboarding,
    refreshProfile,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
