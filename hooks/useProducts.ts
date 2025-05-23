"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { Database } from "@/lib/database.types"
import { useRouter } from "next/navigation"

export type Product = Database["public"]["Tables"]["products"]["Row"]

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  const fetchProducts = useCallback(async () => {
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
        .from("products")
        .select(`
          *,
          photos!photos_product_id_fkey (
            file_path,
            created_at
          ),
          photos_count: photos(count),
          videos: videos(count),
          scripts: scripts(count),
          reels: reels(count)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      
      // Transform the data to include thumbnail_url from the first photo
      const productsWithThumbnails = (data || []).map(product => ({
        ...product,
        thumbnail_url: product.photos?.[0]?.file_path || null,
        photos: { count: product.photos_count?.[0]?.count || 0 }
      }))
      
      setProducts(productsWithThumbnails)
    } catch (e) {
      console.error("Error fetching products:", e)
      setError(e instanceof Error ? e : new Error("Failed to fetch products"))
      if ((e as any)?.status === 401) {
        router.push("/auth/login")
      }
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const createProduct = useCallback(async (data: { name: string; description?: string }) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      const { data: product, error } = await supabase
        .from("products")
        .insert({
          name: data.name,
          description: data.description,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error
      
      // Refresh products list
      fetchProducts()
      
      return product
    } catch (e) {
      console.error("Error creating product:", e)
      throw e instanceof Error ? e : new Error("Failed to create product")
    }
  }, [fetchProducts, router])

  const deleteProduct = useCallback(async (id: string) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        throw new Error("Not authenticated")
      }

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)

      if (error) throw error
      
      // Refresh products list
      fetchProducts()
    } catch (e) {
      console.error("Error deleting product:", e)
      throw e instanceof Error ? e : new Error("Failed to delete product")
    }
  }, [fetchProducts, router])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return {
    products,
    isLoading,
    error,
    createProduct,
    deleteProduct,
    refetch: fetchProducts
  }
} 