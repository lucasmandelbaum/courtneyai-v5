"use client"

import { ReactNode, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { TopNav } from "@/components/top-nav"
import { useAuth } from "@/hooks/useAuth"

const authRoutes = [
  "/sign-in",
  "/sign-up",
  "/forgot-password"
]

export function LayoutWithConditionalSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const router = useRouter()
  
  // Check if current path is an auth route
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  
  // Handle redirects based on auth state
  useEffect(() => {
    if (!isLoading) {
      // If user is logged in and on an auth page, redirect to home
      if (user && isAuthRoute) {
        router.push('/');
      }
    }
  }, [user, isAuthRoute, isLoading, router]);
  
  return (
    <div className="min-h-screen">
      {!isAuthRoute && <TopNav />}
      <main className="pt-16">{children}</main>
    </div>
  )
} 