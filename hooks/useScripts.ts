"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Database } from "@/lib/database.types"
import { useRouter } from "next/navigation"

export type Script = Database["public"]["Tables"]["scripts"]["Row"]

export function useScripts(productId: string) {
  const [scripts, setScripts] = useState<Script[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  const fetchScripts = useCallback(async () => {
    if (!productId) return

    try {
      setIsLoading(true)
      const supabase = createBrowserSupabaseClient()

      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data, error } = await supabase
        .from("scripts")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setScripts(data || [])
    } catch (e) {
      console.error("Error fetching scripts:", e)
      setError(e instanceof Error ? e : new Error("Failed to fetch scripts"))
      if ((e as any)?.status === 401) {
        router.push("/auth/login")
      }
    } finally {
      setIsLoading(false)
    }
  }, [productId, router])

  const createScript = useCallback(async (data: { title: string; content: string }) => {
    if (!productId) throw new Error("Product ID is required")

    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      
      if (authError) throw authError
      if (!session) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      const response = await fetch('/api/edge/create-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          productId,
          title: data.title,
          content: data.content
        })
        })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create script')
      }
      
      // Refresh scripts list
      fetchScripts()
    } catch (e) {
      console.error("Error creating script:", e)
      throw e instanceof Error ? e : new Error("Failed to create script")
    }
  }, [productId, fetchScripts, router])

  const deleteScript = useCallback(async (id: string) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      const { error } = await supabase
        .from("scripts")
        .delete()
        .eq("id", id)

      if (error) throw error
      
      // Refresh scripts list
      fetchScripts()
    } catch (e) {
      console.error("Error deleting script:", e)
      throw e instanceof Error ? e : new Error("Failed to delete script")
    }
  }, [fetchScripts, router])

  const editScript = useCallback(async (id: string, data: { 
    title: string
    content: string
    caption?: string | null 
  }) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      const { error } = await supabase
        .from("scripts")
        .update({
          title: data.title,
          content: data.content,
          caption: data.caption
        })
        .eq("id", id)

      if (error) throw error
      
      // Refresh scripts list
      fetchScripts()
    } catch (e) {
      console.error("Error editing script:", e)
      throw e instanceof Error ? e : new Error("Failed to edit script")
    }
  }, [fetchScripts, router])

  useEffect(() => {
    fetchScripts()
  }, [fetchScripts])

  return {
    scripts,
    isLoading,
    error,
    createScript,
    deleteScript,
    editScript,
    refetch: fetchScripts
  }
} 