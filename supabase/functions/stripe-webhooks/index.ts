/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14?target=denonext'

// Helper function for structured logging
function log(level: string, message: string, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...details
  }
  console.log(JSON.stringify(logEntry))
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey || !stripeWebhookSecret) {
      log('error', 'Missing environment variables', {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseServiceKey,
        hasStripeKey: !!stripeSecretKey,
        hasWebhookSecret: !!stripeWebhookSecret
      })
      
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Stripe with the secret key
    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    })

    // This is needed in order to use the Web Crypto API in Deno
    const cryptoProvider = Stripe.createSubtleCryptoProvider()

    // Create Supabase client with service role for operations that need to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get the request body as text for signature verification
    const body = await req.text()
    
    // Get the Stripe signature from headers
    const signature = req.headers.get('stripe-signature')
    
    if (!signature) {
      log('error', 'Missing Stripe signature')
      return new Response(
        JSON.stringify({ error: 'Missing stripe signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the webhook signature using the async method
    let event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        stripeWebhookSecret,
        undefined,
        cryptoProvider
      )
    } catch (err) {
      log('error', 'Invalid Stripe webhook', { 
        error: err instanceof Error ? err.message : 'Unknown error' 
      })
      
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the event to stripe_events table for audit trail
    try {
      await supabaseAdmin
        .from('stripe_events')
        .insert({
          stripe_event_id: event.id,
          type: event.type,
          created: new Date(event.created * 1000).toISOString(),
          data: event.data,
          livemode: event.livemode,
          processed_at: new Date().toISOString()
        })
    } catch (eventLogError) {
      log('error', 'Failed to log event to stripe_events', {
        eventId: event.id,
        eventType: event.type,
        error: eventLogError instanceof Error ? eventLogError.message : 'Unknown error'
      })
      // Continue processing even if event logging fails
    }

    // Process the event based on its type
    log('info', 'Processing Stripe webhook', { eventType: event.type, eventId: event.id })
    
    // Handle subscription-related events
    if (event.type.startsWith('customer.subscription')) {
      await handleSubscriptionEvent(event, supabaseAdmin)
    }
    // Handle invoice-related events
    else if (event.type.startsWith('invoice')) {
      await handleInvoiceEvent(event, supabaseAdmin)
    }
    // Handle checkout session completed event
    else if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event, supabaseAdmin)
    }
    // Log other events but don't process them
    else {
      log('info', 'Unhandled event type', { eventType: event.type, eventId: event.id })
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    log('error', 'Error processing webhook', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Handle subscription-related events
 */
async function handleSubscriptionEvent(event: any, supabaseAdmin: any) {
  const subscription = event.data.object
  
  log('info', 'Processing subscription event', { 
    eventType: event.type,
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status
  })

  try {
    // Get customer from Stripe to find organization_id
    const customer = await getCustomerFromStripe(subscription.customer)
    const organizationId = customer?.metadata?.organization_id
    
    if (!organizationId) {
      log('error', 'No organization ID in customer metadata', { 
        customerId: subscription.customer,
        metadata: customer?.metadata
      })
      return
    }

    // Determine the plan_id from the subscription items
    let planId = null
    if (subscription.items?.data?.[0]?.price?.id) {
      const { data: plan, error: planError } = await supabaseAdmin
        .from('pricing_plans')
        .select('id')
        .eq('stripe_price_id', subscription.items.data[0].price.id)
        .single()
      
      if (!planError && plan) {
        planId = plan.id
      }
    }

    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      organization_id: organizationId,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      stripe_customer_id: subscription.customer,
      plan_id: planId,
      updated_at: new Date().toISOString()
    }

    // Handle different subscription events
    switch (event.type) {
      case 'customer.subscription.created':
        // Insert new subscription using organization_subscriptions table
        await supabaseAdmin
          .from('organization_subscriptions')
          .insert({
            ...subscriptionData,
            created_at: new Date().toISOString()
          })
        
        log('info', 'Subscription created in database', { 
          organizationId,
          subscriptionId: subscription.id
        })
        break
      
      case 'customer.subscription.updated':
        // Update existing subscription using organization_subscriptions table
        await supabaseAdmin
          .from('organization_subscriptions')
          .upsert(subscriptionData, { 
            onConflict: 'stripe_subscription_id'
          })
        
        log('info', 'Subscription updated in database', { 
          organizationId,
          subscriptionId: subscription.id,
          status: subscription.status
        })
        break
      
      case 'customer.subscription.deleted':
        // Update subscription status to canceled
        await supabaseAdmin
          .from('organization_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id)
        
        log('info', 'Subscription cancelled in database', { 
          organizationId,
          subscriptionId: subscription.id
        })
        break
    }
    
    log('info', 'Subscription event processed successfully', { 
      eventType: event.type,
      organizationId,
      subscriptionId: subscription.id
    })
  } catch (error) {
    log('error', 'Error processing subscription event', {
      eventType: event.type,
      subscriptionId: subscription.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Handle invoice-related events - especially payment failures
 */
async function handleInvoiceEvent(event: any, supabaseAdmin: any) {
  const invoice = event.data.object
  
  log('info', 'Processing invoice event', { 
    eventType: event.type,
    invoiceId: invoice.id,
    customerId: invoice.customer,
    status: invoice.status,
    subscriptionId: invoice.subscription
  })

  try {
    // Get customer from Stripe to find organization_id
    const customer = await getCustomerFromStripe(invoice.customer)
    const organizationId = customer?.metadata?.organization_id
    
    if (!organizationId) {
      log('error', 'No organization ID in customer metadata', { 
        customerId: invoice.customer,
        metadata: customer?.metadata
      })
      return
    }

    // Handle critical invoice events that affect subscription status
    switch (event.type) {
      case 'invoice.payment_failed':
        log('warn', 'Invoice payment failed', {
          organizationId,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          attemptCount: invoice.attempt_count
        })
        
        // Update subscription status if this failure causes issues
        if (invoice.subscription) {
          await supabaseAdmin
            .from('organization_subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
        
      case 'invoice.payment_succeeded':
        log('info', 'Invoice payment succeeded', {
          organizationId,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription
        })
        
        // Ensure subscription is active if payment succeeded
        if (invoice.subscription) {
          await supabaseAdmin
            .from('organization_subscriptions')
            .update({
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
        
      case 'invoice.payment_action_required':
        log('warn', 'Invoice payment action required', {
          organizationId,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription
        })
        
        // Update subscription to indicate action required
        if (invoice.subscription) {
          await supabaseAdmin
            .from('organization_subscriptions')
            .update({
              status: 'incomplete',
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
    }

    log('info', 'Invoice event processed successfully', { 
      eventType: event.type,
      organizationId,
      invoiceId: invoice.id
    })
  } catch (error) {
    log('error', 'Error processing invoice event', {
      eventType: event.type,
      invoiceId: invoice.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Handle checkout session completed event
 */
async function handleCheckoutCompleted(event: any, supabaseAdmin: any) {
  const session = event.data.object
  
  log('info', 'Processing checkout.session.completed', { 
    sessionId: session.id,
    customerId: session.customer,
    mode: session.mode
  })

  try {
    // Process based on checkout mode
    if (session.mode === 'subscription') {
      // Subscription checkout - handled by subscription events
      log('info', 'Subscription checkout completed', {
        sessionId: session.id,
        subscriptionId: session.subscription
      })
    } else if (session.mode === 'payment') {
      // One-time payment
      log('info', 'One-time payment checkout completed', {
        sessionId: session.id,
        paymentIntentId: session.payment_intent
      })
      
      // Process one-time payment logic here if needed
    }
  } catch (error) {
    log('error', 'Error processing checkout completed event', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Helper function to get customer from Stripe API (replaces mock function)
 */
async function getCustomerFromStripe(customerId: string): Promise<any> {
  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY')
    }

    const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    if (!response.ok) {
      throw new Error(`Stripe API error: ${response.status}`)
    }

    const customer = await response.json()
    
    log('info', 'Retrieved customer from Stripe', {
      customerId,
      hasMetadata: !!customer.metadata,
      organizationId: customer.metadata?.organization_id
    })
    
    return customer
  } catch (error) {
    log('error', 'Error fetching customer from Stripe', {
      customerId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
} 