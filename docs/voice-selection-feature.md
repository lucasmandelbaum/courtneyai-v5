# Voice Selection Feature for Reel Generation

## Overview

The `generate-reel` edge function now supports voice selection for text-to-speech audio generation. Users can specify which ElevenLabs voice to use when generating reels with script audio.

## Database Setup

### 1. Run the Migration

First, apply the migration to create the voices table:

```bash
npx supabase migration up
```

### 2. Populate Voice Options (Optional)

To add more voice options beyond the default set, run the population script:

```sql
-- In Supabase Dashboard SQL Editor or via CLI
\i supabase/scripts/populate_voices.sql
```

## API Usage

### Request Format

The reel generation request now accepts an optional `voiceId` parameter:

```typescript
interface ReelInput {
  productId: string;
  scriptId?: string;
  photoIds?: string[];
  videoIds?: string[];
  title: string;
  fontSize?: 'small' | 'medium' | 'large';
  voiceId?: string; // Optional ElevenLabs voice ID
}
```

### Example Usage

```javascript
// Using default voice (Brittney)
const response = await fetch('/api/edge/generate-reel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    productId: 'product-123',
    scriptId: 'script-456',
    photoIds: ['photo-1', 'photo-2'],
    title: 'My Product Reel'
  })
});

// Using a specific voice
const response = await fetch('/api/edge/generate-reel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    productId: 'product-123',
    scriptId: 'script-456',
    photoIds: ['photo-1', 'photo-2'],
    title: 'My Product Reel',
    voiceId: 'TX3LPaxmHKxFdv7VOQHJ' // Liam - energetic male voice
  })
});
```

## Voice Management

### Getting Available Voices

Query the voices table to get available options:

```sql
SELECT voice_id, name, description, gender, age, accent, use_case, descriptive, preview_url
FROM public.voices 
WHERE is_active = true 
ORDER BY 
  CASE WHEN is_default THEN 0 ELSE 1 END,
  category,
  name;
```

### Adding New Voices

To add a new voice to the system:

```sql
INSERT INTO public.voices (
  voice_id, name, description, category, gender, age, accent, 
  use_case, descriptive, preview_url, is_active
) VALUES (
  'your-voice-id-here',
  'Voice Name',
  'Voice description',
  'professional', -- or 'premade', 'cloned', 'generated'
  'female', -- or 'male', 'neutral'
  'young', -- or 'middle_aged', 'old'
  'american', -- or 'british', 'australian', etc.
  'social_media', -- or 'narration', 'news', etc.
  'energetic', -- descriptive adjective
  'https://preview-url.com/audio.mp3',
  true
);
```

### Setting a New Default Voice

To change the default voice:

```sql
-- Remove default from current voice
UPDATE public.voices SET is_default = false WHERE is_default = true;

-- Set new default
UPDATE public.voices SET is_default = true WHERE voice_id = 'new-default-voice-id';
```

## Voice Categories

The system includes several voice categories:

- **Social Media Voices**: Optimized for short-form content (TikTok, Instagram Reels)
- **Professional Voices**: Clear, articulate voices for business content
- **Narrative Voices**: Storytelling and audiobook-style voices
- **Character Voices**: Unique personalities for entertainment content

## Popular Voice Options

### Social Media
- **Brittney** (`kPzsL2i3teMYv0FxEYQ6`) - *Default* - Fun, youthful female
- **Liam** (`TX3LPaxmHKxFdv7VOQHJ`) - Energetic young male
- **Laura** (`FGY2WhTYpPnrIDTdsKH5`) - Sassy young female
- **Bianca** (`2bk7ULW9HfwvcIbMWod0`) - City girl, alluring female

### Professional
- **George** (`JBFqnCBsd6RMkjVDRZzb`) - Warm British male narrator
- **Sarah** (`EXAVITQu4vr4xnSDxMaL`) - Professional American female
- **Alice** (`Xb7hH8MSUJpSbSDYk0k2`) - Clear British female for e-learning

## Fallback Behavior

The system includes robust fallback behavior:

1. **Requested voice ID provided**: Validates the voice exists and is active
2. **Invalid/inactive voice**: Falls back to the database default voice
3. **No default in database**: Falls back to hardcoded default (Brittney)

## Logging

The system logs voice selection decisions for debugging:

```javascript
log('info', 'Using voice for audio generation', reel.id, {
  requested_voice_id: voiceId,
  selected_voice_id: selectedVoiceId
});
```

## Frontend Integration

When building a voice selection UI, consider:

1. **Categorization**: Group voices by use case or demographic
2. **Preview**: Allow users to listen to voice samples
3. **Filtering**: Filter by gender, accent, age, or use case
4. **Default Selection**: Pre-select the default voice
5. **Fallback Display**: Show what voice will be used if selection fails

## Error Handling

The edge function gracefully handles voice selection errors:

- Invalid voice IDs log warnings and use fallback
- Missing voice table falls back to hardcoded default
- Audio generation continues even if voice selection fails

## Performance Considerations

- Voice validation adds one database query per reel generation
- Consider caching voice lists in frontend applications
- Voice preview URLs are external and may affect load times 