-- Create voices table to store ElevenLabs voice information
CREATE TABLE IF NOT EXISTS public.voices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    voice_id TEXT UNIQUE NOT NULL, -- ElevenLabs voice_id
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- e.g., 'professional', 'premade', 'cloned', 'generated'
    gender TEXT, -- 'male', 'female', 'neutral'
    age TEXT, -- 'young', 'middle_aged', 'old'
    accent TEXT, -- 'american', 'british', 'australian', etc.
    use_case TEXT, -- 'social_media', 'narration', 'news', etc.
    descriptive TEXT, -- 'upbeat', 'calm', 'energetic', etc.
    preview_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS voices_voice_id_idx ON public.voices(voice_id);
CREATE INDEX IF NOT EXISTS voices_category_idx ON public.voices(category);
CREATE INDEX IF NOT EXISTS voices_is_active_idx ON public.voices(is_active);
CREATE INDEX IF NOT EXISTS voices_is_default_idx ON public.voices(is_default);

-- Enable RLS
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all authenticated users
CREATE POLICY "Allow read access to voices for authenticated users" ON public.voices
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert the current default voice and some popular options
INSERT INTO public.voices (voice_id, name, description, category, gender, age, accent, use_case, descriptive, preview_url, is_active, is_default) VALUES
-- Current default voice
('kPzsL2i3teMYv0FxEYQ6', 'Brittney - Social Media Voice - Fun, Youthful & Informative', 'A young, vibrant female voice that is perfect for celebrity news, hot topics, and fun conversation. Great for YouTube channels, informative videos, how-to''s, and more!', 'professional', 'female', 'young', 'american', 'social_media', 'upbeat', 'https://storage.googleapis.com/eleven-public-prod/custom/voices/kPzsL2i3teMYv0FxEYQ6/4sLh92VdgT3Hppimhb4W.mp3', true, true),

-- Popular social media voices
('FGY2WhTYpPnrIDTdsKH5', 'Laura', 'This young adult female voice delivers sunny enthusiasm with a quirky attitude.', 'premade', 'female', 'young', 'american', 'social_media', 'sassy', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/FGY2WhTYpPnrIDTdsKH5/67341759-ad08-41a5-be6e-de12fe448618.mp3', true, false),

('TX3LPaxmHKxFdv7VOQHJ', 'Liam', 'A young adult with energy and warmth - suitable for reels and shorts.', 'premade', 'male', 'young', 'american', 'social_media', 'confident', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/63148076-6363-42db-aea8-31424308b92c.mp3', true, false),

('2bk7ULW9HfwvcIbMWod0', 'Bianca - City girl', 'A Breezy & Alluring young female from New York. Great for social media and content creation.', 'professional', 'female', 'young', 'american', 'social_media', 'sassy', 'https://storage.googleapis.com/eleven-public-prod/custom/voices/2bk7ULW9HfwvcIbMWod0/wIaDd6Rf2tjOGD9UbOJF.mp3', true, false),

('8DzKSPdgEQPaK5vKG0Rs', 'Vanessa - Beach Girl', 'A cute voice perfect for social media.', 'professional', 'female', 'young', 'american', 'social_media', 'cute', 'https://storage.googleapis.com/eleven-public-prod/database/user/pJj966DxwEg3jXdcUkoTbMzkPsL2/voices/8DzKSPdgEQPaK5vKG0Rs/AeRt8yvbNanY84fSNvRc.mp3', true, false),

('umKoJK6tP1ALjO0zo1EE', 'Adina - Teen Girl', 'Adolescent teen girl with a warm voice. Works well for Social media.', 'professional', 'female', 'young', 'canadian', 'social_media', 'neutral', 'https://storage.googleapis.com/eleven-public-prod/XZGGrr0Cr7Q9yExDbvU4mz2hcvB2/voices/umKoJK6tP1ALjO0zo1EE/83eff72a-745b-400c-81d1-e01cc82410d8.mp3', true, false),

-- Professional/Narration voices
('9BWtsMINqrJLrRacOk9x', 'Aria', 'A middle-aged female with an African-American accent. Calm with a hint of rasp.', 'premade', 'female', 'middle_aged', 'american', 'informative_educational', 'husky', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/9BWtsMINqrJLrRacOk9x/405766b8-1f4e-4d3c-aba1-6f25333823ec.mp3', true, false),

('JBFqnCBsd6RMkjVDRZzb', 'George', 'Warm resonance that instantly captivates listeners.', 'premade', 'male', 'middle_aged', 'british', 'narrative_story', 'mature', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3', true, false),

('bIHbv24MWmeRgasZH58o', 'Will', 'Conversational and laid back.', 'premade', 'male', 'young', 'american', 'conversational', 'chill', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/bIHbv24MWmeRgasZH58o/8caf8f3d-ad29-4980-af41-53f20c72d7a4.mp3', true, false),

('IKne3meq5aSn9XLyUdCD', 'Charlie', 'A young Australian male with a confident and energetic voice.', 'premade', 'male', 'young', 'australian', 'conversational', 'hyped', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3', true, false);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_voices_updated_at BEFORE UPDATE ON public.voices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 