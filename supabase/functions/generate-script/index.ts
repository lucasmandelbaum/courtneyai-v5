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
    function_name: 'generate-script',
    ...(scriptId && { script_id: scriptId }),
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
  log('info', 'Generate script function called', null, {
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
    const { productId } = body
    log('debug', 'Request body parsed', null, { body })

    // Basic validation
    if (!productId) {
      log('error', 'Missing product ID in request')
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get product data
    log('debug', 'Fetching product data', null, { product_id: productId })
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('*')
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

    log('info', 'Product data fetched successfully', null, {
      product_id: product.id,
      product_name: product.name
    })
    currentStep = logExecutionTime(currentStep, 'product_fetch')

    // Get hooks
    log('debug', 'Fetching hooks')
    const { data: hooks, error: hooksError } = await supabaseClient
      .from('hooks')
      .select('*')

    if (hooksError || !hooks || hooks.length === 0) {
      log('error', 'Failed to fetch hooks', null, {
        error: hooksError,
        hooks_count: hooks?.length ?? 0
      })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch hooks' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('info', 'Hooks fetched successfully', null, { hooks_count: hooks.length })
    currentStep = logExecutionTime(currentStep, 'hooks_fetch')

    // Select a random hook
    const selectedHook = hooks[Math.floor(Math.random() * hooks.length)]
    log('info', 'Hook selected', null, {
      hook_id: selectedHook.id,
      hook_category: selectedHook.category
    })

    // Create prompts
    log('debug', 'Creating prompts')
    const systemPrompt = `You are a professional TikTok script writer specializing in creating engaging, high-converting scripts for product marketing.

For this task, you are writing a script for: ${product.name}

You are using the hook template: "${selectedHook.template}" from the ${selectedHook.category} category.

Make the script engaging, concise, and designed to stop the scroll and drive conversions. Focus EXCLUSIVELY on the specific product provided.

In addition to the script, you will also create a caption for the TikTok post that complements the video content.

Other important guidelines:
- DO NOT mention specific retailers like Target, Amazon, Walmart, etc.
- DO NOT include any sales promises like guarantees, warranties, delivery times, discounts, etc.
- DO NOT include any visual cues or camera directions - ONLY the script for the audio
- END the script with "swipe up to get yours" or a creative/funny variation that calls back to the script`

    const prompt = `I need you to write a TikTok script for the following product. Do not make up any information, only use the product description.

PRODUCT NAME: ${product.name}

PRODUCT DESCRIPTION:
${product.description}

SELECTED HOOK:
Category: ${selectedHook.category}
Template: ${selectedHook.template}
Example: ${selectedHook.example}

IMPORTANT INSTRUCTIONS:
- Create a script to be read aloud
- Maximum 40 words
- Make it conversational and engaging
- Also create a caption for the TikTok post (100-150 characters) with 3-5 relevant hashtags
- DO NOT mention specific retailers
- DO NOT include any visual cues or camera directions
- DO NOT offer any sales or discounts
- DO NOT mention inventory or other sales metrics
- DO NOT make up product features or benefits not mentioned in the description
- DO NOT use sales terminology like "limited time offer," "discount," "sale," etc.
- DO NOT include any sales promises
- ONLY include information that is factually supported by the product description
- END THE SCRIPT with "swipe up to get yours" or a creative variation
- Everything should be able to be read phonetically
- Use profuse punctuation to help with reading
- Do not include sound effects or noises

FORMAT YOUR RESPONSE AS FOLLOWS:

SCRIPT:
[Your script to be read aloud with thorough punctuation]

CAPTION:
[Your caption with hashtags, 100-150 characters]`

    log('debug', 'Prompts created', null, {
      system_prompt_length: systemPrompt.length,
      prompt_length: prompt.length
    })
    currentStep = logExecutionTime(currentStep, 'prompts_creation')

    // Configure fal.ai client
    const falKey = Deno.env.get('FAL_API_KEY')
    if (!falKey) {
      log('error', 'Missing FAL_API_KEY environment variable')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Call fal.ai API
    log('info', 'Calling fal.ai API', null, {
      model: 'deepseek/deepseek-r1'
    })

    const falResponse = await fetch('https://fal.run/fal-ai/any-llm', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        prompt: prompt,
        system_prompt: systemPrompt
      })
    })

    if (!falResponse.ok) {
      const responseText = await falResponse.text()
      log('error', 'Failed to generate script with fal.ai', null, {
        status: falResponse.status,
        status_text: falResponse.statusText,
        response_headers: Object.fromEntries(falResponse.headers.entries()),
        response_body: responseText
      })
      return new Response(
        JSON.stringify({ error: 'Failed to generate script', details: responseText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const falData = await falResponse.json()
    log('info', 'Received response from fal.ai')
    currentStep = logExecutionTime(currentStep, 'fal_ai_call')

    const generatedText = falData.output || falData.response || ''
    log('debug', 'Processing generated text', null, {
      text_length: generatedText.length
    })

    // Parse the script and caption
    let script = ''
    let caption = ''

    if (generatedText.includes('SCRIPT:') && generatedText.includes('CAPTION:')) {
      const parts = generatedText.split('CAPTION:')
      if (parts.length >= 2) {
        script = parts[0].split('SCRIPT:')[1].trim()
        caption = parts[1].trim()
        log('debug', 'Successfully parsed script and caption', null, {
          script_length: script.length,
          caption_length: caption.length
        })
      }
    } else {
      script = generatedText
      log('warn', 'Could not parse caption from response', null, {
        generated_text_length: generatedText.length
      })
    }

    // Save the script to Supabase
    log('debug', 'Saving script to database', null, {
      product_id: productId,
      script_length: script.length,
      caption_length: caption.length
    })

    const { data: scriptData, error: scriptError } = await supabaseClient
      .from('scripts')
      .insert([
        {
          product_id: productId,
          title: `Script for ${product.name}`,
          content: script,
          caption: caption,
          user_id: user.id,
          hook_category: selectedHook.category,
          hook_template: selectedHook.template,
          metadata: {
            hook_id: selectedHook.id,
            generated_at: new Date().toISOString(),
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

    log('info', 'Script generated and saved successfully', scriptData.id, {
      product_id: productId,
      total_time_ms: Math.round(performance.now() - startTime)
    })
    currentStep = logExecutionTime(currentStep, 'script_save')

    return new Response(
      JSON.stringify({
        script: scriptData,
        hook: selectedHook,
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
    log('error', 'Unexpected error in generate-script function', null, {
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