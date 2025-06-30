-- Script to populate the voices table with 5 curated ElevenLabs voices
-- This provides good variety in gender, accent, and style while keeping the selection manageable

-- Add 4 additional voices to complement the default Brittney voice
INSERT INTO public.voices (voice_id, name, description, category, gender, age, accent, use_case, descriptive, preview_url, is_active, is_default) VALUES

-- Asian male voice - energetic and professional
('DkVHY251JcjFstLRlihO', 'Yu - Energetic Asian Voice', 'Yu is a vibrant, upbeat voice with a youthful Taiwanese accent, characterized by its energetic tone and engaging delivery. Perfect for tutorials, podcasts, and social media.', 'professional', 'male', 'young', 'chinese', 'informative_educational', 'energetic', 'https://storage.googleapis.com/eleven-public-prod/database/user/edcdXfKILUORFbr4m7ljfvMro0M2/voices/DkVHY251JcjFstLRlihO/qNMNT4907G6H45Qo2cb7.mp3', true, false),

-- British female voice - professional and clear
('Xb7hH8MSUJpSbSDYk0k2', 'Alice - British Professional', 'Clear and engaging, friendly woman with a British accent suitable for e-learning, advertisements, and professional content.', 'premade', 'female', 'middle_aged', 'british', 'advertisement', 'professional', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3', true, false),

-- Australian male voice - confident and energetic  
('IKne3meq5aSn9XLyUdCD', 'Charlie - Australian Energetic', 'A young Australian male with a confident and energetic voice, perfect for conversational content and social media.', 'premade', 'male', 'young', 'australian', 'conversational', 'confident', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3', true, false),

-- Neutral American voice - calm and versatile
('SAz9YHcvj6GT2YYXdXww', 'River - Neutral Calm', 'A relaxed, neutral voice ready for narrations or conversational projects. Great for accessible content.', 'premade', 'neutral', 'middle_aged', 'american', 'conversational', 'calm', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3', true, false)

ON CONFLICT (voice_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    gender = EXCLUDED.gender,
    age = EXCLUDED.age,
    accent = EXCLUDED.accent,
    use_case = EXCLUDED.use_case,
    descriptive = EXCLUDED.descriptive,
    preview_url = EXCLUDED.preview_url,
    is_active = EXCLUDED.is_active,
    updated_at = timezone('utc'::text, now());

-- Show final voice selection
SELECT 
    voice_id,
    name,
    gender,
    accent,
    use_case,
    descriptive,
    is_default
FROM public.voices 
WHERE is_active = true
ORDER BY is_default DESC, accent, name; 