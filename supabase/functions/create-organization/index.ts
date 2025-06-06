/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateOrganizationRequest {
  name: string;
}

// Main serve function
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client for auth verification
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')?.split(' ')[1]
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the requesting user
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(authHeader)
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Create client with user context for RLS operations
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authHeader}` } }
    })

    // Parse request body
    const { name }: CreateOrganizationRequest = await req.json()

    if (!name || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Organization name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Check if user already has an organization
    const { data: existingMember } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', requestingUser.id)
      .maybeSingle()

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: 'You are already a member of an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create organization using admin client (bypasses RLS for org creation)
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: name.trim(), slug })
      .select()
      .single()

    if (orgError) {
      console.error('Organization creation error:', orgError)
      if (orgError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'An organization with this name already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw orgError
    }

    if (!orgData) {
      throw new Error('Failed to create organization')
    }

    // Add user as owner using user client (for proper RLS context)
    const { error: memberError } = await supabaseClient
      .from('organization_members')
      .insert({
        organization_id: orgData.id,
        user_id: requestingUser.id,
        role: 'owner'
      })

    if (memberError) {
      console.error('Failed to add user as owner:', memberError)
      
      // Cleanup: Delete the created organization if member creation fails (using admin client)
      await supabaseAdmin
        .from('organizations')
        .delete()
        .eq('id', orgData.id)
      
      throw memberError
    }

    return new Response(
      JSON.stringify({ 
        data: {
          organization: orgData,
          role: 'owner'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating organization:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 