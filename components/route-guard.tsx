"use client"

import { ReactNode } from "react"
import { useRouteGuard } from "@/hooks/useRouteGuard"
import { Icons } from "@/components/ui/icons"

interface RouteGuardProps {
  children: ReactNode
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { authorized, isLoading } = useRouteGuard()

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authorized, don't show the protected content
  // (the hook will handle redirection)
  if (!authorized) {
    return null
  }

  // If authorized, render the children
  return <>{children}</>
} 