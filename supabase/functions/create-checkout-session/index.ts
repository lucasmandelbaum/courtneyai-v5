import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function for structured logging
function log(level: string, message: string, sessionId: string | null = null, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    function: 'create-checkout-session',
    ...(sessionId && { session_id: sessionId }),
    ...details
  }
  console.log(JSON.stringify(logEntry))
}

Deno.serve(async (req: Request) => {
  const startTime = performance.now()

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      log('error', 'No authorization token provided', null)
      return new Response(
        JSON.stringify({ error: 'No authorization token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    log('info', 'Creating checkout session', null)
    const { priceId, organizationId } = await req.json()

    if (!priceId || !organizationId) {
      log('error', 'Missing required parameters', null, { priceId, organizationId })
      throw new Error('Price ID and Organization ID are required')
    }

    // Get environment variables
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const appUrl = Deno.env.get('APP_URL')

    // Validate all required environment variables
    if (!stripeKey || !supabaseUrl || !supabaseServiceRoleKey) {
      log('error', 'Missing environment variables', null)
      throw new Error('Missing environment variables')
    }

    // Ensure APP_URL is set and valid
    if (!appUrl || !appUrl.startsWith('http')) {
      log('error', 'Invalid APP_URL configuration', null, { appUrl })
      throw new Error('Invalid APP_URL configuration')
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Create Supabase admin client to verify the token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Verify the user token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      log('error', 'Invalid authorization token', null, { error: userError })
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with user context
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    // Get organization details
    log('info', 'Fetching organization details', null, { organizationId })
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      log('error', 'Organization not found', null, { error: orgError })
      throw new Error('Organization not found')
    }

    let customerId = org.stripe_customer_id

    // If no Stripe customer exists, create one
    if (!customerId) {
      log('info', 'Creating new Stripe customer', null, { organizationId: org.id })
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          organization_id: org.id
        }
      })
      customerId = customer.id

      // Save the customer ID
      log('info', 'Updating organization with Stripe customer ID', null, { 
        organizationId: org.id,
        customerId 
      })
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id)

      if (updateError) {
        log('error', 'Failed to update organization', null, { error: updateError })
        throw new Error('Failed to update organization with Stripe customer ID')
      }
    }

    // Create a checkout session
    log('info', 'Creating Stripe checkout session', null, {
      customerId,
      priceId,
      organizationId: org.id
    })
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${appUrl}/organization/${organizationId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/organizations/${organizationId}`,
      subscription_data: {
        metadata: {
          organization_id: org.id
        }
      }
    })

    log('info', 'Checkout session created successfully', session.id, {
      url: session.url,
      executionTime: Math.round(performance.now() - startTime)
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    log('error', 'Error creating checkout session', null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Math.round(performance.now() - startTime)
    })

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
