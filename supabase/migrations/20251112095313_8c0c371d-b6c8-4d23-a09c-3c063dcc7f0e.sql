-- Create storage bucket for contrats
INSERT INTO storage.buckets (id, name, public)
VALUES ('contrats', 'contrats', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for contrats bucket
CREATE POLICY "Authorized users can view contrats files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'contrats' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'CONTRAT', 'RECRUTEUR')
    )
  )
);

CREATE POLICY "Authorized users can upload contrats files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'contrats' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'CONTRAT')
    )
  )
);

CREATE POLICY "Authorized users can update contrats files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'contrats' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'CONTRAT')
    )
  )
);

CREATE POLICY "Authorized users can delete contrats files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'contrats' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'CONTRAT')
    )
  )
);