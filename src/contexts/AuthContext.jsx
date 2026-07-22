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

  async function signUp(email, password, username, inviteCode) {
    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', inviteCode)
      .is('used_by', null)
      .maybeSingle()

    if (inviteError || !invite) {
      return { error: { message: 'Invalid or already-used invite code' } }
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { error: { message: 'This invite code has expired' } }
    }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    })
    if (error) return { error }

    const userId = data.user?.id
    if (userId) {
      await supabase.from('invite_codes').update({ used_by: userId, used_at: new Date().toISOString() }).eq('code', inviteCode)
      if (invite.collaboration_id) {
        await supabase.from('collaboration_members').insert({ collaboration_id: invite.collaboration_id, user_id: userId, role: 'member' })
      }
    }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateEmail(newEmail) {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    return { error }
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error }
  }

  const value = { session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut, updateEmail, updatePassword }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
