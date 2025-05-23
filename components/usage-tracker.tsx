"use client"

import React from "react"
import Link from "next/link"
import { TrendingUp, Users, Image, Film, FileText, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUsage, UsageMetrics } from "@/hooks/useUsage"
import { Skeleton } from "@/components/ui/skeleton"

interface UsageTrackerProps {
  variant?: "full" | "compact" | "sidebar"
  showUpgradeButton?: boolean
}

const getMetricIcon = (metric: keyof UsageMetrics) => {
  switch (metric) {
    case 'scripts_per_month':
      return FileText
    case 'reels_per_month':
      return Film
    case 'media_uploads_per_month':
      return Image
    case 'products':
      return Zap
    case 'team_members':
      return Users
    default:
      return TrendingUp
  }
}

const getMetricLabel = (metric: keyof UsageMetrics) => {
  switch (metric) {
    case 'scripts_per_month':
      return "AI Scripts"
    case 'reels_per_month':
      return "Reels"
    case 'media_uploads_per_month':
      return "Media Uploads"
    case 'products':
      return "Products"
    case 'team_members':
      return "Team Members"
    default:
      return metric
  }
}

const getMetricTimeframe = (metric: keyof UsageMetrics) => {
  return metric.includes('_per_month') ? 'this month' : 'total'
}

export function UsageTracker({ variant = "full", showUpgradeButton = true }: UsageTrackerProps) {
  const { usage, subscription, isLoading, getUsagePercentage, isAtLimit, isNearLimit } = useUsage()

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const metrics = Object.entries(usage) as [keyof UsageMetrics, typeof usage[keyof UsageMetrics]][]
  const hasLimits = metrics.some(([_, data]) => data && isAtLimit(_ as keyof UsageMetrics))
  const hasWarnings = metrics.some(([_, data]) => data && isNearLimit(_ as keyof UsageMetrics))

  if (variant === "sidebar") {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            {subscription && (
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                {subscription.planName}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.slice(0, 3).map(([metric, data]) => {
            if (!data) return null
            const Icon = getMetricIcon(metric)
            const percentage = getUsagePercentage(metric)
            const atLimit = isAtLimit(metric)
            const nearLimit = isNearLimit(metric)
            
            return (
              <div key={metric} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    <span className="truncate">{getMetricLabel(metric)}</span>
                  </div>
                  <span className={`text-xs ${atLimit ? 'text-destructive' : nearLimit ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {data.limit === -1 ? 'Unlimited' : `${data.currentUsage}/${data.limit}`}
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className={`h-1 ${atLimit ? '[&>div]:bg-destructive' : nearLimit ? '[&>div]:bg-orange-500' : ''}`}
                />
              </div>
            )
          })}
          
          {showUpgradeButton && (hasLimits || hasWarnings) && (
            <Link href="/settings?tab=billing" className="block">
              <Button size="sm" className="w-full text-xs" variant={hasLimits ? "destructive" : "secondary"}>
                {hasLimits ? "Upgrade Required" : "Upgrade Plan"}
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metrics.map(([metric, data]) => {
          if (!data) return null
          const Icon = getMetricIcon(metric)
          const percentage = getUsagePercentage(metric)
          const atLimit = isAtLimit(metric)
          const nearLimit = isNearLimit(metric)
          
          return (
            <Card key={metric} className={`${atLimit ? 'border-destructive' : nearLimit ? 'border-orange-500' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium truncate">{getMetricLabel(metric)}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={atLimit ? 'text-destructive' : nearLimit ? 'text-orange-600' : 'text-muted-foreground'}>
                      {data.limit === -1 ? 'Unlimited' : `${data.currentUsage}/${data.limit}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {getMetricTimeframe(metric)}
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className={`h-2 ${atLimit ? '[&>div]:bg-destructive' : nearLimit ? '[&>div]:bg-orange-500' : ''}`}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // Full variant
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Usage & Limits
          </CardTitle>
          {subscription && (
            <div className="flex items-center gap-2">
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                {subscription.planName}
              </Badge>
              {subscription.cancelAtPeriodEnd && (
                <Badge variant="outline" className="text-orange-600">
                  Cancelling
                </Badge>
              )}
            </div>
          )}
        </div>
        {subscription && (
          <p className="text-sm text-muted-foreground">
            Billing period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          {metrics.map(([metric, data]) => {
            if (!data) return null
            const Icon = getMetricIcon(metric)
            const percentage = getUsagePercentage(metric)
            const atLimit = isAtLimit(metric)
            const nearLimit = isNearLimit(metric)
            
            return (
              <div key={metric} className={`p-4 rounded-lg border ${atLimit ? 'border-destructive bg-destructive/5' : nearLimit ? 'border-orange-500 bg-orange-50' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <div>
                      <h4 className="font-medium">{getMetricLabel(metric)}</h4>
                      <p className="text-sm text-muted-foreground">{getMetricTimeframe(metric)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${atLimit ? 'text-destructive' : nearLimit ? 'text-orange-600' : ''}`}>
                      {data.limit === -1 ? 'Unlimited' : `${data.currentUsage}/${data.limit}`}
                    </div>
                    {data.limit !== -1 && (
                      <div className="text-sm text-muted-foreground">
                        {percentage.toFixed(0)}% used
                      </div>
                    )}
                  </div>
                </div>
                
                {data.limit !== -1 && (
                  <div className="space-y-1">
                    <Progress 
                      value={percentage} 
                      className={`h-2 ${atLimit ? '[&>div]:bg-destructive' : nearLimit ? '[&>div]:bg-orange-500' : ''}`}
                    />
                    {atLimit && (
                      <p className="text-sm text-destructive font-medium">
                        Limit reached - upgrade to continue using this feature
                      </p>
                    )}
                    {!atLimit && nearLimit && (
                      <p className="text-sm text-orange-600">
                        Approaching limit - consider upgrading your plan
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {showUpgradeButton && (hasLimits || hasWarnings) && (
          <div className="flex justify-center pt-4 border-t">
            <Link href="/settings?tab=billing">
              <Button 
                size="lg" 
                variant={hasLimits ? "destructive" : "default"}
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                {hasLimits ? "Upgrade Required" : "Upgrade Plan"}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 