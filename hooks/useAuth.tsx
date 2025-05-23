"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js"
import { signInWithEmail, signUpWithEmail, signOut as browserSignOut } from "@/lib/supabase-browser"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
        
        if (event === 'SIGNED_IN') {
          console.log('User signed in')
          router.refresh()
        }
        if (event === 'SIGNED_OUT') {
          console.log('User signed out')
          router.refresh()
        }
        if (event === 'USER_UPDATED') {
          console.log('User updated')
          router.refresh()
        }
      }
    )

    // Initial session check
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting initial session:', error.message)
          throw error
        }
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error: any) {
        setError(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    getInitialSession()

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router, supabase])

  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error } = await signUpWithEmail(email, password)
      
      if (error) throw error
      
      if (data.user?.identities?.length === 0) {
        throw new Error('Email already registered')
      }
      
    } catch (error: any) {
      console.error('Sign up error:', error.message)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data, error } = await signInWithEmail(email, password)
      
      if (error) throw error
      
      if (!data.session) {
        throw new Error('No session created')
      }
      
      console.log('Sign in successful in auth hook')
      
    } catch (error: any) {
      console.error('Sign in error:', error.message)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { error } = await browserSignOut()
      
      if (error) throw error
      
    } catch (error: any) {
      console.error('Sign out error:', error.message)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const value = {
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
    error,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 