import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next')
  const hash = requestUrl.hash

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

  // If we have a hash fragment, it means we're in an invite flow
  if (hash && hash.includes('access_token')) {
    // Extract the access token from the hash
    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    
    if (accessToken) {
      // Set the access token in the cookie
      const { data: { session }, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: params.get('refresh_token') || ''
      })

      if (error) {
        console.error('Error setting session:', error)
        return NextResponse.redirect(new URL('/sign-in?error=Authentication failed', requestUrl.origin))
      }

      return NextResponse.redirect(new URL('/update-password', requestUrl.origin))
    }
  }

  // Handle verification token (from email invites)
  if (token && type === 'invite') {
    // Verify the token
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'invite'
    })

    if (error) {
      console.error('Error verifying token:', error)
      return NextResponse.redirect(new URL('/sign-in?error=Invalid or expired invite link', requestUrl.origin))
    }

    return NextResponse.redirect(new URL('/update-password', requestUrl.origin))
  }

  // Handle authorization code
  if (code) {
    // Exchange the code for a session
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code:', error)
      return NextResponse.redirect(new URL('/sign-in?error=Authentication failed', requestUrl.origin))
    }

    // If this is an invite flow and the user needs to set password
    if (type === 'invite' || type === 'signup') {
      return NextResponse.redirect(new URL('/update-password', requestUrl.origin))
    }

    // For all other flows, check organization membership
    if (session) {
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .single()

      // If no organization and not updating password, redirect to organization setup
      if (!memberData?.organization_id && !next?.includes('update-password')) {
        return NextResponse.redirect(new URL('/organization-setup', requestUrl.origin))
      }
    }
  }

  // Redirect to the requested page or home
  return NextResponse.redirect(new URL(next || '/', requestUrl.origin))
}

export const dynamic = 'force-dynamic' 