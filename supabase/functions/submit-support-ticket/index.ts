import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

// CORS headers for Edge Functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function for structured logging
function log(level: string, message: string, ticketId: string | null = null, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    function_name: 'submit-support-ticket',
    ...(ticketId && { ticket_id: ticketId }),
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

// Validation function for ticket data
function validateTicketData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Title is required')
  } else if (data.title.length > 200) {
    errors.push('Title must be less than 200 characters')
  }
  
  if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
    errors.push('Description is required')
  } else if (data.description.length > 5000) {
    errors.push('Description must be less than 5000 characters')
  }
  
  if (data.type && !['bug', 'feature_request', 'general_support'].includes(data.type)) {
    errors.push('Invalid ticket type')
  }
  
  if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
    errors.push('Invalid priority level')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

serve(async (req) => {
  const startTime = performance.now()
  let currentStep = startTime

  // Add request logging
  log('info', 'Submit support ticket function called', null, {
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey || !anonKey) {
      const missingVars = [
        !supabaseUrl && 'SUPABASE_URL',
        !supabaseKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !anonKey && 'SUPABASE_ANON_KEY'
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

    // Create user-context client for RLS (like generate-reel does)
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    log('debug', 'Supabase client created with user context')
    currentStep = logExecutionTime(currentStep, 'supabase_client_init')

    // Get the request body
    const body = await req.json()
    const { 
      title, 
      description, 
      type = 'general_support', 
      priority = 'medium',
      browserInfo,
      url: currentUrl
    } = body

    log('debug', 'Request body parsed', null, { 
      title: title?.substring(0, 50) + '...',
      description_length: description?.length,
      type,
      priority,
      has_browser_info: !!browserInfo,
      current_url: currentUrl
    })

    // Validate the ticket data
    const validation = validateTicketData({ title, description, type, priority })
    if (!validation.isValid) {
      log('error', 'Validation failed', null, { errors: validation.errors })
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed',
          details: validation.errors
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user agent from headers
    const userAgent = req.headers.get('User-Agent')

    // Prepare ticket data
    const ticketData = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      browser_info: browserInfo || null,
      user_agent: userAgent,
      url: currentUrl || null,
      metadata: {
        submitted_at: new Date().toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        referer: req.headers.get('referer') || null
      }
    }

    log('debug', 'Saving support ticket to database', null, {
      user_id: user.id,
      type,
      priority
    })

    // Save the support ticket to Supabase
    const { data: ticketResult, error: ticketError } = await supabaseClient
      .from('support_tickets')
      .insert([ticketData])
      .select()
      .single()

    if (ticketError) {
      log('error', 'Failed to save support ticket', null, {
        error: ticketError,
        user_id: user.id
      })
      return new Response(
        JSON.stringify({ error: 'Failed to save support ticket' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('info', 'Support ticket created successfully', ticketResult.id, {
      user_id: user.id,
      type,
      priority,
      total_time_ms: Math.round(performance.now() - startTime)
    })
    currentStep = logExecutionTime(currentStep, 'ticket_save')

    return new Response(
      JSON.stringify({
        ticket: {
          id: ticketResult.id,
          title: ticketResult.title,
          type: ticketResult.type,
          priority: ticketResult.priority,
          status: ticketResult.status,
          created_at: ticketResult.created_at
        },
        message: 'Support ticket submitted successfully',
        execution_time_ms: Math.round(performance.now() - startTime)
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    log('error', 'Unexpected error in submit-support-ticket function', null, {
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