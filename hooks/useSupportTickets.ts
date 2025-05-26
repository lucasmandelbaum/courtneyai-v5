import { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useAuth } from './useAuth'

export interface SupportTicket {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  type: 'bug' | 'feature_request' | 'general_support'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  browser_info?: any
  user_agent?: string
  url?: string
  metadata?: any
  admin_notes?: string
  response?: string
  resolved_at?: string
  resolved_by?: string
}

export interface CreateSupportTicketData {
  title: string
  description: string
  type?: 'bug' | 'feature_request' | 'general_support'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  browserInfo?: any
  url?: string
}

export function useSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const supabase = createBrowserSupabaseClient()

  // Fetch user's support tickets
  const fetchTickets = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setTickets(data || [])
    } catch (err) {
      console.error('Error fetching support tickets:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch support tickets')
    } finally {
      setLoading(false)
    }
  }

  // Submit a new support ticket
  const submitTicket = async (ticketData: CreateSupportTicketData): Promise<SupportTicket | null> => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    setSubmitting(true)
    setError(null)

    try {
      // Get browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        timestamp: new Date().toISOString()
      }

      // Get current URL
      const currentUrl = window.location.href

      // Call the API route (which proxies to the edge function)
      const { data: authData } = await supabase.auth.getSession()
      if (!authData.session) {
        throw new Error('No active session')
      }

      const response = await fetch('/api/edge/submit-support-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          ...ticketData,
          browserInfo,
          url: currentUrl
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit support ticket')
      }

      const result = await response.json()
      const newTicket = result.ticket

      // Add the new ticket to the local state
      setTickets(prev => [newTicket, ...(prev || [])])

      // Also refetch to ensure consistency
      await fetchTickets()

      return newTicket
    } catch (err) {
      console.error('Error submitting support ticket:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit support ticket')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  // Update ticket status (for user updates like closing their own ticket)
  const updateTicket = async (ticketId: string, updates: Partial<SupportTicket>): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated')
      return false
    }

    try {
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId)
        .eq('user_id', user.id) // Ensure user can only update their own tickets

      if (updateError) {
        throw updateError
      }

      // Update local state
      setTickets(prev => (prev || []).map(ticket => 
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket
      ))

      return true
    } catch (err) {
      console.error('Error updating support ticket:', err)
      setError(err instanceof Error ? err.message : 'Failed to update support ticket')
      return false
    }
  }

  // Load tickets when user changes
  useEffect(() => {
    if (user) {
      fetchTickets()
    } else {
      setTickets([])
    }
  }, [user])

  // Set up real-time subscription for ticket updates
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('support_tickets_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${user.id}`
        },
        (payload: any) => {
          console.log('Support ticket change received:', payload)
          
          if (payload.eventType === 'INSERT' && payload.new) {
            setTickets(prev => [payload.new as SupportTicket, ...(prev || [])])
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setTickets(prev => (prev || []).map(ticket => 
              ticket.id === payload.new.id ? payload.new as SupportTicket : ticket
            ))
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setTickets(prev => (prev || []).filter(ticket => ticket.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return {
    tickets,
    loading,
    submitting,
    error,
    submitTicket,
    updateTicket,
    refetch: fetchTickets,
    clearError: () => setError(null)
  }
} 