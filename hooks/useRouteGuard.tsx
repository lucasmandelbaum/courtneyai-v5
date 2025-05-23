"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"

// Routes that don't require authentication
const publicPaths = [
  "/sign-in", 
  "/sign-up", 
  "/forgot-password", 
  "/reset-password",
  "/update-password",
  "/auth/callback"
]

export function useRouteGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    // Check if the path is a public path that doesn't require auth
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

    // Authentication check function
    const authCheck = () => {
      if (!isLoading) {
        if (!user && !isPublicPath) {
          // Not logged in and trying to access protected route
          setAuthorized(false)
          console.log("Unauthorized access attempt - redirecting to login page")
          const redirectPath = `/sign-in?redirectTo=${encodeURIComponent(pathname)}`
          router.push(redirectPath)
        } else if (user && isPublicPath && !pathname.includes("update-password")) {
          // Logged in but trying to access auth routes (like login/signup), redirect to dashboard
          console.log("Already authenticated - redirecting to dashboard")
          router.push("/")
        } else {
          // Access is allowed
          setAuthorized(true)
        }
      }
    }

    authCheck()

    // Set up a route change event
    const preventAccess = () => setAuthorized(false)

    // Listen for changes to pathname and user
    return () => {
      // Clean up event listener
      setAuthorized(false)
    }
  }, [pathname, user, router, isLoading])

  return { authorized, isLoading }
} 