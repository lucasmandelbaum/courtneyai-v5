import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'

interface ImageDimensions {
  width: number
  height: number
  aspect_ratio: number
}

// Helper function for structured logging
function log(level: string, message: string, imageId: string | null = null, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    function_name: 'analyze-image',
    ...(imageId && { image_id: imageId }),
    ...details
  }
  console.log(JSON.stringify(logEntry))
}

// Helper function to measure execution time
function logExecutionTime(startTime: number, step: string) {
  const endTime = performance.now()
  const duration = endTime - startTime
  log('debug', `Step timing: ${step}`, null, {
    step,
    duration_ms: Math.round(duration),
    start_time: new Date(Date.now() - duration).toISOString(),
    end_time: new Date().toISOString()
  })
  return endTime
}

async function getImageDimensions(imageUrl: string): Promise<ImageDimensions | null> {
  try {
    log('info', 'Fetching image for dimension analysis', null, { image_url: imageUrl })
    
    // Fetch the image
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      log('error', 'Failed to fetch image for dimension analysis', null, {
        status: imageResponse.status,
        statusText: imageResponse.statusText
      })
      return null
    }

    const imageBlob = await imageResponse.blob()
    const arrayBuffer = await imageBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    log('debug', 'Image fetched successfully', null, {
      size: imageBlob.size,
      type: imageBlob.type
    })
    
    // For JPEG images, look for SOF (Start of Frame) markers
    if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
      // JPEG format
      for (let i = 2; i < uint8Array.length - 8; i++) {
        if (uint8Array[i] === 0xFF && (uint8Array[i + 1] === 0xC0 || uint8Array[i + 1] === 0xC2)) {
          const height = (uint8Array[i + 5] << 8) | uint8Array[i + 6]
          const width = (uint8Array[i + 7] << 8) | uint8Array[i + 8]
          const dimensions = {
            width,
            height,
            aspect_ratio: Math.round((width / height) * 100) / 100
          }
          log('info', 'JPEG dimensions extracted', null, dimensions)
          return dimensions
        }
      }
    }
    
    // For PNG images
    if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
      // PNG format - IHDR chunk starts at byte 16
      const width = (uint8Array[16] << 24) | (uint8Array[17] << 16) | (uint8Array[18] << 8) | uint8Array[19]
      const height = (uint8Array[20] << 24) | (uint8Array[21] << 16) | (uint8Array[22] << 8) | uint8Array[23]
      const dimensions = {
        width,
        height,
        aspect_ratio: Math.round((width / height) * 100) / 100
      }
      log('info', 'PNG dimensions extracted', null, dimensions)
      return dimensions
    }
    
    // For WebP images
    if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
        uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
      // WebP format - look for VP8 or VP8L chunks
      if (uint8Array[12] === 0x56 && uint8Array[13] === 0x50 && uint8Array[14] === 0x38) {
        if (uint8Array[15] === 0x20) {
          // VP8
          const width = ((uint8Array[26] | (uint8Array[27] << 8)) & 0x3fff) + 1
          const height = ((uint8Array[28] | (uint8Array[29] << 8)) & 0x3fff) + 1
          const dimensions = {
            width,
            height,
            aspect_ratio: Math.round((width / height) * 100) / 100
          }
          log('info', 'WebP VP8 dimensions extracted', null, dimensions)
          return dimensions
        } else if (uint8Array[15] === 0x4C) {
          // VP8L
          const bits = uint8Array[21] | (uint8Array[22] << 8) | (uint8Array[23] << 16) | (uint8Array[24] << 24)
          const width = (bits & 0x3FFF) + 1
          const height = ((bits >> 14) & 0x3FFF) + 1
          const dimensions = {
            width,
            height,
            aspect_ratio: Math.round((width / height) * 100) / 100
          }
          log('info', 'WebP VP8L dimensions extracted', null, dimensions)
          return dimensions
        }
      }
    }
    
    log('warn', 'Unsupported image format for dimension extraction', null, {
      first_bytes: Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    })
    return null
  } catch (error) {
    log('error', 'Error extracting image dimensions', null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return null
  }
}

serve(async (req) => {
  const startTime = performance.now()
  let currentStep = startTime

  // Add request logging
  log('info', 'Analyze image function called', null, {
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    url: req.url
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
      const missingVars = [
        !supabaseUrl && 'SUPABASE_URL',
        !supabaseKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !falApiKey && 'FAL_API_KEY'
      ].filter(Boolean)
      
      log('error', 'Missing required environment variables', null, {
        missing_variables: missingVars
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('debug', 'Environment variables loaded successfully')
    currentStep = logExecutionTime(currentStep, 'env_vars_load')

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
    log('debug', 'Supabase admin client created')
    currentStep = logExecutionTime(currentStep, 'supabase_admin_init')

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      log('error', 'No authorization token provided', null, {
        auth_header: authHeader
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
      log('error', 'Invalid authorization token', null, {
        error: userError,
        token_present: !!token
      })
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('info', 'User authenticated successfully', null, {
      user_id: user.id,
      email: user.email
    })
    currentStep = logExecutionTime(currentStep, 'user_auth')

    // Create client with user context for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    log('debug', 'Supabase client created with user context')
    currentStep = logExecutionTime(currentStep, 'supabase_client_init')

    // Get the request body
    const { image_url, product_id } = await req.json()

    // Basic validation
    if (!image_url || !product_id) {
      log('error', 'Missing required parameters')
      return new Response(
        JSON.stringify({ error: 'Image URL and Product ID are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Start both AI analysis and dimension extraction in parallel
    log('info', 'Starting parallel processing: AI analysis and dimension extraction', null, {
      model: 'anthropic/claude-3.5-sonnet',
      image_url
    })

    const prompt = "Describe this product image in detail. Include, as applicable, the following:\n" +
      "1. What type of products are shown in the image\n" +
      "2. The contents of the background\n" +
      "3. Aesthetic traits of the image (colors, lighting, etc.)\n" +
      "4. Any other props or non-product items or people in the image\n\n" +
      "Keep your description concise (2-3 sentences) but detailed enough to understand what's shown in the image."

    // Execute AI analysis and dimension extraction in parallel
    const [falResponse, dimensions] = await Promise.all([
      fetch('https://fal.run/fal-ai/any-llm/vision', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          prompt,
          image_url,
          system_prompt: "Provide a concise but detailed description of the product shown in the image."
        })
      }),
      getImageDimensions(image_url)
    ])

    if (!falResponse.ok) {
      const responseText = await falResponse.text()
      log('error', 'Failed to analyze image with fal.ai', null, {
        status: falResponse.status,
        status_text: falResponse.statusText,
        response_headers: Object.fromEntries(falResponse.headers.entries()),
        response_body: responseText
      })
      return new Response(
        JSON.stringify({ error: 'Failed to analyze image', details: responseText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const falData = await falResponse.json()
    log('info', 'Received response from fal.ai and completed dimension extraction')
    currentStep = logExecutionTime(currentStep, 'parallel_processing')

    const imageDescription = falData.output || falData.response || ''
    log('debug', 'Processing analysis results', null, {
      description_length: imageDescription.length,
      dimensions_extracted: !!dimensions
    })

    // Return the analysis result with dimensions
    return new Response(
      JSON.stringify({
        description: imageDescription,
        request_id: falData.requestId,
        dimensions,
        execution_time_ms: Math.round(performance.now() - startTime)
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    log('error', 'Unexpected error in analyze-image function', null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      total_time_ms: Math.round(performance.now() - startTime)
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