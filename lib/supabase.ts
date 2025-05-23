import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'supabase.auth.token',
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Define types based on our Database interface
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row']

export type Product = Tables<'products'>
export type Profile = Tables<'profiles'>
export type Photo = Tables<'photos'>
export type Script = Tables<'scripts'>
export type Template = {
  id: string
  name: string
  description: string | null
  features: string[]
  is_popular: boolean
  created_at: string
  updated_at: string
}
export type Reel = {
  id: string
  created_at: string
  product_id: string | null
  script_id: string | null
  template_id: number | null
  title: string
  storage_path: string | null
  file_path: string | null
  duration: number | null
  status: string
  user_id: string | null
} 