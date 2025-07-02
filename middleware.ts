import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

// Array of routes that don't require organization membership
const noOrgRoutes = [
  '/organization-setup',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/auth/callback',
  '/update-password',
]

// API routes should handle their own authentication
const isApiRoute = (pathname: string) => pathname.startsWith('/api/')

export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next()
    const url = new URL(req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const isNoOrgRoute = noOrgRoutes.some(route => url.pathname.startsWith(route))

    // Skip auth checking for API routes
    if (isApiRoute(url.pathname)) {
      return res
    }

    // Create supabase client with middleware helper
    const supabase = createMiddlewareClient<Database>({ req, res })

    // Only try to refresh session if we don't already have one
    // This prevents excessive token refresh calls
    let session = null
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        // Only redirect on critical errors, not rate limiting
        if (!sessionError.message?.includes('rate limit') && !sessionError.message?.includes('429')) {
          return NextResponse.redirect(new URL('/sign-in', baseUrl))
        }
      }
      
      session = currentSession
    } catch (error: any) {
      console.error('Auth check failed:', error)
      // If we're rate limited, allow the request to continue
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        console.log('Rate limited, allowing request to continue')
        return res
      }
    }

    // If not signed in and not on an auth route, redirect to sign in
    if (!session && !isNoOrgRoute) {
      console.log('No session, redirecting to sign-in')
      return NextResponse.redirect(new URL('/sign-in', baseUrl))
    }

    // If signed in but no organization membership, redirect to organization setup
    if (session && !isNoOrgRoute) {
      console.log('Checking organization membership for user:', session.user.id)
      
      try {
        const { data: memberData, error: memberError } = await supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', session.user.id)
          .single()

        if (memberError) {
          console.error('Error checking organization membership:', memberError)
          
          // Only redirect if it's not a "no rows returned" error
          if (memberError.code !== 'PGRST116') {
            return NextResponse.redirect(new URL('/sign-in', baseUrl))
          }
        }

        if (!memberData?.organization_id) {
          console.log('User has no organization, redirecting to setup')
          return NextResponse.redirect(new URL('/organization-setup', baseUrl))
        }

        console.log('User has organization membership:', {
          organizationId: memberData.organization_id,
          role: memberData.role
        })
      } catch (error) {
        console.error('Organization check failed:', error)
        // Continue if organization check fails rather than blocking
      }
    }
    
    return res

  } catch (error) {
    console.error('Middleware error:', error)
    // On error, allow request to continue rather than redirect
    // This prevents auth loops during rate limiting
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static file extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .css, .js, etc.)
     * - API routes (they handle their own auth)
     * - Auth routes (sign-in, sign-up, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|sign-in|sign-up|forgot-password|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
} 