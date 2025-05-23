"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Database } from "@/lib/database.types"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export type Photo = Database["public"]["Tables"]["photos"]["Row"] & {
  description?: string
  ai_analysis_id?: string
}

export type Video = Database["public"]["Tables"]["videos"]["Row"]

export type MediaType = "photo" | "video"

export function useMedia(productId: string) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  const fetchMedia = useCallback(async () => {
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

      // Fetch photos
      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })

      if (photosError) throw photosError
      setPhotos(photosData || [])

      // Fetch videos
      const { data: videosData, error: videosError } = await supabase
        .from("videos")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })

      if (videosError) throw videosError
      setVideos(videosData || [])
    } catch (e) {
      console.error("Error fetching media:", e)
      setError(e instanceof Error ? e : new Error("Failed to fetch media"))
      if ((e as any)?.status === 401) {
        router.push("/auth/login")
      }
    } finally {
      setIsLoading(false)
    }
  }, [productId, router])

  const uploadMedia = useCallback(async (file: File, type: MediaType) => {
    if (!productId) throw new Error("Product ID is required")

    try {
      console.log(`Starting upload for ${type}:`, { fileName: file.name, fileType: file.type, fileSize: file.size })
      
      const supabase = createBrowserSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      console.log(`Authenticated user:`, user.id)

      // Upload file to storage
      const fileExt = file.name.split(".").pop()
      const filePath = `${type}s/${productId}/${Math.random()}.${fileExt}`
      
      console.log(`Uploading to storage path:`, filePath)
      
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file)

      if (uploadError) {
        console.error(`Storage upload error:`, uploadError)
        throw uploadError
      }

      console.log(`Storage upload successful`)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("media")
        .getPublicUrl(filePath)

      console.log(`Generated public URL:`, publicUrl)

      // For photos, analyze the image first
      let imageAnalysis = null
      if (type === "photo") {
        console.log(`Starting image analysis for photo`)
        // Get auth session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        if (!session) {
          router.push("/auth/login")
          throw new Error("Not authenticated")
        }

        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-image', {
          body: { 
            image_url: publicUrl,
            product_id: productId
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })

        if (analysisError) {
          console.error("Error analyzing image:", analysisError)
        } else {
          console.log("Image analysis completed:", analysisData)
          imageAnalysis = analysisData
        }
      }

      console.log(`Creating database record for ${type}`)

      // Create database record
      if (type === "photo") {
        const { error: dbError } = await supabase
          .from("photos")
          .insert({
            product_id: productId,
            file_path: publicUrl,
            file_name: file.name,
            user_id: user.id,
            description: imageAnalysis?.description,
            ai_analysis_id: imageAnalysis?.request_id
          })
        if (dbError) {
          console.error(`Photos table insert error:`, dbError)
          throw dbError
        }
      } else {
        const { error: dbError } = await supabase
          .from("videos")
          .insert({
            product_id: productId,
            file_path: publicUrl,
            file_name: file.name,
            user_id: user.id
          })
        if (dbError) {
          console.error(`Videos table insert error:`, dbError)
          throw dbError
        }
      }

      console.log(`Database record created successfully for ${type}`)

      // Refresh media list
      fetchMedia()
    } catch (e) {
      console.error("Error uploading media:", e)
      throw e instanceof Error ? e : new Error("Failed to upload media")
    }
  }, [productId, fetchMedia, router])

  const deleteMedia = useCallback(async (id: string, type: MediaType) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from(type === "photo" ? "photos" : "videos")
        .delete()
        .eq("id", id)

      if (dbError) throw dbError

      // Refresh media list
      fetchMedia()
    } catch (e) {
      console.error("Error deleting media:", e)
      throw e instanceof Error ? e : new Error("Failed to delete media")
    }
  }, [fetchMedia, router])

  const downloadFromUrl = useCallback(async () => {
    if (!productId) return

    try {
      const supabase = createBrowserSupabaseClient()
      
      // Get auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!session) {
        router.push("/auth/login")
        return
      }

      // Extract and analyze images
      const { data, error } = await supabase.functions.invoke('extract-product-images', {
        body: { productId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) throw error
      if (!data.success) {
        throw new Error(data.error || 'Failed to extract images')
      }

      toast.success(`Successfully extracted ${data.processedImages.length} images`)
      await fetchMedia() // Refresh the media list

    } catch (e) {
      console.error("Error downloading from URL:", e)
      const message = e instanceof Error ? e.message : 'Failed to download images from URL'
      toast.error(message)
      throw e
    }
  }, [productId, fetchMedia, router])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  return {
    photos,
    videos,
    isLoading,
    error,
    uploadMedia,
    deleteMedia,
    downloadFromUrl,
    refetch: fetchMedia
  }
} 