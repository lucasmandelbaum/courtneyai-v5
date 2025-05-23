'use client'

import { supabase } from '@/lib/supabase'
import { type Template } from '@/lib/supabase'

/**
 * Fetch all templates
 */
export async function getTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('is_popular', { ascending: false })

  if (error) {
    console.error('Error fetching templates:', error)
    throw error
  }

  return data || []
}

/**
 * Fetch a single template by ID
 */
export async function getTemplateById(id: string): Promise<Template | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching template:', error)
    throw error
  }

  return data
}

/**
 * Fetch popular templates
 */
export async function getPopularTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('is_popular', true)

  if (error) {
    console.error('Error fetching popular templates:', error)
    throw error
  }

  return data || []
} 