import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isCloud } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // En mode local, on considère l'utilisateur toujours connecté.
  const [session, setSession] = useState(isCloud ? undefined : { local: true })

  useEffect(() => {
    if (!isCloud) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.includes('Invalid login')) throw new Error('E-mail ou mot de passe incorrect.')
      throw new Error(error.message)
    }
  }

  async function signOut() {
    if (isCloud) await supabase.auth.signOut()
  }

  const value = {
    session,
    loading: session === undefined,
    user: session?.user ?? null,
    signIn,
    signOut
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
