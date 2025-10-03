-- Supprimer l'ancien check constraint qui limitait les types de prestation
ALTER TABLE public.postes DROP CONSTRAINT IF EXISTS postes_type_prestation_check;