-- Créer une fonction security definer pour vérifier les rôles storage
CREATE OR REPLACE FUNCTION public.can_access_factures_storage()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  );
END;
$$;

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
  AND public.can_access_factures_storage()
);

-- Politique pour visualiser les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can view factures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'factures'
  AND public.can_access_factures_storage()
);

-- Politique pour mettre à jour les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can update factures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'factures'
  AND public.can_access_factures_storage()
)
WITH CHECK (
  bucket_id = 'factures'
  AND public.can_access_factures_storage()
);

-- Politique pour supprimer les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can delete factures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'factures'
  AND public.can_access_factures_storage()
);