"use client"

import React from "react"
import Link from "next/link"
import { AlertTriangle, TrendingUp, X, Zap } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUsage, UsageData, UsageMetrics } from "@/hooks/useUsage"
import { useState } from "react"

interface UsageLimitAlertProps {
  metric?: keyof UsageMetrics
  onDismiss?: () => void
  showCompact?: boolean
  className?: string
}

interface AlertContent {
  title: string
  description: string
  variant: "default" | "destructive" | "warning"
  actionText: string
  actionVariant: "default" | "destructive" | "secondary"
}

const getAlertContent = (
  metric: keyof UsageMetrics, 
  data: UsageData, 
  isAtLimit: boolean, 
  isNearLimit: boolean
): AlertContent => {
  const metricLabels = {
    scripts_per_month: "AI scripts",
    reels_per_month: "reels",
    media_uploads_per_month: "media uploads",
    products: "products",
    team_members: "team members"
  }

  const label = metricLabels[metric] || metric

  if (isAtLimit) {
    return {
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} limit reached`,
      description: `You've used all ${data.limit} ${label} included in your ${data.planName}. Upgrade to continue using this feature.`,
      variant: "destructive",
      actionText: "Upgrade Now",
      actionVariant: "destructive"
    }
  }

  if (isNearLimit) {
    return {
      title: `Approaching ${label} limit`,
      description: `You've used ${data.currentUsage} of ${data.limit} ${label} in your ${data.planName}. Consider upgrading to avoid interruptions.`,
      variant: "warning",
      actionText: "Upgrade Plan",
      actionVariant: "secondary"
    }
  }

  return {
    title: "",
    description: "",
    variant: "default",
    actionText: "",
    actionVariant: "default"
  }
}

export function UsageLimitAlert({ 
  metric, 
  onDismiss, 
  showCompact = false, 
  className = "" 
}: UsageLimitAlertProps) {
  const { usage, isAtLimit, isNearLimit } = useUsage()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  // If a specific metric is provided, check only that one
  if (metric) {
    const data = usage[metric]
    if (!data) return null

    const atLimit = isAtLimit(metric)
    const nearLimit = isNearLimit(metric)

    if (!atLimit && !nearLimit) return null

    const alertContent = getAlertContent(metric, data, atLimit, nearLimit)

    return (
      <Alert 
        variant={alertContent.variant as any} 
        className={`${className} ${atLimit ? 'border-destructive bg-destructive/5' : 'border-orange-500 bg-orange-50'}`}
      >
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium">{alertContent.title}</div>
            {!showCompact && (
              <div className="text-sm mt-1">{alertContent.description}</div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Link href="/settings?tab=billing">
              <Button 
                size="sm" 
                variant={alertContent.actionVariant as any}
                className="gap-1"
              >
                <TrendingUp className="h-3 w-3" />
                {alertContent.actionText}
              </Button>
            </Link>
            {onDismiss && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setDismissed(true)
                  onDismiss()
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Check all metrics for limits
  const metrics = Object.entries(usage) as [keyof UsageMetrics, typeof usage[keyof UsageMetrics]][]
  const limitedMetrics = metrics.filter(([metric, data]) => data && isAtLimit(metric))
  const warningMetrics = metrics.filter(([metric, data]) => data && !isAtLimit(metric) && isNearLimit(metric))

  // Show the most critical alert first
  const criticalMetrics = limitedMetrics.length > 0 ? limitedMetrics : warningMetrics
  if (criticalMetrics.length === 0) return null

  const [firstMetric, firstData] = criticalMetrics[0]
  if (!firstData) return null
  
  const atLimit = isAtLimit(firstMetric)
  const alertContent = getAlertContent(firstMetric, firstData, atLimit, isNearLimit(firstMetric))

  if (showCompact) {
    return (
      <Alert 
        variant={alertContent.variant as any} 
        className={`${className} ${atLimit ? 'border-destructive bg-destructive/5' : 'border-orange-500 bg-orange-50'}`}
      >
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{alertContent.title}</span>
            {criticalMetrics.length > 1 && (
              <Badge variant="outline" className="text-xs">
                +{criticalMetrics.length - 1} more
              </Badge>
            )}
          </div>
          <Link href="/settings?tab=billing">
            <Button 
              size="sm" 
              variant={alertContent.actionVariant as any}
              className="gap-1"
            >
              <Zap className="h-3 w-3" />
              Upgrade
            </Button>
          </Link>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert 
      variant={alertContent.variant as any} 
      className={`${className} ${atLimit ? 'border-destructive bg-destructive/5' : 'border-orange-500 bg-orange-50'}`}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="font-medium mb-1">{alertContent.title}</div>
            <div className="text-sm mb-3">{alertContent.description}</div>
            
            {criticalMetrics.length > 1 && (
              <div className="text-sm">
                <span className="font-medium">Other limits approaching:</span>
                <ul className="mt-1 space-y-1">
                  {criticalMetrics.slice(1, 4).map(([metric, data]) => {
                    if (!data) return null
                    return (
                      <li key={metric} className="flex justify-between">
                        <span className="capitalize">{metric.replace(/_/g, ' ')}</span>
                        <span>{data.currentUsage}/{data.limit}</span>
                      </li>
                    )
                  })}
                  {criticalMetrics.length > 4 && (
                    <li className="text-muted-foreground">
                      +{criticalMetrics.length - 4} more limits
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <Link href="/settings?tab=billing">
              <Button 
                variant={alertContent.actionVariant as any}
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                {alertContent.actionText}
              </Button>
            </Link>
            {onDismiss && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setDismissed(true)
                  onDismiss()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}

// Specialized components for specific scenarios
export function ScriptLimitAlert(props: Omit<UsageLimitAlertProps, 'metric'>) {
  return <UsageLimitAlert {...props} metric="scripts_per_month" />
}

export function ReelLimitAlert(props: Omit<UsageLimitAlertProps, 'metric'>) {
  return <UsageLimitAlert {...props} metric="reels_per_month" />
}

export function MediaLimitAlert(props: Omit<UsageLimitAlertProps, 'metric'>) {
  return <UsageLimitAlert {...props} metric="media_uploads_per_month" />
}

export function ProductLimitAlert(props: Omit<UsageLimitAlertProps, 'metric'>) {
  return <UsageLimitAlert {...props} metric="products" />
} 