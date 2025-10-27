-- Ajouter les politiques de storage pour le bucket candidats-files
-- Permettre la lecture publique des fichiers
CREATE POLICY "Lecture publique des fichiers"
ON storage.objects FOR SELECT
USING (bucket_id = 'candidats-files');

-- Permettre l'upload pour les utilisateurs authentifiés
CREATE POLICY "Upload pour utilisateurs authentifiés"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidats-files' 
  AND auth.role() = 'authenticated'
);

-- Permettre la suppression pour les utilisateurs authentifiés
CREATE POLICY "Suppression pour utilisateurs authentifiés"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'candidats-files' 
  AND auth.role() = 'authenticated'
);