-- Ajouter un champ salarie_id à la table cra pour supporter les salariés de type PRESTATAIRE
ALTER TABLE public.cra
ADD COLUMN salarie_id UUID REFERENCES public.salaries(id);

-- Modifier la contrainte pour que soit prestataire_id, soit salarie_id soit renseigné
ALTER TABLE public.cra
DROP CONSTRAINT IF EXISTS cra_prestataire_id_fkey;

ALTER TABLE public.cra
ALTER COLUMN prestataire_id DROP NOT NULL;

-- Ajouter une contrainte CHECK pour s'assurer qu'au moins l'un des deux est renseigné
ALTER TABLE public.cra
ADD CONSTRAINT cra_intervenant_check CHECK (
  (prestataire_id IS NOT NULL AND salarie_id IS NULL) OR
  (prestataire_id IS NULL AND salarie_id IS NOT NULL)
);

-- Recréer la foreign key pour prestataire_id
ALTER TABLE public.cra
ADD CONSTRAINT cra_prestataire_id_fkey 
FOREIGN KEY (prestataire_id) 
REFERENCES public.prestataires(id);

-- Créer un index sur salarie_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_cra_salarie_id ON public.cra(salarie_id);