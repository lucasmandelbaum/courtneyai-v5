import { NextRequest, NextResponse } from 'next/server'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    
    if (!supabaseUrl) {
      console.error('Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }

    // Get the request body and headers we need
    const body = await request.json()
    const authHeader = request.headers.get('Authorization')

    if (!authHeader) {
      console.error('No authorization header provided')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: corsHeaders
        }
      )
    }

    console.log('Calling create-script edge function with payload:', {
      productId: body.productId,
      hasTitle: !!body.title,
      contentLength: body.content?.length || 0,
      hasCaption: !!body.caption
    })

    // Call the Supabase Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-script`
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    
    console.log('Edge function response:', {
      status: response.status,
      success: response.ok,
      data: data ? { hasScript: !!data.script, error: data.error } : null
    })
    
    // Forward the Edge Function response
    return NextResponse.json(data, { 
      status: response.status,
      headers: corsHeaders
    })
  } catch (error) {
    console.error('Error in create-script API route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: corsHeaders
      }
    )
  }
} 