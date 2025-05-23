import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'

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

    // Call fal.ai API for image analysis
    log('info', 'Calling fal.ai API for image analysis', null, {
      model: 'anthropic/claude-3.5-sonnet'
    })

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
        image_url,
        system_prompt: "Provide a concise but detailed description of the product shown in the image."
      })
    })

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
    log('info', 'Received response from fal.ai')
    currentStep = logExecutionTime(currentStep, 'fal_ai_call')

    const imageDescription = falData.output || falData.response || ''
    log('debug', 'Processing image analysis', null, {
      description_length: imageDescription.length
    })

    // Return the analysis result
    return new Response(
      JSON.stringify({
        description: imageDescription,
        request_id: falData.requestId,
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