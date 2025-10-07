-- Politiques RLS pour le bucket factures - permettre aux rôles autorisés de gérer les fichiers
-- Supprimer les anciennes politiques si elles existent
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
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

-- Politique pour visualiser les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can view factures"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'factures'
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

-- Politique pour mettre à jour les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can update factures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'factures'
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
)
WITH CHECK (
  bucket_id = 'factures'
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

-- Politique pour supprimer les fichiers dans le bucket factures
CREATE POLICY "Authorized roles can delete factures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'factures'
  AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);