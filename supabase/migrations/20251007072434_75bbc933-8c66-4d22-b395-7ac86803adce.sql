-- Corriger les politiques RLS du bucket factures pour éviter l'erreur "cannot coerce"
-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Authorized roles can upload factures" ON storage.objects;
DROP POLICY IF EXISTS "Authorized roles can view factures" ON storage.objects;
DROP POLICY IF EXISTS "Authorized roles can update factures" ON storage.objects;
DROP POLICY IF EXISTS "Authorized roles can delete factures" ON storage.objects;

-- Politique pour l'upload des fichiers dans le bucket factures
CREATE POLICY "Authorized roles can upload factures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'factures' 
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Politique pour visualiser les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can view factures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'factures'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Politique pour mettre à jour les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can update factures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'factures'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
)
WITH CHECK (
  bucket_id = 'factures'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Politique pour supprimer les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can delete factures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'factures'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);