'use client'

import { supabase } from '@/lib/supabase'
import { type Reel } from '@/lib/supabase'

/**
 * Fetch all reels for a product
 */
export async function getReelsByProductId(productId: string): Promise<Reel[]> {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching reels:', error)
    throw error
  }

  return data || []
}

/**
 * Fetch a single reel by ID
 */
export async function getReelById(id: string): Promise<Reel | null> {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching reel:', error)
    throw error
  }

  return data
}

/**
 * Delete a reel
 */
export async function deleteReel(id: string): Promise<void> {
  try {
    // First get the reel to get the storage path
    const { data: reel, error: fetchError } = await supabase
      .from('reels')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (fetchError) {
      throw fetchError
    }

    // Delete the file from storage if it exists
    if (reel && reel.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('generated-reels')
        .remove([reel.storage_path.replace('generated-reels/', '')])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue anyway to delete the database record
      }
    }

    // Delete the database record
    const { error } = await supabase
      .from('reels')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error deleting reel:', error)
    throw error
  }
}

/**
 * Generate a reel using the edge function
 */
export async function generateReel(
  productId: string,
  templateId: string,
  photoIds: string[],
  title: string,
  userId: string,
  scriptId?: string
): Promise<Reel> {
  try {
    const response = await fetch('/api/edge/generate-reel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        templateId,
        photoIds,
        title,
        userId,
        scriptId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to start reel generation')
    }

    const data = await response.json()
    return data.reel
  } catch (error) {
    console.error('Error generating reel:', error)
    throw error
  }
}

/**
 * Check the status of a reel
 */
export async function checkReelStatus(id: string): Promise<Reel> {
  const { data, error } = await supabase
    .from('reels')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error checking reel status:', error)
    throw error
  }

  return data
}

/**
 * Get the public URL for a reel
 */
export function getReelPublicUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from('generated-reels')
    .getPublicUrl(storagePath.replace('generated-reels/', ''))
  
  return data.publicUrl
} 