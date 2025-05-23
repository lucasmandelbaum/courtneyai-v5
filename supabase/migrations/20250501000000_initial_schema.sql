-- Create profiles table that extends the auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  tiktok_username TEXT,
  company TEXT
);

-- Create a trigger to set updated_at on profiles
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TRIGGER products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  alt_text TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TRIGGER photos_updated_at
BEFORE UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TRIGGER scripts_updated_at
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL,
  description TEXT,
  features TEXT[] DEFAULT '{}',
  is_popular BOOLEAN NOT NULL DEFAULT false
);

CREATE TRIGGER templates_updated_at
BEFORE UPDATE ON templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create reels table
CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  storage_path TEXT,
  duration INTEGER,
  title TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_ids UUID[] DEFAULT '{}'
);

CREATE TRIGGER reels_updated_at
BEFORE UPDATE ON reels
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create RLS (Row Level Security) policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Profiles can be created only for the authenticated user
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Products policies
CREATE POLICY "Users can view their own products"
  ON products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
  ON products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
  ON products FOR DELETE
  USING (auth.uid() = user_id);

-- Photos policies
CREATE POLICY "Users can view their own photos"
  ON photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photos"
  ON photos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
  ON photos FOR DELETE
  USING (auth.uid() = user_id);

-- Scripts policies
CREATE POLICY "Users can view their own scripts"
  ON scripts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scripts"
  ON scripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scripts"
  ON scripts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scripts"
  ON scripts FOR DELETE
  USING (auth.uid() = user_id);

-- Templates policies (all users can view templates, but not modify them)
CREATE POLICY "Templates are viewable by all users"
  ON templates FOR SELECT
  USING (true);

-- Reels policies
CREATE POLICY "Users can view their own reels"
  ON reels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reels"
  ON reels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reels"
  ON reels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reels"
  ON reels FOR DELETE
  USING (auth.uid() = user_id);

-- Insert default templates
INSERT INTO templates (name, description, features, is_popular) VALUES
('Basic Template', 'Simple template with voiceover and captions', ARRAY['voiceover', 'captions'], true),
('Music Focus', 'Template with background music emphasis', ARRAY['voiceover', 'captions', 'background_music'], false),
('Professional', 'Full-featured template with transitions and effects', ARRAY['voiceover', 'captions', 'background_music', 'transitions'], false);

-- Create function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 