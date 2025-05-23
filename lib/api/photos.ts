'use client'

import { supabase } from '@/lib/supabase'
import { type Photo } from '@/lib/supabase'

/**
 * Fetch all photos for a product
 */
export async function getPhotosByProductId(productId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('product_id', productId)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Error fetching photos:', error)
    throw error
  }

  return data || []
}

/**
 * Upload a photo and create a database record
 */
export async function uploadPhoto(
  file: File,
  productId: string,
  userId: string,
  options: {
    name?: string,
    alt_text?: string,
    display_order?: number
  } = {}
): Promise<Photo> {
  try {
    // Create a unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${productId}/${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    // Upload the file to storage
    const { error: uploadError } = await supabase.storage
      .from('product-photos')
      .upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    // Get the public URL for the file
    const { data: { publicUrl } } = supabase.storage
      .from('product-photos')
      .getPublicUrl(filePath)

    // Create a record in the photos table
    const { data, error } = await supabase
      .from('photos')
      .insert([{
        product_id: productId,
        storage_path: filePath,
        name: options.name || file.name,
        alt_text: options.alt_text || '',
        display_order: options.display_order || 0,
        user_id: userId
      }])
      .select()
      .single()

    if (error) {
      // If there was an error creating the database record, delete the uploaded file
      await supabase.storage
        .from('product-photos')
        .remove([filePath])
      
      throw error
    }

    return data
  } catch (error) {
    console.error('Error uploading photo:', error)
    throw error
  }
}

/**
 * Update a photo's metadata
 */
export async function updatePhoto(
  id: string,
  updates: Partial<Pick<Photo, 'name' | 'alt_text' | 'display_order'>>
): Promise<Photo> {
  const { data, error } = await supabase
    .from('photos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating photo:', error)
    throw error
  }

  return data
}

/**
 * Delete a photo
 */
export async function deletePhoto(id: string): Promise<void> {
  try {
    // First get the photo record to get the storage path
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (fetchError) {
      throw fetchError
    }

    // Delete the file from storage
    if (photo && photo.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('product-photos')
        .remove([photo.storage_path])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue anyway to delete the database record
      }
    }

    // Delete the database record
    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error deleting photo:', error)
    throw error
  }
}

/**
 * Reorder photos
 */
export async function reorderPhotos(photoOrders: { id: string, display_order: number }[]): Promise<void> {
  try {
    // Use a transaction to update all photos
    const updates = photoOrders.map(({ id, display_order }) => (
      supabase
        .from('photos')
        .update({ display_order })
        .eq('id', id)
    ))

    // Execute all updates
    await Promise.all(updates)
  } catch (error) {
    console.error('Error reordering photos:', error)
    throw error
  }
} 