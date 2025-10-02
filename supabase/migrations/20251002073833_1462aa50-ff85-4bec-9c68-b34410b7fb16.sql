-- Créer le bucket pour stocker les PDFs de factures
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES ('factures', 'factures', false, ARRAY['application/pdf'], 10485760)
ON CONFLICT (id) DO NOTHING;

-- Créer les policies RLS pour le bucket factures
CREATE POLICY "Authorized roles can upload facture PDFs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'factures' AND 
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
);

CREATE POLICY "Authorized roles can view facture PDFs" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'factures' AND 
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

CREATE POLICY "Authorized roles can update facture PDFs" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'factures' AND 
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
);

CREATE POLICY "Authorized roles can delete facture PDFs" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'factures' AND 
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role])
);