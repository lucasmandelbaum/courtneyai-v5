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

    // Refresh session if expired - required for Server Components
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('Session error:', sessionError)
      return NextResponse.redirect(new URL('/sign-in', baseUrl))
    }

    // If not signed in and not on an auth route, redirect to sign in
    if (!session && !isNoOrgRoute) {
      console.log('No session, redirecting to sign-in')
      return NextResponse.redirect(new URL('/sign-in', baseUrl))
    }

    // If signed in but no organization membership, redirect to organization setup
    if (session && !isNoOrgRoute) {
      console.log('Checking organization membership for user:', session.user.id)
      
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
    }
    
    return res

  } catch (error) {
    console.error('Middleware error:', error)
    // On error, redirect to sign-in with the current URL as base
    const url = new URL(req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    return NextResponse.redirect(new URL('/sign-in', baseUrl))
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
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
} 