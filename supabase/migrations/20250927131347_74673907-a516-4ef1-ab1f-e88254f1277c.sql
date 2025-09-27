-- Créer une table de liaison pour gérer plusieurs référents par rendez-vous
CREATE TABLE public.rdv_referents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdv_id UUID NOT NULL REFERENCES public.rdvs(id) ON DELETE CASCADE,
  referent_id UUID NOT NULL REFERENCES public.referents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rdv_id, referent_id)
);

-- Activer RLS
ALTER TABLE public.rdv_referents ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Authenticated users can view rdv_referents" 
ON public.rdv_referents 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert rdv_referents" 
ON public.rdv_referents 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update rdv_referents" 
ON public.rdv_referents 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete rdv_referents" 
ON public.rdv_referents 
FOR DELETE 
USING (true);

-- Migrer les données existantes de referent_id vers la nouvelle table
INSERT INTO public.rdv_referents (rdv_id, referent_id)
SELECT id, referent_id 
FROM public.rdvs 
WHERE referent_id IS NOT NULL;

-- Optionnel : conserver la colonne referent_id pour compatibilité
-- Si vous voulez la supprimer plus tard : ALTER TABLE public.rdvs DROP COLUMN referent_id;