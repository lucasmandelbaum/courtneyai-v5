'use server'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from './database.types'
import { cache } from 'react'

export const createServerSupabaseClient = cache(() =>
  createServerComponentClient<Database>({ cookies })
)

export async function getSession() {
  const supabase = createServerSupabaseClient()
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error('Error:', error)
    return null
  }
}

export async function getUserDetails() {
  const supabase = createServerSupabaseClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Error:', error)
    return null
  }
}

export async function getProfile() {
  const supabase = createServerSupabaseClient()
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select(`*`)
      .single()
    return profile
  } catch (error) {
    console.error('Error:', error)
    return null
  }
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