import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'
import { checkUsageLimit, incrementUsage, createUsageLimitResponse } from '../_shared/usage.ts'

interface ReframeImageRequest {
  imageId: string
  imageSize?: 'square' | 'portrait_16_9' | 'landscape_16_9' | 'portrait_4_3' | 'landscape_4_3'
  renderingSpeed?: 'TURBO' | 'STANDARD'
}

interface LogEvent {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  event: string
  duration?: number
  metadata?: Record<string, unknown>
}

interface ImageDimensions {
  width: number
  height: number
  aspect_ratio: number
}

function logEvent(event: LogEvent) {
  console.log(JSON.stringify(event))
}

// Helper function to extract image dimensions from blob
async function getImageDimensions(imageBlob: Blob): Promise<ImageDimensions> {
  try {
    // Create an image element to get dimensions
    const arrayBuffer = await imageBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Simple PNG dimension extraction (first 24 bytes contain width/height)
    if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
      const width = (uint8Array[16] << 24) | (uint8Array[17] << 16) | (uint8Array[18] << 8) | uint8Array[19]
      const height = (uint8Array[20] << 24) | (uint8Array[21] << 16) | (uint8Array[22] << 8) | uint8Array[23]
      return {
        width,
        height,
        aspect_ratio: width / height
      }
    }
    
    // Simple JPEG dimension extraction (more complex, fallback to default)
    if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
      // For JPEG, we'd need more complex parsing, so return default for now
      return { width: 1024, height: 1024, aspect_ratio: 1.0 }
    }
    
    // Default fallback
    return { width: 1024, height: 1024, aspect_ratio: 1.0 }
  } catch (error) {
    console.error('Error extracting image dimensions:', error)
    return { width: 1024, height: 1024, aspect_ratio: 1.0 }
  }
}

async function reframeImage(imageUrl: string, imageSize: string, renderingSpeed: string, falApiKey: string) {
  const falResponse = await fetch('https://fal.run/fal-ai/ideogram/v3/reframe', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rendering_speed: renderingSpeed,
      num_images: 1,
      image_url: imageUrl,
      image_size: imageSize,
      image_urls: []
    })
  })

  if (!falResponse.ok) {
    throw new Error(`Failed to reframe image: ${await falResponse.text()}`)
  }

  const falData = await falResponse.json()
  return {
    images: falData.images || [],
    seed: falData.seed,
    request_id: crypto.randomUUID()
  }
}

serve(async (req) => {
  const startTime = performance.now()

  logEvent({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'Reframe image function called',
    metadata: {
      method: req.method,
      url: req.url
    }
  })

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const falApiKey = Deno.env.get('FAL_API_KEY')

    if (!supabaseUrl || !supabaseKey || !falApiKey) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Missing required environment variables'
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'No authorization token provided'
      })
      return new Response(
        JSON.stringify({ error: 'No authorization token provided' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify the user token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Invalid authorization token',
        metadata: { error: userError }
      })
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'User authenticated successfully',
      metadata: { user_id: user.id }
    })

    // Parse request body
    const body = await req.json()
    const { 
      imageId, 
      imageSize = 'portrait_16_9', 
      renderingSpeed = 'TURBO' 
    } = body as ReframeImageRequest

    if (!imageId) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Missing image ID in request'
      })
      return new Response(
        JSON.stringify({ error: 'Image ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Starting image reframing',
      metadata: { imageId, imageSize, renderingSpeed, user_id: user.id }
    })

    // Check usage limits BEFORE processing
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Checking media uploads usage limit',
      metadata: { user_id: user.id }
    })
    const usageCheck = await checkUsageLimit(supabaseAdmin, user.id, 'media_uploads_per_month', 1)
    
    if (!usageCheck.allowed) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'Media uploads usage limit exceeded',
        metadata: {
          user_id: user.id,
          current_usage: usageCheck.currentUsage,
          limit: usageCheck.limit,
          plan: usageCheck.planName
        }
      })
      return createUsageLimitResponse(usageCheck, 'media uploads')
    }

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Usage limit check passed',
      metadata: {
        user_id: user.id,
        current_usage: usageCheck.currentUsage,
        limit: usageCheck.limit,
        plan: usageCheck.planName
      }
    })

    // Create client with user context for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    // Get the original image record
    const { data: originalImage, error: imageError } = await supabaseClient
      .from('photos')
      .select('*')
      .eq('id', imageId)
      .single()

    if (imageError || !originalImage) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Original image not found',
        metadata: { imageId, error: imageError }
      })
      return new Response(
        JSON.stringify({ error: 'Original image not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create a signed URL for the original image
    // Extract the file path from the public URL (remove the base URL part)
    const urlParts = originalImage.file_path.split('/storage/v1/object/public/media/')
    const filePath = urlParts[1] // This should be something like "photos/product-id/filename.jpg"
    
    if (!filePath) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Failed to extract file path from public URL',
        metadata: { imageId, file_path: originalImage.file_path }
      })
      return new Response(
        JSON.stringify({ error: 'Invalid file path format' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('media')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Failed to create signed URL',
        metadata: { imageId, error: signedUrlError }
      })
      return new Response(
        JSON.stringify({ error: 'Failed to create signed URL for image' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Created signed URL for original image',
      metadata: { imageId, signedUrl: signedUrlData.signedUrl }
    })

    // Call FAL AI to reframe the image
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Calling FAL AI reframe endpoint',
      metadata: { imageId, imageSize, renderingSpeed }
    })

    const reframeResult = await reframeImage(
      signedUrlData.signedUrl,
      imageSize,
      renderingSpeed,
      falApiKey
    )

    if (!reframeResult.images || reframeResult.images.length === 0) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'No reframed images returned from FAL AI'
      })
      return new Response(
        JSON.stringify({ error: 'Failed to generate reframed image' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const reframedImage = reframeResult.images[0]
    
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Successfully generated reframed image',
      metadata: {
        imageId,
        reframedUrl: reframedImage.url,
        fileSize: reframedImage.file_size,
        contentType: reframedImage.content_type
      }
    })

    // Download the reframed image
    const imageResponse = await fetch(reframedImage.url)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download reframed image: ${imageResponse.status}`)
    }

    const imageBlob = await imageResponse.blob()
    
    // Extract dimensions from the reframed image
    const dimensions = await getImageDimensions(imageBlob)
    
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Extracted dimensions from reframed image',
      metadata: {
        imageId,
        dimensions,
        file_size: imageBlob.size
      }
    })

    // Generate unique filename for the reframed image
    const fileExt = reframedImage.content_type?.split('/')[1] || 'png'
    const fileName = `photos/${originalImage.product_id}/reframed_${crypto.randomUUID()}.${fileExt}`

    // Upload to media bucket
    const { error: uploadError } = await supabaseClient.storage
      .from('media')
      .upload(fileName, imageBlob, {
        contentType: reframedImage.content_type,
        cacheControl: '3600'
      })

    if (uploadError) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Failed to upload reframed image to storage',
        metadata: { imageId, error: uploadError }
      })
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('media')
      .getPublicUrl(fileName)

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Uploaded reframed image to storage',
      metadata: { imageId, publicUrl }
    })

    // Create database record for the reframed image
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Creating database record with inherited description',
      metadata: { 
        imageId, 
        originalDescription: originalImage.description,
        hasDescription: !!originalImage.description
      }
    })

    const { data: photoData, error: dbError } = await supabaseClient
      .from('photos')
      .insert({
        product_id: originalImage.product_id,
        file_path: publicUrl,
        file_name: `reframed_${originalImage.file_name}`,
        user_id: user.id,
        description: originalImage.description,
        ai_analysis_id: reframeResult.request_id,
        dimensions: dimensions
      })
      .select()
      .single()

    if (dbError || !photoData) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Failed to create database record',
        metadata: { imageId, error: dbError }
      })
      // Clean up uploaded file
      await supabaseClient.storage.from('media').remove([fileName])
      throw dbError || new Error('Failed to create database record')
    }

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Created database record for reframed image',
      metadata: { imageId, newPhotoId: photoData.id }
    })

    // Increment usage AFTER successful creation
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Incrementing media uploads usage',
      metadata: { user_id: user.id }
    })
    const usageIncremented = await incrementUsage(supabaseAdmin, user.id, 'media_uploads_per_month', 1)
    
    if (!usageIncremented) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'Failed to increment usage metrics',
        metadata: { user_id: user.id }
      })
      // Don't fail the request, just log the warning
    }

    const totalTime = Math.round(performance.now() - startTime)
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Image reframing completed successfully',
      metadata: {
        original_image_id: imageId,
        new_image_id: photoData.id,
        image_size: imageSize,
        rendering_speed: renderingSpeed,
        total_time_ms: totalTime
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully reframed image',
        originalImage: {
          id: originalImage.id,
          file_path: originalImage.file_path
        },
        reframedImage: {
          id: photoData.id,
          file_path: publicUrl,
          dimensions: dimensions,
          file_size: reframedImage.file_size
        },
        metadata: {
          image_size: imageSize,
          rendering_speed: renderingSpeed,
          seed: reframeResult.seed
        },
        usage: {
          currentUsage: usageCheck.currentUsage + 1,
          limit: usageCheck.limit,
          planName: usageCheck.planName
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }
    )

  } catch (error) {
    const totalTime = Math.round(performance.now() - startTime)
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'Unexpected error in reframe-image function',
      duration: totalTime,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    })
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}) 