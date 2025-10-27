-- Créer la table pour gérer plusieurs documents par abonnement
CREATE TABLE IF NOT EXISTS public.abonnements_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id UUID NOT NULL REFERENCES public.abonnements_partenaires(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  nom_fichier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_abonnements_documents_abonnement_id 
ON public.abonnements_documents(abonnement_id);

-- Activer RLS
ALTER TABLE public.abonnements_documents ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour abonnements_documents
CREATE POLICY "Authorized roles can view abonnements_documents"
ON public.abonnements_documents FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create abonnements_documents"
ON public.abonnements_documents FOR INSERT
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete abonnements_documents"
ON public.abonnements_documents FOR DELETE
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Migrer les documents existants
INSERT INTO public.abonnements_documents (abonnement_id, document_url, nom_fichier)
SELECT 
  id, 
  document_url, 
  SUBSTRING(document_url FROM '[^/]+$')
FROM public.abonnements_partenaires
WHERE document_url IS NOT NULL;

-- On peut garder la colonne document_url pour compatibilité ou la supprimer
-- Pour l'instant on la garde mais on pourrait la supprimer plus tard