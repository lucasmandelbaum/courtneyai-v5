"use client"

import { useCallback, useEffect, useState, useMemo, useRef } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Database } from "@/lib/database.types"
import { useRouter } from "next/navigation"

export type Reel = Database["public"]["Tables"]["reels"]["Row"]
export type ReelStatus = 
  | 'pending' 
  | 'processing' 
  | 'generating_audio' 
  | 'processing_media' 
  | 'rendering_preparing'
  | 'rendering_processing'
  | 'rendering_finalizing'
  | 'completed' 
  | 'failed';

export function useReels(productId: string) {
  const [reels, setReels] = useState<Reel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [reelStatuses, setReelStatuses] = useState<Record<string, ReelStatus>>({})
  const router = useRouter()
  const pendingRequests = new Set<string>()
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({})

  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  // Fetch reels with status
  const fetchReels = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data: reelsData, error: reelsError } = await supabase
        .from('reels')
        .select(`
          *,
          script:scripts(*),
          reel_media(*)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })

      if (reelsError) throw reelsError

      setReels(reelsData || [])
      
      // Update status for each reel
      const newStatuses: Record<string, ReelStatus> = {}
      reelsData?.forEach(reel => {
        newStatuses[reel.id] = reel.status as ReelStatus
        // Subscribe to updates for in-progress reels
        if ([
          'pending',
          'processing',
          'generating_audio',
          'processing_media',
          'rendering_preparing',
          'rendering_processing',
          'rendering_finalizing'
        ].includes(reel.status)) {
          console.log('Setting up subscription for reel:', reel.id, 'with status:', reel.status);
          subscribeToReelStatus(reel.id)
        }
      })
      setReelStatuses(prev => ({...prev, ...newStatuses}))
      
    } catch (e) {
      console.error('Error fetching reels:', e)
      setError(e instanceof Error ? e : new Error('Failed to fetch reels'))
    } finally {
      setIsLoading(false)
    }
  }, [productId, supabase])

  // Add continuous polling for all in-progress reels
  useEffect(() => {
    const inProgressReels = Object.entries(reelStatuses).filter(([_, status]) => 
      status && [
        'pending',
        'processing',
        'generating_audio',
        'processing_media',
        'rendering_preparing',
        'rendering_processing',
        'rendering_finalizing'
      ].includes(status)
    ).map(([id]) => id);

    if (inProgressReels.length === 0) {
      console.log('No in-progress reels found, skipping polling');
      return;
    }

    console.log('Found in-progress reels:', inProgressReels);
    const pollingInterval = setInterval(() => {
      console.log('Polling in-progress reels:', inProgressReels);
      fetchReels();
    }, 5000);

    return () => {
      console.log('Cleaning up polling for reels:', inProgressReels);
      clearInterval(pollingInterval);
    };
  }, [reelStatuses, fetchReels]);

  // Add polling mechanism for a specific reel
  const startPolling = useCallback((reelId: string) => {
    // Clear any existing polling for this reel
    if (pollingIntervalsRef.current[reelId]) {
      clearInterval(pollingIntervalsRef.current[reelId])
    }

    // Set up new polling interval
    pollingIntervalsRef.current[reelId] = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('reels')
          .select('*')
          .eq('id', reelId)
          .single()

        if (error) throw error

        if (data) {
          const newStatus = data.status as ReelStatus
          setReelStatuses(prev => ({
            ...prev,
            [reelId]: newStatus
          }))

          // If status is final, stop polling
          if (newStatus === 'completed' || newStatus === 'failed') {
            clearInterval(pollingIntervalsRef.current[reelId])
            delete pollingIntervalsRef.current[reelId]
            fetchReels()
          }
        }
      } catch (e) {
        console.error('Error polling reel status:', e)
      }
    }, 5000) // Poll every 5 seconds
  }, [supabase, fetchReels])

  // Modify subscribeToReelStatus to include polling
  const subscribeToReelStatus = useCallback((reelId: string): (() => void) => {
    // Start polling for this reel
    startPolling(reelId)

    const subscription = supabase
      .channel(`reel-${reelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reels',
          filter: `id=eq.${reelId}`
        },
        (payload: { new: { status: string } }) => {
          console.log('Received reel update:', payload)
          const newStatus = payload.new.status as ReelStatus
          setReelStatuses(prev => ({
            ...prev,
            [reelId]: newStatus
          }))
          
          // If status is completed or failed, stop polling and refresh
          if (newStatus === 'completed' || newStatus === 'failed') {
            if (pollingIntervalsRef.current[reelId]) {
              clearInterval(pollingIntervalsRef.current[reelId])
              delete pollingIntervalsRef.current[reelId]
            }
            fetchReels()
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      if (pollingIntervalsRef.current[reelId]) {
        clearInterval(pollingIntervalsRef.current[reelId])
        delete pollingIntervalsRef.current[reelId]
      }
    }
  }, [supabase, fetchReels, startPolling])

  const getReelStatus = useCallback((reelId: string): ReelStatus => {
    return reelStatuses[reelId] || 'pending'
  }, [reelStatuses])

  const createReel = useCallback(async (data: { 
    title: string; 
    script_id?: string; 
    template_id: number;
    photo_ids?: string[];
    video_ids?: string[];
  }) => {
    if (!productId) throw new Error("Product ID is required")

    // Generate a request ID based on the input data
    const requestId = JSON.stringify({ ...data, productId })
    
    // Check if this exact request is already pending
    if (pendingRequests.has(requestId)) {
      console.log('Duplicate request detected, skipping:', requestId)
      return
    }

    try {
      pendingRequests.add(requestId)
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      
      if (authError) throw authError
      if (!session?.access_token) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      // Ensure token is properly formatted
      const token = session.access_token.trim()
      if (!token.startsWith('eyJ')) {
        console.error('Invalid token format:', token.substring(0, 10))
        throw new Error('Invalid authentication token format')
      }

      console.log('Client-side session check:', {
        hasSession: true,
        tokenFormat: `${token.substring(0, 10)}...`
      })

      // Call the Edge Function to generate the reel via Next.js API route
      try {
        console.log('Initiating reel creation request with payload:', {
          productId,
          scriptId: data.script_id,
          templateId: data.template_id,
          hasPhotoIds: !!data.photo_ids?.length,
          photoCount: data.photo_ids?.length,
          hasVideoIds: !!data.video_ids?.length,
          videoCount: data.video_ids?.length
        })

        const response = await fetch('/api/edge/generate-reel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            productId,
            scriptId: data.script_id,
            templateId: data.template_id,
            photoIds: data.photo_ids,
            videoIds: data.video_ids,
            title: data.title
          }),
          credentials: 'include'
        });

        console.log('Initial response status:', response.status)
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response details:', {
            status: response.status,
            errorData,
            responseHeaders: Object.fromEntries(response.headers.entries())
          });
          throw new Error(errorData.error || 'Failed to generate reel');
        }

        const responseData = await response.json();
        console.log("Edge function response:", responseData);

        // Set initial status and subscribe to updates
        setReelStatuses(prev => ({
          ...prev,
          [responseData.reel_id]: 'pending'
        }))
        subscribeToReelStatus(responseData.reel_id)
        
        // Immediately refresh the reels list to show the new pending reel
        fetchReels()

        return { id: responseData.reel_id, status: 'pending' }
      } catch (error) {
        console.error("Error generating reel:", error);
        throw error;
      }
    } catch (e) {
      console.error("Error creating reel:", e)
      throw e instanceof Error ? e : new Error("Failed to create reel")
    } finally {
      pendingRequests.delete(requestId)
    }
  }, [productId, subscribeToReelStatus, router, pendingRequests])

  const deleteReel = useCallback(async (id: string) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      // Delete reel media first
      const { error: mediaError } = await supabase
        .from("reel_media")
        .delete()
        .eq("reel_id", id)

      if (mediaError) throw mediaError

      // Then delete the reel
      const { error } = await supabase
        .from("reels")
        .delete()
        .eq("id", id)

      if (error) throw error
      
      // Refresh reels list
      fetchReels()
    } catch (e) {
      console.error("Error deleting reel:", e)
      throw e instanceof Error ? e : new Error("Failed to delete reel")
    }
  }, [fetchReels, router])

  useEffect(() => {
    fetchReels()
  }, [fetchReels])

  // Modify the cleanup effect to handle polling intervals
  useEffect(() => {
    const cleanup = () => {
      // Clear all polling intervals
      Object.values(pollingIntervalsRef.current).forEach(interval => {
        clearInterval(interval)
      })
      pollingIntervalsRef.current = {}

      // Clear all subscriptions
      Object.keys(reelStatuses).forEach(reelId => {
        supabase.channel(`reel-${reelId}`).unsubscribe()
      })
    }
    return cleanup
  }, [supabase, reelStatuses])

  const getStatusMessage = (status: ReelStatus, details?: Reel['progress_details']): string => {
    if (!status) return 'Processing...';
    
    if (details?.message) {
      return details.message;
    }

    switch (status) {
      case 'pending': return 'Starting...';
      case 'processing': return 'Processing...';
      case 'generating_audio': return 'Generating audio...';
      case 'processing_media': return 'Processing media...';
      case 'rendering_preparing': return 'Preparing video...';
      case 'rendering_processing': return 'Rendering video...';
      case 'rendering_finalizing': return 'Finalizing video...';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Processing...';
    }
  };

  return {
    reels,
    isLoading,
    error,
    createReel,
    deleteReel,
    refetch: fetchReels,
    getReelStatus,
    reelStatuses,
    getStatusMessage
  }
} 