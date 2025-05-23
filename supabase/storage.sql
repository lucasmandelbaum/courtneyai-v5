-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('product-photos', 'Product Photos', false),
  ('generated-reels', 'Generated Reels', false),
  ('audio-assets', 'Audio Assets', false);

-- Set up RLS policies for product-photos bucket
CREATE POLICY "Users can insert their own product photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can select their own product photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own product photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own product photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Set up RLS policies for generated-reels bucket
CREATE POLICY "Users can insert their own generated reels"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generated-reels' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can select their own generated reels"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-reels' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own generated reels"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'generated-reels' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own generated reels"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'generated-reels' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Set up RLS policies for audio-assets bucket
-- Note: Audio assets are shared across users
CREATE POLICY "Users can select from audio assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audio-assets'
  );

-- Only allow admin to insert audio assets
CREATE POLICY "Only admin can insert audio assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audio-assets' AND
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only allow admin to update audio assets
CREATE POLICY "Only admin can update audio assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'audio-assets' AND
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only allow admin to delete audio assets
CREATE POLICY "Only admin can delete audio assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audio-assets' AND
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  ); 