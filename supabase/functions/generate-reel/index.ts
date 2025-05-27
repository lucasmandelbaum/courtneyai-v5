/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts'
import { checkUsageLimit, incrementUsage, createUsageLimitResponse } from '../_shared/usage.ts';

// Handle shutdown signal
let isShuttingDown = false;
addEventListener("unload", () => {
  console.log("Received shutdown signal");
  isShuttingDown = true;
});

// Add EdgeRuntime type
declare global {
  const EdgeRuntime: {
    waitUntil(promise: Promise<any>): void;
  };
}

// Types for ElevenLabs API
interface ElevenLabsTranscription {
  text: string;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  audio_events?: Array<{
    type: string;
    start: number;
    end: number;
  }>;
  speakers?: Array<{
    name: string;
    start: number;
    end: number;
  }>;
}

interface ElevenLabsSpeechToText {
  convert(params: {
    file: Blob;
    model_id: string;
    tag_audio_events?: boolean;
    language_code?: string;
    diarize?: boolean;
  }): Promise<ElevenLabsTranscription>;
}

class ElevenLabsClient {
  private apiKey: string;
  public speechToText: ElevenLabsSpeechToText;

  constructor(options: { apiKey: string }) {
    this.apiKey = options.apiKey;
    this.speechToText = {
      convert: async (params) => {
        const formData = new FormData();
        formData.append('file', params.file);
        formData.append('model_id', params.model_id);
        if (params.tag_audio_events) formData.append('tag_audio_events', 'false');
        if (params.language_code) formData.append('language_code', params.language_code);
        if (params.diarize) formData.append('diarize', 'false');

        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey
          },
          body: formData
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`ElevenLabs API error: ${response.status} ${error}`);
        }

        return response.json();
      }
    };
  }
}

// Types
type SupabaseClient<T> = ReturnType<typeof createClient<T>>;

interface Database {
  public: {
    Tables: {
      photos: {
        Row: {
          id: string;
          file_path: string;
          description: string | null;
        }
      };
      videos: {
        Row: {
          id: string;
          file_path: string;
          duration: number;
        }
      };
      reels: {
        Row: {
          id: string;
          product_id: string;
          script_id?: string;
          title: string;
          status: string;
          storage_path?: string;
          file_name?: string;
          user_id: string;
          ordered_media?: string;
        }
      };
    };
  };
}

// Types
interface MediaFile {
  type: 'image' | 'video';
  source: string;
  originalPath: string;
  description: string;
  originalDuration?: number; // Original duration in seconds for videos
}

interface CreatomateElement {
  type: string;
  source?: string;
  track: number;
  time: number;
  duration: number;
  transcript_effect?: string;
  transcript_maximum_length?: number;
  y?: string;
  width?: string;
  height?: string;
  x_alignment?: string;
  y_alignment?: string;
  fill_color?: string;
  transcript_color?: string;
  stroke_color?: string;
  stroke_width?: string;
  font_family?: string;
  font_weight?: string;
  font_size?: string;
  background_x_padding?: string;
  background_y_padding?: string;
  background_color?: string;
  background_border_radius?: string;
}

interface CreatomateRequest {
  source: {
    output_format: string;
    width: number;
    height: number;
    fps: number;
    elements: CreatomateElement[];
  }
}

interface ReelInput {
  productId: string;
  scriptId?: string;
  photoIds?: string[];
  videoIds?: string[];
  title: string;
}

interface StorageBucket {
  name: string;
  id: string;
}

// Constants
const MAX_POLL_TIME = 5 * 60 * 1000;
const POLL_INTERVAL = 5000;

const COMPLETED_STATUSES = ['completed', 'succeeded'] as const;
const IN_PROGRESS_STATUSES = ['planned', 'rendering', 'transcribing'] as const;

const REEL_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  GENERATING_AUDIO: 'generating_audio',
  PROCESSING_MEDIA: 'processing_media',
  RENDERING: 'rendering',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RENDERING_PREPARING: 'rendering_preparing',
  RENDERING_PROCESSING: 'rendering_processing',
  RENDERING_FINALIZING: 'rendering_finalizing'
} as const;

type ReelStatus = typeof REEL_STATUS[keyof typeof REEL_STATUS];

// Helper Functions
const getStoragePath = (fullPath: string): string => {
  const mediaPathRegex = /\/storage\/v1\/object\/public\/media\/(.*)/;
  const match = fullPath.match(mediaPathRegex);
  return match ? match[1] : fullPath;
};

// Initialize Supabase client with proper types
const initSupabase = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
};

const validateEnvironment = () => {
  const requiredEnvVars = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
    CREATOMATE_API_KEY: Deno.env.get('CREATOMATE_API_KEY'),
    ELEVENLABS_API_KEY: Deno.env.get('ELEVENLABS_API_KEY')
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

const validateBuckets = async (supabaseClient: SupabaseClient<Database>) => {
  const requiredBuckets = ['media', 'audio', 'generated-reels'];
  
  for (const bucket of requiredBuckets) {
    try {
      const { data, error } = await supabaseClient.storage.from(bucket).list('', { limit: 1 });
      if (error) {
        throw new Error(`Missing or inaccessible storage bucket: ${bucket}`);
      }
    } catch (error) {
      throw new Error(`Missing or inaccessible storage bucket: ${bucket}`);
    }
  }
};

const validateInput = (input: ReelInput) => {
  const missingFields: string[] = [];
  
  if (!input?.productId) missingFields.push('productId');
  if (!input?.photoIds?.length && !input?.videoIds?.length) {
    missingFields.push('media (photos or videos)');
  }
  if (!input?.title) missingFields.push('title');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
};

const getMediaFiles = async (
  supabaseClient: SupabaseClient<Database>,
  photoIds: string[] = [],
  videoIds: string[] = []
): Promise<MediaFile[]> => {
  const mediaFiles: MediaFile[] = [];
  
  // Initialize service client for storage operations
  const serviceClient = initSupabase();

  if (photoIds.length > 0) {
    const { data: photos, error: photoError } = await supabaseClient
      .from('photos')
      .select('id, file_path, description')
      .in('id', photoIds);

    if (photoError) throw photoError;
    if (!photos) throw new Error('Failed to fetch photos');

    mediaFiles.push(...photos.map((photo: Database['public']['Tables']['photos']['Row']) => ({
      type: 'image' as const,
      source: photo.file_path.startsWith('http') ? photo.file_path : `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${photo.file_path}`,
      originalPath: photo.file_path,
      description: photo.description || 'No description available'
    })));
  }

  if (videoIds.length > 0) {
    const { data: videos, error: videoError } = await supabaseClient
      .from('videos')
      .select('id, file_path, duration')
      .in('id', videoIds);

    if (videoError) throw videoError;
    if (!videos) throw new Error('Failed to fetch videos');

    mediaFiles.push(...videos.map((video: Database['public']['Tables']['videos']['Row']) => ({
      type: 'video' as const,
      source: video.file_path.startsWith('http') ? video.file_path : `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${video.file_path}`,
      originalPath: video.file_path,
      description: 'Video content',
      originalDuration: video.duration
    })));
  }

  return mediaFiles;
};

const prepareCreatomateRequest = (mediaFiles: MediaFile[]): CreatomateRequest => {
  console.info('Preparing Creatomate request with media files:', mediaFiles);
  
  const elements: CreatomateElement[] = mediaFiles.map((file, index) => ({
    type: file.type === 'image' ? 'image' : 'video',
    source: file.source,
    track: index,
    time: index * 5, // 5 seconds per media
    duration: 5 // 5 seconds duration for each
  }));

  return {
    source: {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      elements
    }
  };
};

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Validate environment and initialize clients
    validateEnvironment();
    const supabaseClient = initSupabase();
    await validateBuckets(supabaseClient);

    // Parse request
    const input: ReelInput = await req.json();
    validateInput(input);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify user token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // Check usage limits BEFORE processing
    console.log('Checking reels usage limit for user:', user.id);
    const usageCheck = await checkUsageLimit(supabaseClient, user.id, 'reels_per_month', 1);
    
    if (!usageCheck.allowed) {
      console.warn('Reels usage limit exceeded:', {
        user_id: user.id,
        current_usage: usageCheck.currentUsage,
        limit: usageCheck.limit,
        plan: usageCheck.planName
      });
      return createUsageLimitResponse(usageCheck, 'reels');
    }

    console.log('Usage limit check passed:', {
      user_id: user.id,
      current_usage: usageCheck.currentUsage,
      limit: usageCheck.limit,
      plan: usageCheck.planName
    });

    // Create user-context client for RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create reel record using user context for RLS
    const { data: reel, error: reelError } = await supabaseUser
      .from('reels')
      .insert({
        product_id: input.productId,
        script_id: input.scriptId,
        title: input.title,
        user_id: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (reelError || !reel) {
      console.error('Failed to create reel record:', reelError);
      return new Response(
        JSON.stringify({ error: 'Failed to create reel record' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.info('Created reel:', { reel_id: reel.id });

    // Start video generation in the background using EdgeRuntime.waitUntil
    const creatomateApiKey = Deno.env.get('CREATOMATE_API_KEY');
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!creatomateApiKey || !elevenlabsApiKey) {
      throw new Error('Missing API keys');
    }

    // Use EdgeRuntime.waitUntil for the background task
    EdgeRuntime.waitUntil(
      startVideoGeneration(
        supabaseClient,
        supabaseUser,
        reel,
        input.photoIds,
        input.videoIds,
        input.scriptId,
        creatomateApiKey,
        elevenlabsApiKey
      ).catch(error => {
        console.error('Error in video generation:', error);
        updateReelStatus(supabaseUser, reel.id, REEL_STATUS.FAILED).catch(console.error);
      })
    );

    return new Response(
      JSON.stringify({
        message: 'Reel creation started',
        reel_id: reel.id,
        status: 200,
        usage: {
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit,
          planName: usageCheck.planName
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in reel creation:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 500
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    );
  }
});

async function startVideoGeneration(
  supabaseClient: any,
  supabaseUser: any,
  reel: any,
  photoIds: string[] | undefined,
  videoIds: string[] | undefined,
  scriptId: string | undefined,
  creatomateApiKey: string,
  elevenlabsApiKey: string
) {
  const startTime = Date.now();
  log('info', 'Video generation function entered', reel.id, {});

  try {
    if (!supabaseClient) throw new Error('Supabase client is undefined');
    if (!supabaseUser) throw new Error('Supabase user client is undefined');
    if (!reel) throw new Error('Reel object is undefined');
    if (!reel.id) throw new Error('Reel ID is undefined');

    // Check for shutdown signal
    if (isShuttingDown) {
      log('info', 'Received shutdown signal at start of video generation', reel.id, {
        elapsed_time: Date.now() - startTime
      });
      return;
    }

    log('info', 'Starting video generation process', reel.id, {
      photo_count: photoIds?.length || 0,
      video_count: videoIds?.length || 0,
      has_script: !!scriptId
    });

    // Update status to processing
    await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.PROCESSING, 10);

    // Check for shutdown signal before audio generation
    if (isShuttingDown) {
      log('info', 'Received shutdown signal before audio generation', reel.id, {
        elapsed_time: Date.now() - startTime
      });
      return;
    }

    // Generate audio if script is provided
    let audioUrl = null;
    let audioTranscription = null;
    if (scriptId) {
      try {
        await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.GENERATING_AUDIO, 30);
        const audioResult = await generateAudio(supabaseUser, reel, scriptId, elevenlabsApiKey);
        audioUrl = audioResult.audioUrl;
        audioTranscription = audioResult.transcription;
      } catch (audioError) {
        log('error', 'Error in audio generation', reel.id, {
          error: audioError instanceof Error ? audioError.message : 'Unknown error'
        });
        // Continue without audio
      }
    }

    // Check for shutdown signal before media processing
    if (isShuttingDown) {
      log('info', 'Received shutdown signal before media processing', reel.id, {
        elapsed_time: Date.now() - startTime
      });
      return;
    }

    // Process media files
    await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.PROCESSING_MEDIA, 45);
    const mediaFiles = await getMediaFiles(supabaseUser, photoIds, videoIds);

    if (mediaFiles.length === 0) {
      throw new Error('No media files were processed successfully');
    }

    log('info', 'Media processing completed', reel.id, {
      processed_count: mediaFiles.length,
      expected_count: (photoIds?.length || 0) + (videoIds?.length || 0),
      duration_ms: Date.now() - startTime
    });

    // Check for shutdown signal before rendering
    if (isShuttingDown) {
      log('info', 'Received shutdown signal before rendering', reel.id, {
        elapsed_time: Date.now() - startTime
      });
      return;
    }

    // Create and send Creatomate request
    await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.RENDERING_PREPARING, 60);

    const orderingStartTime = Date.now();

    log('info', 'Starting media ordering process', reel.id, {
      media_count: mediaFiles.length,
      has_audio: !!audioTranscription
    });

    let orderedMedia;
    let totalDuration = 0;
    
    if (audioTranscription) {
      try {
        orderedMedia = await generateMediaOrder(mediaFiles, audioTranscription, reel.id);
        totalDuration = orderedMedia.total_duration;
        log('info', 'AI-generated media order completed', reel.id, {
          element_count: orderedMedia.elements.length,
          total_duration: orderedMedia.total_duration,
          duration_ms: Date.now() - orderingStartTime
        });
      } catch (error) {
        log('error', 'Failed to generate AI media order, falling back to simple sequence', reel.id, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        orderedMedia = createSimpleMediaSequence(mediaFiles);
        totalDuration = orderedMedia.total_duration;
      }
    } else {
      log('info', 'No audio transcription available, using simple sequence', reel.id);
      orderedMedia = createSimpleMediaSequence(mediaFiles);
      totalDuration = orderedMedia.total_duration;
    }

    // Update the reel with the ordered media
    log('debug', 'Updating reel with ordered media', reel.id, {
      ordered_media_size: JSON.stringify(orderedMedia).length
    });

    await supabaseUser
      .from('reels')
      .update({
        ordered_media: orderedMedia
      })
      .eq('id', reel.id);

    // Prepare the Creatomate request with all elements
    const creatomateRequest = {
      source: {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        fps: 30,
        elements: [
          // Media elements (track 1)
          ...orderedMedia.elements.map(element => ({
            type: element.type === 'image' ? 'image' : 'video',
            source: element.source,
            track: 1,
            time: element.start_time,
            duration: element.duration
          }))
        ]
      }
    };

    // Add audio track if available (track 2)
    if (audioUrl) {
      creatomateRequest.source.elements.push({
        type: 'audio',
        source: audioUrl,
        track: 2,
        time: 0,
        duration: totalDuration
      });
    }

    log('info', 'Media ordering and Creatomate request preparation completed', reel.id, {
      total_elements: creatomateRequest.source.elements.length,
      media_count: mediaFiles.length,
      has_audio: !!audioUrl,
      has_text: false,
      total_duration: totalDuration,
      total_process_time_ms: Date.now() - orderingStartTime,
      request: JSON.stringify(creatomateRequest)
    });

    // Send request to Creatomate
    const renderData = await sendCreatomateRequest(creatomateRequest, creatomateApiKey);
    
    await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.RENDERING_PROCESSING, 75);
    
    // Wait for render completion
    const completedRenders = await waitForRenderCompletion(renderData, creatomateApiKey, reel.id);
    if (!completedRenders.length) {
      throw new Error('No renders completed successfully');
    }

    await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.RENDERING_FINALIZING, 90);

    // Process completed render
    const render = completedRenders[0];
    await processCompletedRender(supabaseUser, reel, render);

    await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.COMPLETED, 100);

    // Increment usage AFTER successful completion
    console.log('Incrementing reels usage for user:', reel.user_id);
    const usageIncremented = await incrementUsage(supabaseUser, reel.user_id, 'reels_per_month', 1);
    
    if (!usageIncremented) {
      console.warn('Failed to increment usage metrics for user:', reel.user_id);
      // Don't fail the request, just log the warning
    }

    log('info', 'Reel generation completed successfully', reel.id, {
      total_duration_ms: Date.now() - startTime
    });
  } catch (error) {
    log('error', 'Video generation process failed', reel.id, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: Date.now() - startTime
    });
    await updateReelStatus(supabaseUser, reel.id, REEL_STATUS.FAILED, 0);
  }
}

async function updateReelStatus(
  supabaseClient: any, 
  reelId: string, 
  status: ReelStatus, 
  progressPercentage?: number
) {
  try {
    const updateData: Record<string, any> = {
      status
    };
    
    if (progressPercentage !== undefined) {
      updateData.progress_percentage = progressPercentage;
    }

    const { error: statusError } = await supabaseClient
      .from('reels')
      .update(updateData)
      .eq('id', reelId);

    if (statusError) {
      throw statusError;
    }

    log('info', `Updated reel status to ${status}`, reelId, {
      progress_percentage: progressPercentage
    });
  } catch (error) {
    log('error', `Failed to update reel status to ${status}`, reelId, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

interface AudioGenerationResult {
  audioUrl: string;
  transcription: ElevenLabsTranscription;
}

async function generateAudio(
  supabaseClient: any,
  reel: any,
  scriptId: string,
  elevenlabsApiKey: string
): Promise<AudioGenerationResult> {
  log('info', 'Starting audio generation', reel.id, { script_id: scriptId });

  // We need both clients - the passed client should be the user client for database operations
  // We need service client for storage operations
  const serviceClient = initSupabase();

  const { data: script, error: scriptError } = await supabaseClient
    .from('scripts')
    .select('content, title')
    .eq('id', scriptId)
    .single();

  if (scriptError) {
    throw scriptError;
  }

  // Initialize ElevenLabs client
  const elevenLabsClient = new ElevenLabsClient({
    apiKey: elevenlabsApiKey
  });

  // Generate audio from text
  const audioResponse = await fetch(
    'https://api.elevenlabs.io/v1/text-to-speech/kPzsL2i3teMYv0FxEYQ6?output_format=mp3_44100_128',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsApiKey
      },
      body: JSON.stringify({
        text: script.content,
        model_id: 'eleven_multilingual_v2',

      })
    }
  );

  if (!audioResponse.ok) {
    const errorText = await audioResponse.text();
    throw new Error(`ElevenLabs API error: ${audioResponse.status} ${errorText}`);
  }

  const audioBlob = await audioResponse.blob();
  const timestamp = new Date().getTime();
  const audioFileName = `${reel.user_id}/${reel.id}-${timestamp}.mp3`;

  // Generate transcription
  log('info', 'Starting audio transcription', reel.id, {});
  
  try {
    const transcription = await elevenLabsClient.speechToText.convert({
      file: audioBlob,
      model_id: "scribe_v1",
      tag_audio_events: true,
      language_code: "eng",
      diarize: true
    });

    log('info', 'Transcription completed', reel.id, {
      transcription_length: transcription.text.length
    });

    // Upload audio file using service client (storage operations don't need RLS)
    const { error: uploadError } = await serviceClient.storage
      .from('audio')
      .upload(audioFileName, audioBlob, {
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: audioSignedUrl } = await serviceClient.storage
      .from('audio')
      .createSignedUrl(audioFileName, 3600);

    if (!audioSignedUrl?.signedUrl) {
      throw new Error('Failed to generate signed URL for audio');
    }

    // Create audio record with transcription using user client (database operations need RLS)
    const { error: audioError } = await supabaseClient
      .from('audio')
      .insert({
        reel_id: reel.id,
        script_id: scriptId,
        file_path: `audio/${audioFileName}`,
        file_name: audioFileName,
        user_id: reel.user_id,
        transcription: transcription
      });

    if (audioError) {
      throw audioError;
    }

    log('info', 'Audio generation and transcription completed', reel.id, {
      file_name: audioFileName,
      has_transcription: true
    });

    return {
      audioUrl: audioSignedUrl.signedUrl,
      transcription
    };
  } catch (error) {
    log('error', 'Failed to process audio or transcription', reel.id, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

async function processPhotos(
  supabaseClient: any,
  reelId: string,
  photoIds: string[]
): Promise<MediaFile[]> {
  const mediaFiles: MediaFile[] = [];

  const { data: photos, error: photosError } = await supabaseClient
    .from('photos')
    .select('id, file_path, description')
    .in('id', photoIds);

  if (photosError) {
    throw photosError;
  }

  for (const photo of photos || []) {
    try {
      const storagePath = getStoragePath(photo.file_path);
      const { data: signedUrl } = await supabaseClient.storage
        .from('media')
        .createSignedUrl(storagePath, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to generate signed URL');
      }

      mediaFiles.push({
        type: 'image',
        source: signedUrl.signedUrl,
        originalPath: photo.file_path,
        description: photo.description || 'No description available',
        originalDuration: undefined // Photos don't have duration
      });

      log('info', 'Processed photo', reelId, {
        photo_id: photo.id,
        original_path: photo.file_path,
        storage_path: storagePath,
        has_description: !!photo.description
      });
    } catch (error) {
      log('error', 'Failed to process photo', reelId, {
        photo_id: photo.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return mediaFiles;
}

async function processVideos(
  supabaseClient: any,
  reelId: string,
  videoIds: string[]
): Promise<MediaFile[]> {
  const mediaFiles: MediaFile[] = [];

  const { data: videos, error: videosError } = await supabaseClient
    .from('videos')
    .select('id, file_path, duration')
    .in('id', videoIds);

  if (videosError) {
    throw videosError;
  }

  for (const video of videos || []) {
    try {
      const storagePath = getStoragePath(video.file_path);
      const { data: signedUrl } = await supabaseClient.storage
        .from('media')
        .createSignedUrl(storagePath, 3600);

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to generate signed URL');
      }

      mediaFiles.push({
        type: 'video',
        source: signedUrl.signedUrl,
        originalPath: video.file_path,
        description: 'Video content',
        originalDuration: video.duration
      });

      log('info', 'Processed video', reelId, {
        video_id: video.id,
        original_path: video.file_path,
        storage_path: storagePath,
        original_duration: video.duration
      });
    } catch (error) {
      log('error', 'Failed to process video', reelId, {
        video_id: video.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return mediaFiles;
}

function createCreatomateRequest(
  mediaFiles: MediaFile[],
  audioUrl: string | null
): CreatomateRequest {
  log('info', 'Creating Creatomate request', null, {
    total_media_files: mediaFiles.length,
    media_types: mediaFiles.map(m => m.type),
    has_audio: !!audioUrl
  });

  const request = {
    source: {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      elements: [
        ...mediaFiles.map((media, index) => {
          const elementType = media.type === 'video' ? 'video' : 'image';
          log('info', 'Adding media element', null, {
            original_type: media.type,
            creatomate_type: elementType,
            index,
            time: index * 5
          });
          return {
            type: elementType,
          source: media.source,
          track: 1,
          time: index * 5,
          duration: 5
          };
        }),
        ...(audioUrl ? [{
          type: 'audio',
          source: audioUrl,
          track: 2,
          time: 0,
          duration: mediaFiles.length * 5
        }] : [])
      ]
    }
  };

  log('info', 'Creatomate request created', null, {
    total_elements: request.source.elements.length,
    element_types: request.source.elements.map(e => e.type)
  });

  return request;
}

async function sendCreatomateRequest(
  request: CreatomateRequest,
  creatomateApiKey: string
) {
  const response = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creatomateApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Creatomate API error: ${response.status} ${errorText}`);
  }

  return JSON.parse(await response.text());
}

async function waitForRenderCompletion(renders: any[], creatomateApiKey: string, reelId: string) {
  const startTime = Date.now();
  const render = renders[0];
  let lastStatus = '';
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  while (Date.now() - startTime < MAX_POLL_TIME) {
    // Check for shutdown signal
    if (isShuttingDown) {
      log('info', 'Received shutdown signal during render wait', reelId, {
        render_id: render.id,
        last_status: lastStatus,
        elapsed_time: Date.now() - startTime
      });
      return [];
    }

    try {
      const response = await fetch(
        `https://api.creatomate.com/v1/renders/${render.id}`,
        {
          headers: {
            'Authorization': `Bearer ${creatomateApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        consecutiveErrors++;
        log('error', 'Error checking render status', reelId, {
          render_id: render.id,
          status: response.status,
          errors: consecutiveErrors
        });

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          throw new Error(`Failed to check render status after ${MAX_CONSECUTIVE_ERRORS} attempts`);
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      consecutiveErrors = 0;
      const renderStatus = JSON.parse(await response.text());

      if (renderStatus.status !== lastStatus) {
        log('info', 'Render status changed', reelId, {
          render_id: render.id,
          status: renderStatus.status,
          previous: lastStatus
        });
        lastStatus = renderStatus.status;
      }

      if (COMPLETED_STATUSES.includes(renderStatus.status)) {
        log('info', 'Render completed', reelId, {
          render_id: render.id,
          url: renderStatus.url,
          duration_ms: Date.now() - startTime
        });
        return [renderStatus];
      }

      if (renderStatus.status === 'failed') {
        log('error', 'Render failed', reelId, {
          render_id: render.id,
          error: renderStatus.error
        });
        return [];
      }

      if (!IN_PROGRESS_STATUSES.includes(renderStatus.status)) {
        log('info', `Unrecognized status '${renderStatus.status}' treated as in-progress`, reelId, {
          render_id: render.id,
          status: renderStatus.status
        });
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      consecutiveErrors++;
      log('error', 'Error in render status check', reelId, {
        render_id: render.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        errors: consecutiveErrors
      });

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        return [];
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  log('error', 'Render timed out', reelId, {
    render_id: render.id,
    timeout_ms: MAX_POLL_TIME,
    last_status: lastStatus
  });

  return [];
}

async function addSubtitlesToVideo(
  render: any,
  audioTranscription: ElevenLabsTranscription | null,
  creatomateApiKey: string,
  reelId: string
): Promise<any> {
  if (!audioTranscription) {
    log('info', 'No transcription available, skipping subtitles', reelId, {});
    return render;
  }

  log('info', 'Starting subtitle addition process', reelId, {
    original_render_url: render.url
  });

  const subtitleRequest = {
    output_format: 'mp4',
    source: {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      fps: 30,
      elements: [
        {
          type: 'video',
          source: render.url,
          track: 1,
          time: 0,
          duration: render.duration
        },
        {
          type: 'text',
          transcript_source: render.url,
          transcript_effect: 'color',
          transcript_maximum_length: 14,
          y: '82%',
          width: '81%',
          height: '35%',
          x_alignment: '50%',
          y_alignment: '50%',
          fill_color: '#ffffff',
          transcript_color: '#ffffff',
          stroke_color: '#000000',
          stroke_width: '0.5 vmin',
          font_family: 'Aileron',
          font_weight: '700',
          font_size: '4 vmin',
          background_color: 'rgba(0,0,0,0)',
          background_x_padding: '0%',
          background_y_padding: '0%',
          background_border_radius: '5%',
          track: 2,
          time: 0,
          duration: render.duration
        }
      ]
    }
  };

  try {
    log('info', 'Sending subtitle render request', reelId, {
      request: JSON.stringify(subtitleRequest)
    });

    const subtitleRender = await sendCreatomateRequest(subtitleRequest, creatomateApiKey);
    
    log('info', 'Waiting for subtitle render completion', reelId, {
      render_id: subtitleRender[0].id
    });

    const completedRenders = await waitForRenderCompletion(subtitleRender, creatomateApiKey, reelId);
    if (!completedRenders.length) {
      throw new Error('Subtitle render failed to complete');
    }

    log('info', 'Subtitle addition completed', reelId, {
      final_render_url: completedRenders[0].url
    });

    return completedRenders[0];
  } catch (error) {
    log('error', 'Failed to add subtitles', reelId, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Return original render if subtitle addition fails
    return render;
  }
}

async function processCompletedRender(
  supabaseClient: any,
  reel: any,
  render: any
) {
  try {
    // Get the creatomate API key
    const creatomateApiKey = Deno.env.get('CREATOMATE_API_KEY');
    if (!creatomateApiKey) {
      throw new Error('Missing CREATOMATE_API_KEY');
    }

    // Initialize service client for storage operations
    const serviceClient = initSupabase();

    // Get the audio transcription if it exists (using user client for database)
    const { data: audioData } = await supabaseClient
      .from('audio')
      .select('transcription')
      .eq('reel_id', reel.id)
      .single();

    const audioTranscription = audioData?.transcription || null;

    // Add subtitles to the video
    const finalRender = await addSubtitlesToVideo(render, audioTranscription, creatomateApiKey, reel.id);

    log('info', 'Starting video download', reel.id, {
      render_url: finalRender.url
    });

    const videoResponse = await fetch(finalRender.url);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status} ${await videoResponse.text()}`);
    }

    const videoBlob = await videoResponse.blob();
    const contentLength = videoResponse.headers.get('content-length');
    const contentType = videoResponse.headers.get('content-type');

    // Log video details before upload
    log('info', 'Preparing video upload', reel.id, {
      content_length: contentLength,
      content_type: contentType,
      blob_size: videoBlob.size,
      blob_type: videoBlob.type,
      bucket_config: {
        file_size_limit: 104857600,
        allowed_mime_types: ['video/mp4']
      }
    });

    const timestamp = new Date().getTime();
    const filename = `${reel.user_id}/${reel.id}-${timestamp}.mp4`;

    // Verify the bucket exists before upload (using service client)
    const { data: buckets, error: bucketError } = await serviceClient
      .storage
      .listBuckets();

    if (bucketError) {
      log('error', 'Failed to list buckets', reel.id, {
        error: bucketError.message,
        code: bucketError.statusCode,
        details: bucketError.details
      });
      throw new Error(`Failed to list buckets: ${bucketError.message}`);
    }

    const generatedReelsBucket = buckets.find((b: { name: string }) => b.name === 'generated-reels');
    if (!generatedReelsBucket) {
      throw new Error('generated-reels bucket not found');
    }

    log('info', 'Uploading video to storage', reel.id, {
      filename,
      bucket: 'generated-reels',
      content_type: contentType,
      content_length: contentLength,
      bucket_details: generatedReelsBucket
    });

    // Try upload with explicit error handling (using service client for storage)
    try {
      const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from('generated-reels')
    .upload(filename, videoBlob, {
      contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: false
    });

  if (uploadError) {
        log('error', 'Failed to upload video', reel.id, {
          error: uploadError.message,
          code: uploadError.statusCode,
          details: uploadError.details,
          file_info: {
            size: videoBlob.size,
            type: videoBlob.type,
            name: filename
          }
        });
    throw uploadError;
  }

      // Verify upload success by trying to get URL immediately (using service client)
      const { data: urlData, error: urlError } = await serviceClient.storage
        .from('generated-reels')
        .createSignedUrl(filename, 3600);

      if (urlError || !urlData?.signedUrl) {
        log('error', 'Failed to verify uploaded file', reel.id, {
          error: urlError?.message || 'No signed URL returned',
          upload_data: uploadData
        });
        throw new Error(`Failed to verify uploaded file: ${urlError?.message || 'No signed URL returned'}`);
      }

      log('info', 'Video upload verified', reel.id, {
        signed_url: urlData.signedUrl,
        upload_data: uploadData
      });

      // Update reel record (using user client for database operations)
  const { error: updateError } = await supabaseClient
    .from('reels')
    .update({
      status: REEL_STATUS.COMPLETED,
      storage_path: `generated-reels/${filename}`,
          file_name: filename,
          duration: Number(render.duration)
    })
    .eq('id', reel.id);

  if (updateError) {
        log('error', 'Failed to update reel record', reel.id, {
          error: updateError.message,
          code: updateError.code,
          details: updateError.details,
          update_data: {
            storage_path: `generated-reels/${filename}`,
            duration: Number(render.duration)
          }
        });
    throw updateError;
      }

      log('info', 'Reel record updated successfully', reel.id, {
        status: REEL_STATUS.COMPLETED,
        storage_path: `generated-reels/${filename}`,
        duration: Number(render.duration)
      });

    } catch (error) {
      log('error', 'Error in upload process', reel.id, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        blob_info: {
          size: videoBlob.size,
          type: videoBlob.type
        }
      });
      throw error;
    }
  } catch (error) {
    log('error', 'Error in processCompletedRender', reel.id, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

function log(
  level: 'info' | 'error' | 'debug' | 'warn',
  message: string,
  reelId: string | null = null,
  details: Record<string, unknown> = {}
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(reelId && { reel_id: reelId }),
    ...details
  }

  console.log(JSON.stringify(logEntry))
}

// New interface for ordered media
interface OrderedMediaElement {
  id: string;
  type: 'image' | 'video';
  start_time: number;
  duration: number;
  source: string;
  description?: string;
}

interface OrderedMediaResponse {
  elements: OrderedMediaElement[];
  total_duration: number;
}

// New function to generate media order
async function generateMediaOrder(
  mediaFiles: MediaFile[],
  transcription: ElevenLabsTranscription,
  reelId: string
): Promise<OrderedMediaResponse> {
  const startTime = Date.now()
  
  // Validate transcription data
  if (!transcription.words || transcription.words.length === 0) {
    log('error', 'Invalid transcription data', reelId, {
      has_words: !!transcription.words,
      word_count: transcription.words?.length || 0
    })
    throw new Error('Invalid transcription data: missing word timing information')
  }

  // Calculate total audio duration
  const totalAudioDuration = transcription.words[transcription.words.length - 1].end
  
  log('info', 'Starting media order generation', reelId, {
    media_count: mediaFiles.length,
    transcription_words: transcription.words.length,
    total_audio_duration: totalAudioDuration,
    media_types: mediaFiles.map(f => f.type)
  })

  // Prepare media descriptions with proper IDs and duration constraints
  const mediaDescriptions = mediaFiles.map(file => {
    const id = file.originalPath.match(/(?:photos|videos)\/[^\/]+\/([^\/\.]+)/)?.[1] || file.originalPath
    
    log('debug', 'Processing media file for ordering', reelId, {
      id,
      type: file.type,
      has_description: !!file.description,
      description_length: file.description?.length || 0,
      original_duration: file.originalDuration
    })

    return {
      id,
      type: file.type,
      source: file.source,
      description: file.description || 'No description available',
      maxDuration: file.originalDuration || null // Include max duration constraint for videos
    }
  })

  const systemPrompt = `You are an AI expert in creating engaging social media content. Your task is to analyze the provided audio transcription and media files to create the most engaging visual sequence for a TikTok video.

Key requirements:
1. Create a sequence that matches the audio duration of ${totalAudioDuration.toFixed(1)} seconds
2. Each media element must be shown for at least 2 seconds
3. For videos with maxDuration specified, NEVER assign a duration longer than that value
4. Images can be shown for any duration (minimum 2 seconds)
5. Use all provided media at least once
6. Return a valid JSON object with media elements and total duration

CRITICAL: Videos have physical duration limits. If a video's maxDuration is 3.5 seconds, you cannot show it for 5 seconds - it will cause playback issues.

Example response format:
{
  "elements": [
    {
      "id": "image-123",
      "type": "image", 
      "start_time": 0,
      "duration": 4,
      "source": "url"
    },
    {
      "id": "video-456",
      "type": "video",
      "start_time": 4,
      "duration": 3.2,
      "source": "url"
    }
  ],
  "total_duration": ${totalAudioDuration.toFixed(1)}
}

Do not include any explanations or text before or after the JSON.`

  const prompt = `INSTRUCTIONS:
1. Create an optimal media sequence that covers the entire audio duration of ${totalAudioDuration.toFixed(1)} seconds
2. Each media element must be shown for at least 2 seconds
3. CRITICAL VIDEO CONSTRAINT: For any video with a maxDuration value, NEVER assign a duration longer than that maxDuration
   - Example: If video has maxDuration: 4.2, maximum assignable duration is 4.2 seconds
   - Example: If video has maxDuration: null (image), no duration limit applies
4. Use the most relevant media for the content (you can reuse media if needed to fill time, but don't need to use all photos if there are too many)
5. Align visuals with relevant spoken content when possible
6. Return ONLY a JSON object with this structure:

{
  "elements": [
    {
      "id": "media-id",
      "type": "image|video",
      "start_time": number,
      "duration": number (minimum 2, NEVER exceed maxDuration for videos),
      "source": "url"
    }
  ],
  "total_duration": number
}

DURATION CONSTRAINT EXAMPLES:
- Video with maxDuration: 3.5 → Can assign 2.0, 3.0, or 3.5 seconds (never 4.0+)
- Video with maxDuration: 8.0 → Can assign 2.0 to 8.0 seconds  
- Image with maxDuration: null → Can assign any duration (minimum 2.0 seconds)

Do not include any explanations or text before or after the JSON.

AVAILABLE MEDIA WITH DURATION CONSTRAINTS:
${JSON.stringify(mediaDescriptions, null, 2)}

AUDIO TRANSCRIPTION TO SYNC WITH:
${JSON.stringify(transcription.words, null, 2)}`

  try {
    const falKey = Deno.env.get('FAL_API_KEY')
    if (!falKey) {
      log('error', 'Missing FAL_API_KEY', reelId)
      throw new Error('Missing FAL_API_KEY')
    }

    log('info', 'Calling fal.ai for media ordering', reelId, {
      prompt_length: prompt.length,
      media_count: mediaDescriptions.length,
      system_prompt_length: systemPrompt.length
    })

    const response = await fetch('https://fal.run/fal-ai/any-llm', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        prompt,
        system_prompt: systemPrompt,
        format: 'json'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      log('error', 'Failed to generate media order', reelId, {
        status: response.status,
        error: errorText
      })
      throw new Error(`Failed to generate media order: ${errorText}`)
    }

    const result = await response.json()
    
    // Extract and normalize the JSON response
    let orderedMedia: OrderedMediaResponse | null = null
    try {
      // Parse the response if it's a string
      const parsedOutput = typeof result.output === 'string' ? JSON.parse(result.output) : result.output

      // Normalize the response
      orderedMedia = {
        elements: parsedOutput.elements.map((element: any) => {
          const originalMedia = mediaFiles.find(m => m.originalPath.includes(element.id));
          let duration = Math.max(2, Number(element.duration));
          
          // For videos, cap duration at original video length
          if (element.type === 'video' && originalMedia?.originalDuration) {
            duration = Math.min(duration, originalMedia.originalDuration);
            log('info', 'Capped video duration', reelId, {
              video_id: element.id,
              requested_duration: Number(element.duration),
              original_duration: originalMedia.originalDuration,
              final_duration: duration
            });
          }
          
          return {
            id: String(element.id),
            type: element.type === 'video' ? 'video' : 'image',
            start_time: Number(element.start_time),
            duration,
            source: element.source || originalMedia?.source || ''
          };
        }),
        total_duration: Number(parsedOutput.total_duration)
      }

      // Sort elements by start_time
      orderedMedia.elements.sort((a, b) => a.start_time - b.start_time)

      // Adjust durations to ensure no gaps and proper total duration
      let currentTime = 0
      orderedMedia.elements = orderedMedia.elements.map((element, index) => {
        element.start_time = currentTime
        if (index === orderedMedia!.elements.length - 1) {
          // Last element should extend to total duration
          element.duration = Math.max(2, totalAudioDuration - currentTime)
        }
        currentTime += element.duration
        return element
      })

      // Ensure total duration matches audio
      orderedMedia.total_duration = totalAudioDuration

      log('info', 'AI-generated media order completed', reelId, {
        element_count: orderedMedia.elements.length,
        total_duration: orderedMedia.total_duration,
        duration_ms: Date.now() - startTime
      })

      return orderedMedia
    } catch (parseError) {
      log('error', 'Failed to parse or normalize AI response', reelId, {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        raw_output: result.output
      })
      throw new Error('Failed to parse AI response')
    }
  } catch (error) {
    log('error', 'Error in media order generation', reelId, {
      error: error instanceof Error ? error.message : 'Unknown error',
      will_retry: true,
      generation_time_ms: Date.now() - startTime
    })

    // Fall back to simple media order
    return createSimpleMediaSequence(mediaFiles)
  }
}

// Helper function to validate the ordered media structure
function validateOrderedMedia(
  orderedMedia: unknown,
  expectedDuration: number
): orderedMedia is OrderedMediaResponse {
  if (!orderedMedia || typeof orderedMedia !== 'object') {
    log('error', 'Invalid media order: not an object', null, { received: typeof orderedMedia })
    return false
  }

  const response = orderedMedia as OrderedMediaResponse
  
  if (!Array.isArray(response.elements)) {
    log('error', 'Invalid media order: elements is not an array', null, { elements: response.elements })
    return false
  }
  
  if (typeof response.total_duration !== 'number') {
    log('error', 'Invalid media order: total_duration is not a number', null, { total_duration: response.total_duration })
    return false
  }

  // Validate each element
  for (const element of response.elements) {
    // Check required fields and types
    if (typeof element.id !== 'string' ||
        (element.type !== 'image' && element.type !== 'video') ||
        typeof element.start_time !== 'number' ||
        typeof element.duration !== 'number' ||
        typeof element.source !== 'string') {
      log('error', 'Invalid media order: invalid element structure', null, { element })
      return false
    }

    // Check duration constraints
    if (element.duration < 2) {
      log('error', 'Invalid media order: duration too short', null, {
        element_id: element.id,
        duration: element.duration
      })
      return false
    }
  }

  // Sort elements by start time
  response.elements.sort((a, b) => a.start_time - b.start_time)

  // Check for basic coverage
  if (response.elements.length === 0) {
    log('error', 'Invalid media order: no elements', null)
    return false
  }

  // Check if total duration is reasonable
  const calculatedDuration = response.elements.reduce((total, element) => 
    Math.max(total, element.start_time + element.duration), 0)
  
  if (Math.abs(calculatedDuration - expectedDuration) > 1) {
    log('error', 'Invalid media order: duration mismatch', null, {
      expected: expectedDuration,
      calculated: calculatedDuration
    })
    return false
  }

  return true
}

// Add helper function for creating simple sequence
function createSimpleMediaSequence(mediaFiles: MediaFile[]): OrderedMediaResponse {
  // Calculate duration per media to fit the total duration
  const totalDuration = mediaFiles.length * 3 // 3 seconds per media as a base
  const durationPerMedia = Math.max(2, Math.floor(totalDuration / mediaFiles.length))

  const elements = mediaFiles.map((file, index) => {
    const startTime = index * durationPerMedia
    const duration = durationPerMedia

    return {
      id: file.originalPath.match(/(?:photos|videos)\/[^\/]+\/([^\/\.]+)/)?.[1] || file.originalPath,
      type: file.type,
      start_time: startTime,
      duration: duration,
      source: file.source
    }
  })

  return {
    elements,
    total_duration: totalDuration
  }
}

async function generateSimpleMediaOrder(
  mediaFiles: MediaFile[],
  transcription: ElevenLabsTranscription,
  reelId: string
): Promise<OrderedMediaResponse> {
  log('info', 'Generating simple media order', reelId, {
    media_count: mediaFiles.length,
    transcription_length: transcription.text.length
  })

  const totalDuration = Number(transcription.words[transcription.words.length - 1].end.toFixed(1))
  const durationPerMedia = Math.max(2.0, Number((totalDuration / mediaFiles.length).toFixed(1)))

  const elements = mediaFiles.map((file, index) => {
    const startTime = Number((index * durationPerMedia).toFixed(1))
    const duration = Number(Math.min(
      durationPerMedia,
      totalDuration - startTime
    ).toFixed(1))

    return {
      id: file.originalPath.match(/(?:photos|videos)\/[^\/]+\/([^\/\.]+)/)?.[1] || file.originalPath,
      type: file.type,
      start_time: startTime,
      duration: duration,
      source: file.source,
      description: file.description
    }
  })

  log('info', 'Simple media order generated', reelId, {
    element_count: elements.length,
    total_duration: totalDuration
  })

  return {
    elements,
    total_duration: totalDuration
  }
}
