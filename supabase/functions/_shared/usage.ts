import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface UsageCheck {
  allowed: boolean
  currentUsage: number
  limit: number
  planName: string
  billingPeriodStart?: string
  billingPeriodEnd?: string
}

export interface PlanLimits {
  products: number
  team_members: number
  reels_per_month: number
  scripts_per_month: number
  media_uploads_per_month: number
}

// Helper function for structured logging
function logUsage(level: string, message: string, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    module: 'usage-tracking',
    ...details
  }
  console.log(JSON.stringify(logEntry))
}

/**
 * Get the user's organization and current subscription plan
 */
async function getUserOrganization(supabaseClient: any, userId: string): Promise<{
  organizationId: string,
  planLimits: PlanLimits,
  planName: string,
  billingPeriodStart?: string,
  billingPeriodEnd?: string
} | null> {
  try {
    // Get user's organization
    const { data: orgMember, error: orgError } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    if (orgError || !orgMember) {
      logUsage('error', 'User not found in any organization', { userId, error: orgError })
      return null
    }

    // Get organization subscription and plan details
    const { data: subscription, error: subError } = await supabaseClient
      .from('organization_subscriptions')
      .select(`
        current_period_start,
        current_period_end,
        pricing_plans:plan_id (
          name,
          features
        )
      `)
      .eq('organization_id', orgMember.organization_id)
      .eq('status', 'active')
      .single()

    if (subError || !subscription) {
      logUsage('warn', 'No active subscription found, using free plan limits', { 
        organizationId: orgMember.organization_id,
        error: subError
      })
      
      // Default free plan limits
      return {
        organizationId: orgMember.organization_id,
        planLimits: {
          products: 1,
          team_members: 1,
          reels_per_month: 5,
          scripts_per_month: 10,
          media_uploads_per_month: 50
        },
        planName: 'Free Plan',
      }
    }

    const planFeatures = subscription.pricing_plans.features as PlanLimits
    
    return {
      organizationId: orgMember.organization_id,
      planLimits: planFeatures,
      planName: subscription.pricing_plans.name,
      billingPeriodStart: subscription.current_period_start,
      billingPeriodEnd: subscription.current_period_end
    }
  } catch (error) {
    logUsage('error', 'Error getting user organization', { userId, error })
    return null
  }
}

/**
 * Get current usage for a specific metric
 */
async function getCurrentUsage(
  supabaseClient: any,
  organizationId: string,
  metricName: string,
  billingPeriodStart?: string
): Promise<number> {
  try {
    if (metricName.endsWith('_per_month') && billingPeriodStart) {
      // Monthly metric - count within current billing period
      const { data, error } = await supabaseClient
        .from('usage_metrics')
        .select('count')
        .eq('organization_id', organizationId)
        .eq('metric_name', metricName)
        .gte('period_start', billingPeriodStart)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      return data?.count || 0
    } else {
      // Total metric - get current count from the database directly
      let query = ''
      switch (metricName) {
        case 'products':
          query = 'SELECT COUNT(*) as count FROM products WHERE user_id IN (SELECT user_id FROM organization_members WHERE organization_id = $1)'
          break
        case 'team_members':
          query = 'SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1'
          break
        default:
          throw new Error(`Unknown total metric: ${metricName}`)
      }

      const { data, error } = await supabaseClient.rpc('exec_sql', {
        sql: query,
        params: [organizationId]
      })

      if (error) throw error
      return data?.[0]?.count || 0
    }
  } catch (error) {
    logUsage('error', 'Error getting current usage', { organizationId, metricName, error })
    return 0
  }
}

/**
 * Check if usage is within limits for a specific metric
 */
export async function checkUsageLimit(
  supabaseClient: any,
  userId: string,
  metricName: string,
  increment: number = 1
): Promise<UsageCheck> {
  try {
    logUsage('info', 'Checking usage limit', { userId, metricName, increment })

    const orgData = await getUserOrganization(supabaseClient, userId)
    if (!orgData) {
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        planName: 'Unknown',
      }
    }

    const { organizationId, planLimits, planName, billingPeriodStart, billingPeriodEnd } = orgData
    
    // Get the limit for this metric
    const limit = planLimits[metricName as keyof PlanLimits]
    if (limit === undefined) {
      logUsage('error', 'Unknown metric name', { metricName })
      return {
        allowed: false,
        currentUsage: 0,
        limit: 0,
        planName,
      }
    }

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        currentUsage: 0,
        limit: -1,
        planName,
        billingPeriodStart,
        billingPeriodEnd
      }
    }

    // Get current usage
    const currentUsage = await getCurrentUsage(supabaseClient, organizationId, metricName, billingPeriodStart)
    const wouldExceed = (currentUsage + increment) > limit

    logUsage('info', 'Usage check result', {
      userId,
      organizationId,
      metricName,
      currentUsage,
      limit,
      increment,
      wouldExceed,
      planName
    })

    return {
      allowed: !wouldExceed,
      currentUsage,
      limit,
      planName,
      billingPeriodStart,
      billingPeriodEnd
    }
  } catch (error) {
    logUsage('error', 'Error checking usage limit', { userId, metricName, error })
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      planName: 'Error',
    }
  }
}

/**
 * Increment usage for a specific metric
 */
export async function incrementUsage(
  supabaseClient: any,
  userId: string,
  metricName: string,
  increment: number = 1
): Promise<boolean> {
  try {
    logUsage('info', 'Incrementing usage', { userId, metricName, increment })

    const orgData = await getUserOrganization(supabaseClient, userId)
    if (!orgData) {
      logUsage('error', 'Cannot increment usage - no organization found', { userId })
      return false
    }

    const { organizationId, billingPeriodStart, billingPeriodEnd } = orgData

    // For monthly metrics, update usage_metrics table
    if (metricName.endsWith('_per_month')) {
      const periodStart = billingPeriodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const periodEnd = billingPeriodEnd || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()

      // Try to update existing record, or insert new one
      const { error: upsertError } = await supabaseClient
        .from('usage_metrics')
        .upsert({
          organization_id: organizationId,
          metric_name: metricName,
          count: increment,
          period_start: periodStart,
          period_end: periodEnd
        }, {
          onConflict: 'organization_id,metric_name,period_start',
          ignoreDuplicates: false
        })

      if (upsertError) {
        // If upsert failed, try to increment existing record
        const { error: updateError } = await supabaseClient.rpc('increment_usage', {
          org_id: organizationId,
          metric: metricName,
          amount: increment,
          period_start: periodStart
        })

        if (updateError) {
          logUsage('error', 'Error incrementing usage', { 
            organizationId, 
            metricName, 
            increment,
            upsertError,
            updateError 
          })
          return false
        }
      }
    }
    // For total metrics, we don't need to track in usage_metrics since we count directly from tables

    logUsage('info', 'Usage incremented successfully', { userId, organizationId, metricName, increment })
    return true
  } catch (error) {
    logUsage('error', 'Error incrementing usage', { userId, metricName, increment, error })
    return false
  }
}

/**
 * Create a standardized usage limit error response
 */
export function createUsageLimitResponse(usageCheck: UsageCheck, metricDisplayName: string) {
  const message = usageCheck.limit === -1 
    ? `Unlimited ${metricDisplayName} allowed`
    : `Usage limit exceeded: ${usageCheck.currentUsage}/${usageCheck.limit} ${metricDisplayName} used this month (${usageCheck.planName})`

  return new Response(
    JSON.stringify({
      error: 'Usage limit exceeded',
      message,
      details: {
        currentUsage: usageCheck.currentUsage,
        limit: usageCheck.limit,
        planName: usageCheck.planName,
        metricName: metricDisplayName
      }
    }),
    {
      status: 429, // Too Many Requests
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    }
  )
} 