import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'
import { checkUsageLimit, incrementUsage, createUsageLimitResponse } from '../_shared/usage.ts'

// Helper function for structured logging
function log(level: string, message: string, scriptId: string | null = null, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(scriptId && { script_id: scriptId }),
    ...details
  }
  
  // Ensure logs are flushed immediately
  console.log(JSON.stringify(logEntry))
}

serve(async (req) => {
  const startTime = performance.now()
  let currentStep = startTime

  // Add request logging
  log('info', 'Create script function called', null, {
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

    if (!supabaseUrl || !supabaseKey) {
      log('error', 'Missing required environment variables')
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
      log('error', 'No authorization token provided')
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
      log('error', 'Invalid authorization token', null, { error: userError })
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

    // Check usage limits BEFORE processing
    log('info', 'Checking scripts usage limit', null, { user_id: user.id })
    const usageCheck = await checkUsageLimit(supabaseAdmin, user.id, 'scripts_per_month', 1)
    
    if (!usageCheck.allowed) {
      log('warn', 'Scripts usage limit exceeded', null, {
        user_id: user.id,
        current_usage: usageCheck.currentUsage,
        limit: usageCheck.limit,
        plan: usageCheck.planName
      })
      return createUsageLimitResponse(usageCheck, 'AI scripts')
    }

    log('info', 'Usage limit check passed', null, {
      user_id: user.id,
      current_usage: usageCheck.currentUsage,
      limit: usageCheck.limit,
      plan: usageCheck.planName
    })

    // Create client with user context for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    log('debug', 'Supabase client created with user context')
    currentStep = logExecutionTime(currentStep, 'supabase_client_init')

    // Get the request body
    const body = await req.json()
    const { title, content, caption, productId, hookCategory, hookTemplate } = body
    log('debug', 'Request body parsed', null, { 
      title: title?.substring(0, 50) + '...',
      content_length: content?.length,
      caption_length: caption?.length,
      productId,
      hookCategory
    })

    // Basic validation
    if (!title || !content || !productId) {
      const missingFields = []
      if (!title) missingFields.push('title')
      if (!content) missingFields.push('content')
      if (!productId) missingFields.push('productId')
      
      log('error', 'Missing required fields', null, { missingFields })
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          missing: missingFields
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify user has access to the product
    log('debug', 'Verifying product access', null, { product_id: productId })
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      log('error', 'Product not found or unauthorized access', null, {
        product_id: productId,
        error: productError,
        user_id: user.id
      })
      return new Response(
        JSON.stringify({ error: 'Product not found or unauthorized access' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('info', 'Product access verified', null, {
      product_id: product.id,
      product_name: product.name
    })
    currentStep = logExecutionTime(currentStep, 'product_verification')

    // Save the script to Supabase
    log('debug', 'Saving script to database')
    const { data: scriptData, error: scriptError } = await supabaseClient
      .from('scripts')
      .insert([
        {
          product_id: productId,
          title: title,
          content: content,
          caption: caption || '',
          user_id: user.id,
          hook_category: hookCategory || null,
          hook_template: hookTemplate || null,
          metadata: {
            created_at: new Date().toISOString(),
            creation_type: 'manual',
            generation_time_ms: Math.round(performance.now() - startTime)
          }
        }
      ])
      .select()
      .single()

    if (scriptError) {
      log('error', 'Failed to save script', null, {
        error: scriptError,
        product_id: productId,
        user_id: user.id
      })
      return new Response(
        JSON.stringify({ error: 'Failed to save script' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Increment usage AFTER successful creation
    log('info', 'Incrementing scripts usage', null, { user_id: user.id })
    const usageIncremented = await incrementUsage(supabaseAdmin, user.id, 'scripts_per_month', 1)
    
    if (!usageIncremented) {
      log('warn', 'Failed to increment usage metrics', null, { user_id: user.id })
      // Don't fail the request, just log the warning
    }

    log('info', 'Script created and saved successfully', scriptData.id, {
      product_id: productId,
      total_time_ms: Math.round(performance.now() - startTime)
    })
    currentStep = logExecutionTime(currentStep, 'script_save')

    return new Response(
      JSON.stringify({
        script: scriptData,
        execution_time_ms: Math.round(performance.now() - startTime),
        usage: {
          currentUsage: usageCheck.currentUsage + 1,
          limit: usageCheck.limit,
          planName: usageCheck.planName
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    log('error', 'Unexpected error in create-script function', null, {
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