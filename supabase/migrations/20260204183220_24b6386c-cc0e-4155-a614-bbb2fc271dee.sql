-- Ajouter la colonne activite à abonnements_partenaires
ALTER TABLE public.abonnements_partenaires
ADD COLUMN activite character varying REFERENCES public.param_activite(code);

-- Créer un index pour les performances
CREATE INDEX idx_abonnements_partenaires_activite ON public.abonnements_partenaires(activite);