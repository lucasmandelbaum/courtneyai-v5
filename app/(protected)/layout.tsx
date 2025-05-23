"use client"

import { RouteGuard } from "@/components/route-guard"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RouteGuard>{children}</RouteGuard>
} 