import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface Product {
  id: string
  url: string
  user_id: string
}

interface RequestBody {
  productId: string
}

function getRootDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    // Remove 'www.' if present and return just the hostname
    return urlObj.hostname.replace(/^www\./, '')
  } catch (error) {
    console.error('Error parsing URL:', error)
    return ''
  }
}

Deno.serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get request body
    const { productId } = await req.json() as RequestBody

    // Get product details
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('id, url, user_id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch product description from Perplexity
    const perplexityApiKey = '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'
    const rootDomain = getRootDomain(product.url)
    
    if (!rootDomain) {
      return new Response(
        JSON.stringify({ error: 'Invalid product URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const perplexityRequest = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'Be accurate. No fluff, just the information you found.'
        },
        {
          role: 'user',
          content: `Extract all the product details, including reviews, from ${product.url}. Also tell me about the brand.`
        }
      ],
      search_domain_filter: [rootDomain],
      return_images: true
    }

    // Log the full request for debugging
    console.log('Perplexity Request:', JSON.stringify({
      url: product.url,
      rootDomain,
      request: perplexityRequest
    }, null, 2))

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(perplexityRequest)
    })

    // Log the full response for debugging
    const responseText = await perplexityResponse.text()
    console.log('Perplexity Full Response:', responseText)

    if (!perplexityResponse.ok) {
      console.error('Perplexity API error:', responseText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch product description' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const perplexityData = JSON.parse(responseText)
    const description = perplexityData.choices[0].message.content

    // Save the description to the database
    const { data: savedDescription, error: saveError } = await supabaseClient
      .from('product_descriptions')
      .insert({
        product_id: product.id,
        description: description,
        source_url: product.url,
        user_id: product.user_id
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving description:', saveError)
      return new Response(
        JSON.stringify({ error: 'Failed to save product description' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        message: 'Product description fetched and saved successfully',
        data: savedDescription
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 