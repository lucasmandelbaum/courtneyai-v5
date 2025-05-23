import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'
import { OpenAI } from 'https://esm.sh/openai@4.46.0'

const openaiKey = Deno.env.get('OPENAI_API_KEY')
if (!openaiKey) {
  throw new Error('Missing OpenAI API key')
}

const openai = new OpenAI({
  apiKey: openaiKey,
})

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the request body
    const { scriptId, text, voice = 'alloy', userId } = await req.json()

    // Basic validation
    if (!scriptId || !text || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create a Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Validate that the script belongs to the user
    const { data: scriptData, error: scriptError } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', scriptId)
      .eq('user_id', userId)
      .single()

    if (scriptError || !scriptData) {
      return new Response(
        JSON.stringify({ error: 'Script not found or unauthorized access' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Supported voices: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
    if (!['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice)) {
      return new Response(
        JSON.stringify({ error: 'Invalid voice option' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Generate speech with OpenAI
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text,
    })

    // Convert to ArrayBuffer
    const buffer = await mp3.arrayBuffer()

    // Generate a unique filename
    const timestamp = new Date().getTime()
    const filename = `${userId}/${scriptId}-${timestamp}.mp3`
    const filePath = `audio-assets/${filename}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-assets')
      .upload(filename, buffer, {
        contentType: 'audio/mpeg',
      })

    if (uploadError) {
      console.error('Error uploading audio:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload audio file' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Generate a public URL for the audio file
    const { data: { publicUrl } } = supabase.storage
      .from('audio-assets')
      .getPublicUrl(filename)

    return new Response(
      JSON.stringify({
        audioUrl: publicUrl,
        path: filePath,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating speech:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}) 