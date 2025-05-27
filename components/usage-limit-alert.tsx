"use client"

import React from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { Card, CardBody, Button } from "@heroui/react"
import { useUsage, UsageData, UsageMetrics } from "@/hooks/useUsage"
import { useState } from "react"

interface UsageLimitAlertProps {
  metric?: keyof UsageMetrics
  onDismiss?: () => void
  className?: string
}

interface AlertContent {
  title: string
  description: string
  actionText: string
}

const metricLabels: Record<keyof UsageMetrics, string> = {
  scripts_per_month: "AI scripts",
  reels_per_month: "Reels",
  media_uploads_per_month: "Media uploads",
  products: "Products",
  team_members: "Team Members",
};

const getAlertContent = (
  metric: keyof UsageMetrics, 
  data: UsageData, 
  isAtLimit: boolean, 
  isNearLimit: boolean
): AlertContent => {
  const label = metricLabels[metric] || metric.replace(/_/g, " ");

  if (isAtLimit) {
    return {
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} limit reached`,
      description: `You've used all ${data.limit} ${label.toLowerCase()} included in your ${data.planName} Plan. Upgrade to continue using this feature.`,
      actionText: "Upgrade Now",
    }
  }

  // isNearLimit is implicitly true if we reach here and it's not isAtLimit, 
  // but the main component logic already filters for this.
  return {
    title: `Approaching ${label.toLowerCase()} limit`,
    description: `You've used ${data.currentUsage} of ${data.limit} ${label.toLowerCase()} in your ${data.planName} Plan. Consider upgrading.`,
    actionText: "Upgrade Plan",
  }
}

export function UsageLimitAlert({ 
  metric, 
  onDismiss, 
  className = "" 
}: UsageLimitAlertProps) {
  const { usage, isAtLimit, isNearLimit } = useUsage()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  // Helper function to check if we should hide team_members alert for free plan
  const shouldHideTeamMembersAlert = (metric: keyof UsageMetrics, data: UsageData): boolean => {
    return metric === 'team_members' && 
           data.planName === 'Free Plan' && 
           data.limit === 1 && 
           data.currentUsage === 1
  }

  let metricsToShow: [keyof UsageMetrics, UsageData][] = []
  let mainAlertMetric: keyof UsageMetrics | null = null
  let mainAlertData: UsageData | null = null
  let mainAlertIsAtLimit = false

  if (metric) {
    const data = usage[metric]
    if (data && (isAtLimit(metric) || isNearLimit(metric))) {
      // Don't show team_members alert for free plan with 1 user
      if (shouldHideTeamMembersAlert(metric, data)) {
        return null
      }
      mainAlertMetric = metric
      mainAlertData = data
      mainAlertIsAtLimit = isAtLimit(metric)
    }
  } else {
    const limitedMetrics = (Object.entries(usage) as [keyof UsageMetrics, UsageData][])
      .filter(([m, d]) => d && isAtLimit(m) && !shouldHideTeamMembersAlert(m, d))
    const warningMetrics = (Object.entries(usage) as [keyof UsageMetrics, UsageData][])
      .filter(([m, d]) => d && !isAtLimit(m) && isNearLimit(m) && !shouldHideTeamMembersAlert(m, d))

    if (limitedMetrics.length > 0) {
      [mainAlertMetric, mainAlertData] = limitedMetrics[0]
      mainAlertIsAtLimit = true
      metricsToShow = [...limitedMetrics.slice(1), ...warningMetrics]
    } else if (warningMetrics.length > 0) {
      [mainAlertMetric, mainAlertData] = warningMetrics[0]
      mainAlertIsAtLimit = false
      metricsToShow = warningMetrics.slice(1)
    }
  }

  if (!mainAlertMetric || !mainAlertData) return null;

  // Determine if the main alert is for a near limit scenario (only if not at limit)
  const mainAlertIsNearLimit = !mainAlertIsAtLimit && isNearLimit(mainAlertMetric);
  const alertContent = getAlertContent(mainAlertMetric, mainAlertData, mainAlertIsAtLimit, mainAlertIsNearLimit);
  
  const otherApproachingLimits = metricsToShow
    .filter(([m, d]) => m !== mainAlertMetric && d && isNearLimit(m) && !isAtLimit(m))
    .slice(0, 1) // Show max 1 other approaching limits to match the image more closely

  const cardBgColor = mainAlertIsAtLimit ? "bg-pink-50" : "bg-amber-50"
  const buttonColor = mainAlertIsAtLimit ? "danger" : "warning"

  return (
    <Card 
      className={`${className} w-full rounded-lg ${cardBgColor} overflow-hidden`}
    >
      <CardBody className="p-4 sm:p-5 relative"> {/* Added relative positioning */}
        {/* Dismiss button positioned absolutely in top-right */}
        {onDismiss && (
          <Button 
            isIconOnly 
            variant="light" 
            size="sm"
            onClick={() => {
              setDismissed(true)
              onDismiss()
            }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        
        <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 ${onDismiss ? 'pr-8' : ''}`}>
          {/* Left section: Texts */}
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-1 min-w-0"> {/* Added min-w-0 for text truncation if needed */}
              <h4 className="text-base font-semibold leading-tight text-gray-800 truncate">{alertContent.title}</h4>
              <p className="text-sm text-gray-600 mt-0.5">{alertContent.description}</p>
              
              {otherApproachingLimits.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-medium text-gray-500">Other limits approaching:</p>
                  <ul className="mt-0.5 space-y-0">
                    {otherApproachingLimits.map(([key, data]) => {
                      const label = metricLabels[key] || key.replace(/_/g, " ");
                      return (
                        <li key={key} className="flex justify-between items-center text-xs text-gray-500">
                          <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
                          <span className="font-semibold text-gray-700">{data.currentUsage}/{data.limit}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right section: Action Button */}
          <div className="flex flex-shrink-0 w-full sm:w-auto mt-3 sm:mt-0">
            <Link href="/settings?tab=subscription" className="flex-grow sm:flex-grow-0">
              <Button 
                color={buttonColor}
                variant="solid" 
                size="md" 
                radius="md"
                className="w-full font-medium"
              >
                {alertContent.actionText}
              </Button>
            </Link>
          </div>
        </div>
      </CardBody>
    </Card>
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

export function TeamMemberLimitAlert(props: Omit<UsageLimitAlertProps, 'metric'>) {
  const { usage } = useUsage()
  const teamMembersData = usage.team_members
  
  // Don't show team_members alert for free plan with 1 user (expected usage)
  if (teamMembersData && 
      teamMembersData.planName === 'Free Plan' && 
      teamMembersData.limit === 1 && 
      teamMembersData.currentUsage === 1) {
    return null
  }
  
  return <UsageLimitAlert {...props} metric="team_members" />
} 