-- Ajouter les colonnes pour les fichiers dans la table candidats
ALTER TABLE public.candidats
ADD COLUMN cv_url TEXT,
ADD COLUMN recommandation_url TEXT;

-- Créer un bucket pour stocker les fichiers des candidats
INSERT INTO storage.buckets (id, name, public) 
VALUES ('candidats-files', 'candidats-files', false);

-- Créer les politiques RLS pour le bucket
CREATE POLICY "Authenticated users can view candidat files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'candidats-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload candidat files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'candidats-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update candidat files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'candidats-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete candidat files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'candidats-files' AND auth.role() = 'authenticated');