'use client'

import { supabase } from '@/lib/supabase'
import { type Profile } from '@/lib/supabase'

/**
 * Fetch the current user's profile
 */
export async function getProfile(): Promise<Profile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return null
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error in getProfile:', error)
    throw error
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>): Promise<Profile> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error in updateProfile:', error)
    throw error
  }
}

/**
 * Upload a profile avatar
 */
export async function uploadAvatar(file: File): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }
    
    // Create a unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`
    
    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      throw uploadError
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    // Update the user's profile with the new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    return publicUrl
  } catch (error) {
    console.error('Error uploading avatar:', error)
    throw error
  }
} 