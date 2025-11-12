-- Create storage bucket for prestataires files
INSERT INTO storage.buckets (id, name, public)
VALUES ('prestataires-files', 'prestataires-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for prestataires-files bucket
CREATE POLICY "Prestataires files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'prestataires-files');

CREATE POLICY "Authenticated users can upload prestataires files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'prestataires-files' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update prestataires files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'prestataires-files' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete prestataires files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'prestataires-files' 
  AND auth.role() = 'authenticated'
);