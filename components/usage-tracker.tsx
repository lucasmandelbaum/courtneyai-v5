"use client"

import React from "react"
import { Users, Image, Film, FileText, Zap } from "lucide-react"
import { Card, CardBody, Chip, Skeleton } from "@heroui/react"
import { useUsage, UsageMetrics } from "@/hooks/useUsage"

interface UsageTrackerProps {
  variant?: "full" | "compact" | "sidebar"
  showUpgradeButton?: boolean
}

const getMetricIcon = (metric: keyof UsageMetrics) => {
  switch (metric) {
    case 'products':
      return Zap
    case 'team_members':
      return Users
    case 'scripts_per_month':
      return FileText
    case 'reels_per_month':
      return Film
    case 'media_uploads_per_month':
      return Image
    default:
      return Zap
  }
}

const getMetricLabel = (metric: keyof UsageMetrics) => {
  switch (metric) {
    case 'products':
      return 'Products'
    case 'team_members':
      return 'Team Members'
    case 'scripts_per_month':
      return 'AI Scripts'
    case 'reels_per_month':
      return 'Reels'
    case 'media_uploads_per_month':
      return 'Media Uploads'
    default:
      return String(metric).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
  }
}

export function UsageTracker({ variant = "full" }: UsageTrackerProps) {
  const { usage, isLoading, isAtLimit, isNearLimit } = useUsage()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="h-20">
            <CardBody className="p-3 flex flex-row items-center gap-2">
              <Skeleton className="w-6 h-6" />
              <div className="space-y-2 flex-1">
                <Skeleton className="w-12 h-3" />
                <Skeleton className="w-8 h-4" />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    )
  }

  const metrics = Object.entries(usage) as [keyof UsageMetrics, typeof usage[keyof UsageMetrics]][]

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map(([metric, data]) => {
          if (!data) return null
          const Icon = getMetricIcon(metric)
          const atLimit = isAtLimit(metric)
          const nearLimit = isNearLimit(metric)
          
          return (
            <Card key={metric} className={`h-20 ${atLimit ? 'border-danger bg-danger-50' : ''}`}>
              <CardBody className="p-3 flex flex-row items-center gap-2">
                <div className="p-1.5 bg-gray-100 rounded-md flex-shrink-0">
                  <Icon className="w-3 h-3 text-gray-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 truncate">
                    {getMetricLabel(metric)}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {data.currentUsage}
                    </span>
                    {data.limit !== -1 && (
                      <span className="text-xs text-gray-400">/{data.limit}</span>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>
    )
  }

  if (variant === "full") {
    return (
      <div className="grid gap-4">
        {metrics.map(([metric, data]) => {
          if (!data) return null
          const Icon = getMetricIcon(metric)
          const atLimit = isAtLimit(metric)
          const nearLimit = isNearLimit(metric)
          const percentage = data.limit !== -1 ? (data.currentUsage / data.limit) * 100 : 0
          
          return (
            <Card key={metric} className={`${atLimit ? 'border-danger bg-danger-50' : ''}`}>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">{getMetricLabel(metric)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold">
                      {data.currentUsage}
                    </span>
                    {data.limit !== -1 && (
                      <span className="text-gray-500">/{data.limit}</span>
                    )}
                  </div>
                </div>
                
                {data.limit !== -1 && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        atLimit ? 'bg-red-500' : nearLimit ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                )}
                
                {atLimit && (
                  <div className="mt-2 text-sm text-red-600">
                    You've reached your limit for this metric
                  </div>
                )}
                
                {nearLimit && !atLimit && (
                  <div className="mt-2 text-sm text-yellow-600">
                    You're approaching your limit
                  </div>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>
    )
  }

  return null
} 