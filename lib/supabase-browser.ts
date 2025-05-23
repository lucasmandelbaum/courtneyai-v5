import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { type Database } from './database.types'

export const createBrowserSupabaseClient = () =>
  createClientComponentClient<Database>()

export async function signInWithEmail(email: string, password: string) {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  return { data, error }
}

export async function signOut() {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function resetPassword(email: string) {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
  })
  return { error }
}

export async function updatePassword(password: string) {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.auth.updateUser({
    password,
  })
  return { error }
}

export async function updateProfile({
  username,
  full_name,
  avatar_url,
  website,
}: {
  username?: string
  full_name?: string
  avatar_url?: string
  website?: string
}) {
  const supabase = createBrowserSupabaseClient()
  const { data: user } = await supabase.auth.getUser()
  
  if (!user.user?.id) return { error: new Error('No user found') }
  
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.user.id,
      username,
      full_name,
      avatar_url,
      website,
      updated_at: new Date().toISOString(),
    })
  
  return { error }
}

// Define types based on our Database interface
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

export type Product = Tables<'products'>
export type Profile = Tables<'profiles'>
export type Photo = Tables<'photos'>
export type Script = Tables<'scripts'>
export type Template = Tables<'templates'>
export type Reel = Tables<'reels'> 