import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { priceId, organizationId } = await request.json()
    
    // Get supabase instance
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Call our Edge Function with auth token
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { priceId, organizationId },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
