-- Ajouter une colonne actif pour gérer le statut des prestataires
ALTER TABLE public.prestataires 
ADD COLUMN actif boolean NOT NULL DEFAULT true;