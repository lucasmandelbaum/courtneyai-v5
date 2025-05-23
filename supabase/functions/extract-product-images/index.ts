import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'
import { checkUsageLimit, incrementUsage, createUsageLimitResponse } from '../_shared/usage.ts'
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts'

interface ExtractImagesRequest {
  productId: string
}

interface LogEvent {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  event: string
  duration?: number
  metadata?: Record<string, unknown>
}

function logEvent(event: LogEvent) {
  console.log(JSON.stringify(event))
}

async function analyzeImage(imageUrl: string, falApiKey: string) {
  const prompt = "Describe this product image in detail. Include, as applicable, the following:\n" +
    "1. What type of products are shown in the image\n" +
    "2. The contents of the background\n" +
    "3. Aesthetic traits of the image (colors, lighting, etc.)\n" +
    "4. Any other props or non-product items or people in the image\n\n" +
    "Keep your description concise (2-3 sentences) but detailed enough to understand what's shown in the image."

  const falResponse = await fetch('https://fal.run/fal-ai/any-llm/vision', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      prompt,
      image_url: imageUrl,
      system_prompt: "Provide a concise but detailed description of the product shown in the image."
    })
  })

  if (!falResponse.ok) {
    throw new Error(`Failed to analyze image: ${await falResponse.text()}`)
  }

  const falData = await falResponse.json()
  return {
    description: falData.output || falData.response || '',
    request_id: falData.requestId || crypto.randomUUID()
  }
}

serve(async (req) => {
  const startTime = performance.now()

  logEvent({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'Extract product images function called',
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

    if (!supabaseUrl || !supabaseKey) {
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
    const { productId } = body as ExtractImagesRequest

    if (!productId) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Missing product ID in request'
      })
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Starting image extraction',
      metadata: { productId, user_id: user.id }
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

    // Get product URL
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('url')
      .eq('id', productId)
      .single()

    if (productError || !product?.url) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Product not found',
        metadata: { productId }
      })
      throw new Error('Product not found')
    }

    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'fetching_product_page',
      metadata: { productId, url: product.url }
    })

    // Fetch the product page
    const response = await fetch(product.url)
    if (!response.ok) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Failed to fetch product page',
        metadata: { status: response.status, statusText: response.statusText }
      })
      throw new Error(`Failed to fetch product page: ${response.status}`)
    }
    const html = await response.text()

    // Parse HTML and extract image URLs
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    if (!doc) {
      logEvent({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'Failed to parse HTML'
      })
      throw new Error('Failed to parse HTML')
    }

    // Get all image URLs and resolve them
    const imageUrls = Array.from(doc.getElementsByTagName('img'))
      .map(img => {
        const element = img as Element
        const src = element.getAttribute('src')
        if (!src) return null
        try {
          return new URL(src, product.url).href
        } catch {
          return null
        }
      })
      .filter((url): url is string => {
        return url !== null && 
               !url.includes('logo') &&
               !url.includes('icon') &&
               !url.includes('button')
      })

    console.log('Found images:', imageUrls)

    // Process each image
    const processedImages = []
    let errorCount = 0
    let eligibleImages = []

    for (const imageUrl of imageUrls) {
      try {
        // Download image
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) continue

        // Get image data
        const contentType = imageResponse.headers.get('content-type')
        const fileExt = contentType?.split('/')[1] || 'jpg'
        const imageBlob = await imageResponse.blob()

        // Skip small images (likely icons)
        if (imageBlob.size < 10000) continue // 10KB minimum

        // Add to eligible images
        eligibleImages.push({
          url: imageUrl,
          blob: imageBlob,
          contentType,
          fileExt
        })
      } catch (error) {
        console.error('Error checking image:', error)
      }
    }

    // Take only first 10 eligible images
    eligibleImages = eligibleImages.slice(0, 10)
    console.log('Eligible images found:', eligibleImages.length)

    // Save eligible images
    for (const image of eligibleImages) {
      try {
        // Generate unique filename
        const fileName = `photos/${productId}/${crypto.randomUUID()}.${image.fileExt}`

        // Upload to media bucket
        const { error: uploadError } = await supabaseClient.storage
          .from('media')
          .upload(fileName, image.blob, {
            contentType: image.contentType,
            cacheControl: '3600'
          })

        if (uploadError) {
          errorCount++
          continue
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
          .from('media')
          .getPublicUrl(fileName)

        // Analyze the image
        let imageAnalysis = null
        try {
          imageAnalysis = await analyzeImage(publicUrl, Deno.env.get('FAL_API_KEY') || '')
          logEvent({
            timestamp: new Date().toISOString(),
            level: 'info',
            event: 'image_analyzed',
            metadata: {
              requestId: crypto.randomUUID(),
              url: publicUrl,
              description_length: imageAnalysis.description.length
            }
          })
        } catch (analysisError) {
          logEvent({
            timestamp: new Date().toISOString(),
            level: 'error',
            event: 'image_analysis_failed',
            metadata: {
              requestId: crypto.randomUUID(),
              url: publicUrl,
              error: analysisError instanceof Error ? analysisError.message : 'Unknown error'
            }
          })
        }

        // Create database record
        const { data: photoData, error: dbError } = await supabaseClient
          .from('photos')
          .insert({
            product_id: productId,
            file_path: publicUrl,
            file_name: `product_image_${processedImages.length + 1}.${image.fileExt}`,
            user_id: user.id,
            description: imageAnalysis?.description,
            ai_analysis_id: imageAnalysis?.request_id
          })
          .select()
          .single()

        if (dbError || !photoData) {
          errorCount++
          await supabaseClient.storage.from('media').remove([fileName])
          continue
        }

        processedImages.push({
          id: photoData.id,
          file_path: publicUrl,
          description: imageAnalysis?.description
        })

      } catch (error) {
        errorCount++
        console.error('Error processing image:', error)
      }
    }

    // Log final stats
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'processing_completed',
      duration: performance.now() - startTime,
      metadata: {
        requestId: crypto.randomUUID(),
        productId,
        totalFound: imageUrls.length,
        successfullyProcessed: processedImages.length,
        errors: errorCount,
        success: processedImages.length > 0
      }
    })

    // Increment usage AFTER successful creation
    logEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'Incrementing media uploads usage',
      metadata: { user_id: user.id }
    })
    const usageIncremented = await incrementUsage(supabaseAdmin, user.id, 'media_uploads_per_month', processedImages.length || 1)
    
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
      event: 'Image extraction completed successfully',
      metadata: {
        product_id: productId,
        total_images: processedImages.length,
        total_time_ms: totalTime
      }
    })

    return new Response(
      JSON.stringify({
        success: processedImages.length > 0,
        message: `Successfully processed ${processedImages.length} images`,
        processedImages,
        totalFound: imageUrls.length,
        errors: errorCount,
        usage: {
          currentUsage: usageCheck.currentUsage + (processedImages.length || 1),
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
      event: 'Unexpected error in extract-product-images function',
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