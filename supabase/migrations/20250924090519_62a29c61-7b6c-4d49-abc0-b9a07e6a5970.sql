-- Créer la table postes si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.postes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre VARCHAR NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  statut VARCHAR DEFAULT 'OUVERT',
  type_contrat VARCHAR,
  salaire_min DECIMAL,
  salaire_max DECIMAL,
  localisation TEXT,
  competences TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ajouter la colonne poste_id à la table rdvs
ALTER TABLE public.rdvs 
ADD COLUMN IF NOT EXISTS poste_id UUID REFERENCES public.postes(id) ON DELETE SET NULL;

-- Activer RLS sur la table postes
ALTER TABLE public.postes ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS pour postes
CREATE POLICY "Authenticated users can view postes" 
ON public.postes 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert postes" 
ON public.postes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update postes" 
ON public.postes 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete postes" 
ON public.postes 
FOR DELETE 
USING (true);

-- Créer un trigger pour la mise à jour automatique de updated_at
CREATE TRIGGER update_postes_updated_at
BEFORE UPDATE ON public.postes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();