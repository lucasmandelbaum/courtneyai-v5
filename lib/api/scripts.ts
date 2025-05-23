'use client'

import { supabase } from '@/lib/supabase'
import { type Script } from '@/lib/supabase'

/**
 * Fetch all scripts for a product
 */
export async function getScriptsByProductId(productId: string): Promise<Script[]> {
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching scripts:', error)
    throw error
  }

  return data || []
}

/**
 * Fetch a single script by ID
 */
export async function getScriptById(id: string): Promise<Script | null> {
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching script:', error)
    throw error
  }

  return data
}

/**
 * Create a script manually
 */
export async function createScript(script: Omit<Script, 'id' | 'created_at' | 'updated_at'>): Promise<Script> {
  const { data, error } = await supabase
    .from('scripts')
    .insert([script])
    .select()
    .single()

  if (error) {
    console.error('Error creating script:', error)
    throw error
  }

  return data
}

/**
 * Update a script
 */
export async function updateScript(
  id: string,
  updates: Partial<Pick<Script, 'content' | 'title'>>
): Promise<Script> {
  const { data, error } = await supabase
    .from('scripts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating script:', error)
    throw error
  }

  return data
}

/**
 * Delete a script
 */
export async function deleteScript(id: string): Promise<void> {
  const { error } = await supabase
    .from('scripts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting script:', error)
    throw error
  }
}

/**
 * Generate a script using AI
 */
export async function generateScript(
  productId: string,
  prompt: string,
  userId: string,
  productName?: string,
  productUrl?: string
): Promise<Script> {
  try {
    const response = await fetch('/api/edge/generate-script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        productName,
        productUrl,
        prompt,
        userId,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to generate script')
    }

    const data = await response.json()
    return data.script
  } catch (error) {
    console.error('Error generating script:', error)
    throw error
  }
} 