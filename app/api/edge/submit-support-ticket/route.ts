import { NextRequest, NextResponse } from 'next/server'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
  'Access-Control-Max-Age': '86400',
}

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

    // Get the request body and auth header
    const body = await request.json()
    const authHeader = request.headers.get('Authorization')

    // Forward the request to the Edge Function
    const edgeFunctionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/submit-support-ticket`

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body: JSON.stringify(body)
    })

    // Get response data
    const data = await response.json()
      
    // Forward the Edge Function response
    return NextResponse.json(data, { 
      status: response.status,
      headers: corsHeaders
    })
  } catch (error) {
    console.error('Error in submit-support-ticket API route:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    )
  }
} 