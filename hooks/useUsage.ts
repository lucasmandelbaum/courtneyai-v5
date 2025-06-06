"use client"

import { useCallback, useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"

export interface UsageData {
  currentUsage: number
  limit: number
  planName: string
  metricName?: string
  billingPeriodStart?: string
  billingPeriodEnd?: string
}

export interface UsageMetrics {
  scripts_per_month: UsageData
  reels_per_month: UsageData
  media_uploads_per_month: UsageData
  products: UsageData
  team_members: UsageData
}

export interface SubscriptionData {
  id: string
  status: string
  planName: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  features: Record<string, number | boolean>
  organizationId: string
}

export function useUsage() {
  const [usage, setUsage] = useState<Partial<UsageMetrics>>({})
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createBrowserSupabaseClient()

      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) {
        router.push("/auth/login")
        return
      }

      // Get user's organization
      const { data: orgMember, error: orgError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single()

      if (orgError || !orgMember) {
        throw new Error('User not found in any organization')
      }

      const organizationId = orgMember.organization_id

      // Get organization subscription and plan details
      const { data: subscriptionData, error: subError } = await supabase
        .from('organization_subscriptions')
        .select(`
          *,
          pricing_plans!plan_id (
            name,
            features
          )
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .maybeSingle()

      console.log('🔍 useUsage Debug - Organization ID:', organizationId)
      console.log('🔍 useUsage Debug - Raw subscription query result:', { data: subscriptionData, error: subError })
      console.log('🔍 useUsage Debug - Subscription data structure:', JSON.stringify(subscriptionData, null, 2))
      
      if (subError) {
        console.error('Subscription fetch error:', subError)
        throw subError
      }

      // Set subscription data
      if (subscriptionData) {
        console.log('🔍 useUsage Debug - Found subscription data')
        console.log('🔍 useUsage Debug - Plan name:', subscriptionData.pricing_plans?.name)
        console.log('🔍 useUsage Debug - Plan features:', subscriptionData.pricing_plans?.features)
        console.log('🔍 useUsage Debug - Plan features type:', typeof subscriptionData.pricing_plans?.features)
        
        setSubscription({
          id: subscriptionData.id,
          status: subscriptionData.status,
          planName: subscriptionData.pricing_plans.name,
          currentPeriodStart: subscriptionData.current_period_start,
          currentPeriodEnd: subscriptionData.current_period_end,
          cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
          features: subscriptionData.pricing_plans.features as Record<string, number | boolean>,
          organizationId: organizationId
        })
      } else {
        console.log('🔍 useUsage Debug - No subscription data found, using free plan')
        // Default free plan
        setSubscription({
          id: 'free',
          status: 'active',
          planName: 'Free Plan',
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
          features: {
            products: 1,
            team_members: 1,
            reels_per_month: 1,
            scripts_per_month: 3,
            media_uploads_per_month: 20
          },
          organizationId: organizationId
        })
      }

      // Get current usage metrics for monthly items
      const { data: usageMetrics, error: usageError } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('period_start', subscriptionData?.current_period_start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

      console.log('🔍 useUsage Debug - Usage metrics:', usageMetrics)
      
      if (usageError) {
        console.error('Usage metrics error:', usageError)
      }

      // Get current counts for total metrics - FIXED: Now organization-based
      
      // First, get all user IDs in this organization
      const { data: orgMembers, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
      
      console.log('🔍 useUsage Debug - Organization members:', orgMembers)
      
      if (membersError) {
        console.error('Error fetching organization members:', membersError)
      }
      
      const userIds = orgMembers?.map(m => m.user_id) || []
      
      const [
        { count: productsCount },
        { count: teamMembersCount }
      ] = await Promise.all([
        // Products: count all products by users in this organization
        userIds.length > 0 
          ? supabase
              .from('products')
              .select('*', { count: 'exact', head: true })
              .in('user_id', userIds)
          : { count: 0 },
        // Team members: count all members in this organization
        supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
      ])

      console.log('🔍 useUsage Debug - Product count:', productsCount)
      console.log('🔍 useUsage Debug - Team members count:', teamMembersCount)

      // Build usage object using the latest subscriptionData (or defaults)
      const planFeatures: Record<string, number | boolean> = subscriptionData
        ? (subscriptionData.pricing_plans.features as Record<string, number | boolean>)
        : {
            products: 1,
            team_members: 1,
            reels_per_month: 1,
            scripts_per_month: 3,
            media_uploads_per_month: 20
          }

      console.log('🔍 useUsage Debug - Final plan features used:', planFeatures)
      
      const planName = subscriptionData ? subscriptionData.pricing_plans.name : 'Free Plan'
      const periodStart = subscriptionData?.current_period_start || new Date().toISOString()
      const periodEnd = subscriptionData?.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      console.log('🔍 useUsage Debug - Final plan name:', planName)
      console.log('🔍 useUsage Debug - Period start:', periodStart)
      console.log('🔍 useUsage Debug - Period end:', periodEnd)

      const usageData: Partial<UsageMetrics> = {
        products: {
          currentUsage: productsCount || 0,
          limit: planFeatures.products as number,
          planName
        },
        team_members: {
          currentUsage: teamMembersCount || 0,
          limit: planFeatures.team_members as number,
          planName
        }
      }

      // Add monthly metrics
      const monthlyMetrics = ['scripts_per_month', 'reels_per_month', 'media_uploads_per_month'] as const
      monthlyMetrics.forEach(metric => {
        const metricData = usageMetrics?.find(m => m.metric_name === metric)
        usageData[metric as keyof UsageMetrics] = {
          currentUsage: metricData?.count || 0,
          limit: planFeatures[metric] as number,
          planName,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd
        }
      })

      console.log('🔍 useUsage Debug - Final usage data:', usageData)

      setUsage(usageData)
    } catch (e) {
      console.error("Error fetching usage:", e)
      setError(e instanceof Error ? e : new Error("Failed to fetch usage"))
      if ((e as any)?.status === 401) {
        router.push("/auth/login")
      }
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const updateUsageFromResponse = useCallback((responseUsage: UsageData, metricName: keyof UsageMetrics) => {
    setUsage(prev => ({
      ...prev,
      [metricName]: responseUsage
    }))
  }, [])

  const getUsagePercentage = useCallback((metric: keyof UsageMetrics): number => {
    const data = usage[metric]
    if (!data || data.limit === -1) return 0
    return Math.min((data.currentUsage / data.limit) * 100, 100)
  }, [usage])

  const isAtLimit = useCallback((metric: keyof UsageMetrics): boolean => {
    const data = usage[metric]
    if (!data || data.limit === -1) return false
    return data.currentUsage >= data.limit
  }, [usage])

  const isNearLimit = useCallback((metric: keyof UsageMetrics, threshold: number = 80): boolean => {
    const percentage = getUsagePercentage(metric)
    return percentage >= threshold && percentage < 100
  }, [getUsagePercentage])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  return {
    usage,
    subscription,
    isLoading,
    error,
    updateUsageFromResponse,
    getUsagePercentage,
    isAtLimit,
    isNearLimit,
    refetch: fetchUsage
  }
} 