import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'
import { checkUsageLimit, incrementUsage, createUsageLimitResponse } from '../_shared/usage.ts'

// Helper function for structured logging
function log(level: string, message: string, scriptId: string | null = null, details: any = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    function_name: 'generate-script',
    ...(scriptId && { script_id: scriptId }),
    ...details
  }
  console.log(JSON.stringify(logEntry))
}

// Helper function to measure execution time
function logExecutionTime(startTime: number, step: string) {
  const endTime = performance.now()
  const duration = endTime - startTime
  log('debug', `Step timing: ${step}`, null, {
    step,
    duration_ms: Math.round(duration),
    start_time: new Date(Date.now() - duration).toISOString(),
    end_time: new Date().toISOString()
  })
  return endTime
}

serve(async (req) => {
  const startTime = performance.now()
  let currentStep = startTime

  // Add request logging
  log('info', 'Generate script function called', null, {
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    url: req.url
  })

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const falApiKey = Deno.env.get('FAL_API_KEY')

    if (!supabaseUrl || !supabaseKey || !falApiKey) {
      const missingVars = [
        !supabaseUrl && 'SUPABASE_URL',
        !supabaseKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !falApiKey && 'FAL_API_KEY'
      ].filter(Boolean)
      
      log('error', 'Missing required environment variables', null, {
        missing_variables: missingVars
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('debug', 'Environment variables loaded successfully')
    currentStep = logExecutionTime(currentStep, 'env_vars_load')

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
    log('debug', 'Supabase admin client created')
    currentStep = logExecutionTime(currentStep, 'supabase_admin_init')

    // Get the user from the auth header
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      log('error', 'No authorization token provided', null, {
        auth_header: authHeader
      })
      return new Response(
        JSON.stringify({ error: 'No authorization token provided' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify the user token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) {
      log('error', 'Invalid authorization token', null, {
        error: userError,
        token_present: !!token
      })
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('info', 'User authenticated successfully', null, {
      user_id: user.id,
      email: user.email
    })
    currentStep = logExecutionTime(currentStep, 'user_auth')

    // Check usage limits BEFORE processing
    log('info', 'Checking scripts usage limit', null, { user_id: user.id })
    const usageCheck = await checkUsageLimit(supabaseAdmin, user.id, 'scripts_per_month', 1)
    
    if (!usageCheck.allowed) {
      log('warn', 'Scripts usage limit exceeded', null, {
        user_id: user.id,
        current_usage: usageCheck.currentUsage,
        limit: usageCheck.limit,
        plan: usageCheck.planName
      })
      return createUsageLimitResponse(usageCheck, 'AI scripts')
    }

    log('info', 'Usage limit check passed', null, {
      user_id: user.id,
      current_usage: usageCheck.currentUsage,
      limit: usageCheck.limit,
      plan: usageCheck.planName
    })

    // Create client with user context for RLS
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    log('debug', 'Supabase client created with user context')
    currentStep = logExecutionTime(currentStep, 'supabase_client_init')

    // Get the request body
    const body = await req.json()
    const { productId } = body
    log('debug', 'Request body parsed', null, { body })

    // Basic validation
    if (!productId) {
      log('error', 'Missing product ID in request')
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get product data
    log('debug', 'Fetching product data', null, { product_id: productId })
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      log('error', 'Product not found or unauthorized access', null, {
        product_id: productId,
        error: productError,
        user_id: user.id
      })
      return new Response(
        JSON.stringify({ error: 'Product not found or unauthorized access' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('info', 'Product data fetched successfully', null, {
      product_id: product.id,
      product_name: product.name
    })
    currentStep = logExecutionTime(currentStep, 'product_fetch')

    // Get hooks
    log('debug', 'Fetching hooks')
    const { data: hooks, error: hooksError } = await supabaseClient
      .from('hooks')
      .select('*')

    if (hooksError || !hooks || hooks.length === 0) {
      log('error', 'Failed to fetch hooks', null, {
        error: hooksError,
        hooks_count: hooks?.length ?? 0
      })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch hooks' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    log('info', 'Hooks fetched successfully', null, { hooks_count: hooks.length })
    currentStep = logExecutionTime(currentStep, 'hooks_fetch')

    // Select a random hook
    const selectedHook = hooks[Math.floor(Math.random() * hooks.length)]
    log('info', 'Hook selected', null, {
      hook_id: selectedHook.id,
      hook_category: selectedHook.category
    })

    // Create prompts
    log('debug', 'Creating prompts')
    const systemPrompt = `You are a professional TikTok script writer specializing in creating engaging, high-converting scripts for product marketing.

For this task, you are writing a script for: ${product.name}

You are using the hook template: "${selectedHook.template}" from the ${selectedHook.category} category.

Make the script engaging, concise, and designed to stop the scroll and drive conversions. Focus EXCLUSIVELY on the specific product provided.

In addition to the script, you will also create a caption for the TikTok post that complements the video content.

Other important guidelines:
- DO NOT mention specific retailers like Target, Amazon, Walmart, etc.
- DO NOT include any sales promises like guarantees, warranties, delivery times, discounts, etc.
- DO NOT include any visual cues or camera directions - ONLY the script for the audio
- END the script with "swipe up to get yours" or a creative/funny variation that calls back to the script`

    const prompt = `I need you to write a TikTok script for the following product. Do not make up any information, only use the product description.

PRODUCT NAME: ${product.name}

PRODUCT DESCRIPTION:
${product.description}

SELECTED HOOK:
Category: ${selectedHook.category}
Template: ${selectedHook.template}
Example: ${selectedHook.example}

IMPORTANT INSTRUCTIONS:
- Create a script to be read aloud (approximately 15 seconds when read)
- Make it conversational and engaging
- Also create a caption for the TikTok post (100-150 characters) with 3-5 relevant hashtags
- DO NOT mention specific retailers
- DO NOT include any visual cues or camera directions
- DO NOT offer any sales or discounts
- DO NOT mention inventory or other sales metrics
- DO NOT make up product features or benefits not mentioned in the description
- DO NOT use sales terminology like "limited time offer," "discount," "sale," etc.
- DO NOT include any sales promises
- ONLY include information that is factually supported by the product description
- END THE SCRIPT with "swipe up to get yours" or a creative variation
- Everything should be able to be read phonetically
- Use profuse punctuation to help with reading
- Do not include sound effects or noises

FORMAT YOUR RESPONSE AS FOLLOWS:

SCRIPT:
[Your script to be read aloud with thorough punctuation]

CAPTION:
[Your caption with hashtags, 100-150 characters]`

    log('debug', 'Prompts created', null, {
      system_prompt_length: systemPrompt.length,
      prompt_length: prompt.length
    })
    currentStep = logExecutionTime(currentStep, 'prompts_creation')

    // Configure fal.ai client
    const falKey = Deno.env.get('FAL_API_KEY')
    if (!falKey) {
      log('error', 'Missing FAL_API_KEY environment variable')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Call fal.ai API
    log('info', 'Calling fal.ai API', null, {
      model: 'deepseek/deepseek-r1'
    })

    const falResponse = await fetch('https://fal.run/fal-ai/any-llm', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        prompt: prompt,
        system_prompt: systemPrompt
      })
    })

    if (!falResponse.ok) {
      const responseText = await falResponse.text()
      log('error', 'Failed to generate script with fal.ai', null, {
        status: falResponse.status,
        status_text: falResponse.statusText,
        response_headers: Object.fromEntries(falResponse.headers.entries()),
        response_body: responseText
      })
      return new Response(
        JSON.stringify({ error: 'Failed to generate script', details: responseText }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const falData = await falResponse.json()
    log('info', 'Received response from fal.ai')
    currentStep = logExecutionTime(currentStep, 'fal_ai_call')

    const generatedText = falData.output || falData.response || ''
    log('debug', 'Processing generated text', null, {
      text_length: generatedText.length
    })

    // Parse the script and caption
    let script = ''
    let caption = ''

    if (generatedText.includes('SCRIPT:') && generatedText.includes('CAPTION:')) {
      const parts = generatedText.split('CAPTION:')
      if (parts.length >= 2) {
        script = parts[0].split('SCRIPT:')[1].trim()
        caption = parts[1].trim()
        log('debug', 'Successfully parsed script and caption', null, {
          script_length: script.length,
          caption_length: caption.length
        })
      }
    } else {
      script = generatedText
      log('warn', 'Could not parse caption from response', null, {
        generated_text_length: generatedText.length
      })
    }

    // Save the script to Supabase
    log('debug', 'Saving script to database', null, {
      product_id: productId,
      script_length: script.length,
      caption_length: caption.length
    })

    const { data: scriptData, error: scriptError } = await supabaseClient
      .from('scripts')
      .insert([
        {
          product_id: productId,
          title: `Script for ${product.name}`,
          content: script,
          caption: caption,
          user_id: user.id,
          hook_category: selectedHook.category,
          hook_template: selectedHook.template,
          metadata: {
            hook_id: selectedHook.id,
            generated_at: new Date().toISOString(),
            generation_time_ms: Math.round(performance.now() - startTime)
          }
        }
      ])
      .select()
      .single()

    if (scriptError) {
      log('error', 'Failed to save script', null, {
        error: scriptError,
        product_id: productId,
        user_id: user.id
      })
      return new Response(
        JSON.stringify({ error: 'Failed to save script' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Increment usage AFTER successful creation
    log('info', 'Incrementing scripts usage', null, { user_id: user.id })
    const usageIncremented = await incrementUsage(supabaseAdmin, user.id, 'scripts_per_month', 1)
    
    if (!usageIncremented) {
      log('warn', 'Failed to increment usage metrics', null, { user_id: user.id })
      // Don't fail the request, just log the warning
    }

    log('info', 'Script generated and saved successfully', scriptData.id, {
      product_id: productId,
      total_time_ms: Math.round(performance.now() - startTime)
    })
    currentStep = logExecutionTime(currentStep, 'script_save')

    return new Response(
      JSON.stringify({
        script: scriptData,
        hook: selectedHook,
        execution_time_ms: Math.round(performance.now() - startTime),
        usage: {
          currentUsage: usageCheck.currentUsage + 1,
          limit: usageCheck.limit,
          planName: usageCheck.planName
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    log('error', 'Unexpected error in generate-script function', null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      total_time_ms: Math.round(performance.now() - startTime)
    })
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}) 

interface Photo {
  id: string;
  description: string | null;
}

async function getImageDescriptions(
  supabaseClient: SupabaseClient<Database>,
  mediaFiles: MediaFile[]
): Promise<Map<string, string>> {
  const startTime = Date.now();
  
  log('info', 'Starting image description retrieval', null, {
    total_media_files: mediaFiles.length,
    image_files: mediaFiles.filter(f => f.type === 'image').length
  });

  // Extract photo IDs from media files
  const photoIds = mediaFiles
    .filter(file => file.type === 'image')
    .map(file => {
      // Extract the photo ID from the file path
      // Example path: photos/user-id/photo-id.jpeg
      const matches = file.originalPath.match(/photos\/[^\/]+\/([^\/]+)\.[^\.]+$/);
      const id = matches ? matches[1] : null;
      
      log('info', 'Processing media file path', null, {
        original_path: file.originalPath,
        extracted_id: id,
        match_found: !!matches,
        match_groups: matches ? matches.length : 0
      });
      
      return id;
    })
    .filter((id): id is string => id !== null);

  if (photoIds.length === 0) {
    log('info', 'No photo IDs found to process', null, {
      duration_ms: Date.now() - startTime
    });
    return new Map();
  }

  log('info', 'Fetching photo descriptions', null, {
    photo_ids: photoIds
  });

  const { data: photos, error } = await supabaseClient
    .from('photos')
    .select('id, description')
    .in('id', photoIds);

  if (error) {
    log('error', 'Failed to fetch photo descriptions', null, {
      error: error.message,
      photo_ids: photoIds,
      duration_ms: Date.now() - startTime
    });
    throw error;
  }

  log('info', 'Successfully fetched photo descriptions', null, {
    photos_found: photos.length,
    photos_with_descriptions: photos.filter((p: Photo) => !!p.description).length,
    duration_ms: Date.now() - startTime
  });

  return new Map(photos.map((photo: Photo) => [photo.id, photo.description || '']));
} 

async function generateMediaOrder(
  mediaFiles: MediaFile[],
  transcription: ElevenLabsTranscription,
  imageDescriptions: Map<string, string>,
  reelId: string
): Promise<OrderedMediaResponse> {
  const startTime = Date.now();
  
  log('info', 'Starting media order generation', null, {
    media_files_count: mediaFiles.length,
    media_types_breakdown: mediaFiles.reduce((acc, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    has_transcription: !!transcription,
    transcription_word_count: transcription?.words?.length || 0,
    image_descriptions_available: imageDescriptions.size
  });

  // Validate transcription data
  if (!transcription.words || transcription.words.length === 0) {
    log('error', 'Invalid transcription data', null, {
      has_words: !!transcription.words,
      word_count: transcription.words?.length || 0,
      duration_ms: Date.now() - startTime
    });
    throw new Error('Invalid transcription data: missing word timing information');
  }

  // Calculate total audio duration and analyze timing
  const totalAudioDuration = transcription.words[transcription.words.length - 1].end;
  const wordTimings = transcription.words.map(w => ({ start: w.start, end: w.end }));
  
  log('info', 'Analyzing audio timing', null, {
    total_duration_seconds: totalAudioDuration,
    word_count: transcription.words.length,
    first_word_timing: wordTimings[0],
    last_word_timing: wordTimings[wordTimings.length - 1],
    has_audio_events: !!transcription.audio_events,
    audio_events_count: transcription.audio_events?.length || 0
  });

  // Prepare media descriptions
  const mediaDescriptions = mediaFiles.map((file, index) => {
    const id = file.originalPath.match(/(?:photos|videos)\/([^\/]+)/)?.[1] || file.originalPath;
    const description = file.type === 'image' ? imageDescriptions.get(id) || 'No description available' : 'Video content';
    
    log('info', 'Processing media file for ordering', null, {
      index,
      file_type: file.type,
      original_path: file.originalPath,
      extracted_id: id,
      has_description: file.type === 'image' ? !!imageDescriptions.get(id) : true,
      description_length: description.length
    });

    return {
      id,
      type: file.type,
      source: file.source,
      description
    };
  });

  log('info', 'Media descriptions prepared', null, {
    total_media: mediaDescriptions.length,
    images_with_descriptions: mediaDescriptions.filter(m => m.type === 'image' && m.description !== 'No description available').length,
    total_images: mediaDescriptions.filter(m => m.type === 'image').length,
    total_videos: mediaDescriptions.filter(m => m.type === 'video').length,
    preparation_time_ms: Date.now() - startTime
  });

  // Create prompts
  const systemPrompt = `You are an AI expert in creating engaging social media content. Your task is to analyze the provided audio transcription and media files to create the most engaging visual sequence for a TikTok video.

Key requirements:
1. Each media element must be shown for at least 2 seconds
2. Align visuals with the spoken content using the word timing data
3. Ensure smooth transitions between media elements
4. Use all provided media at least once
5. Total duration must match the audio duration of ${totalAudioDuration} seconds`;

  const prompt = `Create an optimal media sequence using the following information:

TRANSCRIPTION WITH TIMING:
${JSON.stringify(transcription.words, null, 2)}

AVAILABLE MEDIA:
${JSON.stringify(mediaDescriptions, null, 2)}

Return a JSON array of media elements with precise timing. Each element must include:
- id: The media ID provided
- type: "image" or "video"
- start_time: When to show the element (in seconds)
- duration: How long to show it (in seconds, minimum 2)
- description: The provided description

The sequence must:
1. Cover the entire audio duration (${totalAudioDuration} seconds)
2. Use each media element at least once
3. Align visuals with relevant spoken content
4. Ensure smooth transitions`;

  log('info', 'Generated AI prompts', null, {
    system_prompt_length: systemPrompt.length,
    main_prompt_length: prompt.length,
    transcription_words_included: transcription.words.length,
    media_descriptions_included: mediaDescriptions.length,
    prompt_generation_time_ms: Date.now() - startTime
  });

  try {
    const falKey = Deno.env.get('FAL_API_KEY');
    if (!falKey) {
      log('error', 'Missing FAL API key', null, {
        duration_ms: Date.now() - startTime
      });
      throw new Error('Missing FAL_API_KEY');
    }

    log('info', 'Calling fal.ai for media ordering', null, {
      model: 'deepseek/deepseek-r1',
      prompt_sizes: {
        system_prompt: systemPrompt.length,
        main_prompt: prompt.length
      }
    });

    const response = await fetch('https://fal.run/fal-ai/any-llm', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        prompt,
        system_prompt: systemPrompt,
        format: 'json'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('error', 'Failed to get response from fal.ai', null, {
        status: response.status,
        error_text: errorText,
        duration_ms: Date.now() - startTime
      });
      throw new Error(`Failed to generate media order: ${errorText}`);
    }

    const result = await response.json();
    const orderedMedia = result.output;

    log('info', 'Received AI response', null, {
      response_size: JSON.stringify(result).length,
      has_output: !!orderedMedia,
      raw_response: result,
      duration_ms: Date.now() - startTime
    });

    // Validate the ordered media structure
    if (!validateOrderedMedia(orderedMedia, totalAudioDuration)) {
      log('error', 'Invalid media order structure', null, {
        received_structure: orderedMedia,
        validation_time_ms: Date.now() - startTime
      });
      throw new Error('Invalid media order structure');
    }

    log('info', 'Media order generated successfully', null, {
      total_duration: orderedMedia.total_duration,
      element_count: orderedMedia.elements.length,
      elements_breakdown: orderedMedia.elements.reduce((acc, elem) => {
        acc[elem.type] = (acc[elem.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      total_generation_time_ms: Date.now() - startTime
    });

    return orderedMedia;
  } catch (error) {
    log('error', 'Error in media order generation', null, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: Date.now() - startTime
    });

    // Create a simple sequence as fallback
    const simpleSequence = createSimpleMediaSequence(mediaFiles);
    
    log('info', 'Created fallback simple sequence', null, {
      element_count: simpleSequence.elements.length,
      total_duration: simpleSequence.total_duration,
      fallback_generation_time_ms: Date.now() - startTime
    });

    return simpleSequence;
  }
} 