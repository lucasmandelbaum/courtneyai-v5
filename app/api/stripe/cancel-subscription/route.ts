import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId, cancelImmediately = false } = await request.json()

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = createRouteHandlerClient({ cookies })

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single()

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: 'User not found in any organization' },
        { status: 404 }
      )
    }

    // Check if user has permission to cancel subscription (owner or admin)
    if (!['owner', 'admin'].includes(orgMember.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to cancel subscription' },
        { status: 403 }
      )
    }

    // Verify that the subscription belongs to this organization
    const { data: subscription, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('stripe_subscription_id, status')
      .eq('organization_id', orgMember.organization_id)
      .eq('stripe_subscription_id', subscriptionId)
      .single()

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or access denied' },
        { status: 404 }
      )
    }

    // Cancel the subscription in Stripe
    let cancelledSubscription
    if (cancelImmediately) {
      // Cancel immediately
      cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId)
    } else {
      // Cancel at period end (default behavior)
      cancelledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      })
    }

    // Update our database (webhook will also handle this, but we update immediately for UI feedback)
    const updateData = cancelImmediately 
      ? { 
          status: 'canceled',
          updated_at: new Date().toISOString()
        }
      : {
          cancel_at_period_end: true,
          updated_at: new Date().toISOString()
        }

    await supabase
      .from('organization_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscriptionId)

    return NextResponse.json({
      success: true,
      subscription: {
        id: cancelledSubscription.id,
        status: cancelledSubscription.status,
        cancel_at_period_end: cancelledSubscription.cancel_at_period_end,
        canceled_at: cancelledSubscription.canceled_at,
        current_period_end: cancelledSubscription.current_period_end
      }
    })

  } catch (error) {
    console.error('Error cancelling subscription:', error)
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
} 