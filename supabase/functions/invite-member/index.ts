/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generate } from 'https://deno.land/std@0.208.0/uuid/v4.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateInviteRequest {
  organizationId: string;
}

interface UseInviteRequest {
  code: string;
}

// Generate a random invite code (6 characters)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

    // Create Supabase admin client for auth verification only
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

    const { pathname } = new URL(req.url)

    // Handle different endpoints
    if (pathname.endsWith('/generate')) {
      // Generate new invite code
      const { organizationId }: GenerateInviteRequest = await req.json()

      // Check if requesting user is an owner using RLS client
      const { data: ownerCheck, error: ownerError } = await supabaseClient
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', requestingUser.id)
        .eq('role', 'owner')
        .single()

      if (ownerError || !ownerCheck) {
        return new Response(
          JSON.stringify({ error: 'Not authorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate a unique invite code
      let code: string;
      let isUnique = false;
      while (!isUnique) {
        code = generateInviteCode()
        const { data: existingCode } = await supabaseClient
          .from('invite_codes')
          .select('id')
          .eq('code', code)
          .maybeSingle()
        
        if (!existingCode) {
          isUnique = true
        }
      }

      // Create invite code record using RLS client
      const { data: inviteCode, error: createError } = await supabaseClient
        .from('invite_codes')
        .insert({
          organization_id: organizationId,
          code,
          created_by: requestingUser.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      return new Response(
        JSON.stringify({ data: inviteCode }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (pathname.endsWith('/use')) {
      // Use invite code
      const { code }: UseInviteRequest = await req.json()

      // Find and validate invite code - public access so use client with RLS
      const { data: inviteCode, error: inviteError } = await supabaseClient
        .from('invite_codes')
        .select('*, organizations(*)')
        .eq('code', code)
        .eq('is_active', true)
        .is('used_by', null)
        .gte('expires_at', new Date().toISOString())
        .single()

      if (inviteError || !inviteCode) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired invite code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user is already a member using RLS client
      const { data: existingMember } = await supabaseClient
        .from('organization_members')
        .select('id')
        .eq('organization_id', inviteCode.organization_id)
        .eq('user_id', requestingUser.id)
        .maybeSingle()

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: 'You are already a member of this organization' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Add user as member using RLS client
      const { error: insertError } = await supabaseClient
        .from('organization_members')
        .insert({
          organization_id: inviteCode.organization_id,
          user_id: requestingUser.id,
          role: 'member'
        })

      if (insertError) {
        throw insertError
      }

      // Mark invite code as used
      const { error: updateError } = await supabaseClient
        .from('invite_codes')
        .update({
          used_by: requestingUser.id,
          used_at: new Date().toISOString(),
          is_active: false
        })
        .eq('id', inviteCode.id)

      if (updateError) {
        throw updateError
      }

      return new Response(
        JSON.stringify({ 
          data: {
            organization: inviteCode.organizations,
            role: 'member'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 