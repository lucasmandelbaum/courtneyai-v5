import { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

export interface Voice {
  id: string
  voice_id: string
  name: string
  description: string | null
  category: string
  gender: string | null
  age: string | null
  accent: string | null
  use_case: string | null
  descriptive: string | null
  preview_url: string | null
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export function useVoices() {
  const [voices, setVoices] = useState<Voice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [defaultVoice, setDefaultVoice] = useState<Voice | null>(null)

  const supabase = createBrowserSupabaseClient()

  const fetchVoices = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Use any to bypass type checking until voices table is in generated types
      const { data, error: fetchError } = await (supabase as any)
        .from('voices')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      const voicesData = data as Voice[]
      setVoices(voicesData)
      
      // Find the default voice
      const defaultVoiceData = voicesData.find(voice => voice.is_default)
      setDefaultVoice(defaultVoiceData || null)

    } catch (err) {
      console.error('Error fetching voices:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch voices'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVoices()
  }, [])

  return {
    voices,
    defaultVoice,
    isLoading,
    error,
    refetch: fetchVoices
  }
} 