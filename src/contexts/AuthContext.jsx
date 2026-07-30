import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp(email, password, username) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    })
    return { error: error ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateEmail(currentPassword, newEmail) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: session?.user?.email,
      password: currentPassword,
    })
    if (authError) return { error: { message: 'Current password is incorrect.' } }
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    return { error }
  }

  async function updatePassword(currentPassword, newPassword) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: session?.user?.email,
      password: currentPassword,
    })
    if (authError) return { error: { message: 'Current password is incorrect.' } }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  async function updateUsername(newUsername) {
    if (!profile) return { error: { message: 'Not signed in.' } }
    const { data, error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', profile.id).select().single()
    if (error) {
      if (error.code === '23505') return { error: { message: 'That username is already taken.' } }
      return { error }
    }
    setProfile(data)
    return { error: null }
  }

  const value = { session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut, updateEmail, updatePassword, updateUsername }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
