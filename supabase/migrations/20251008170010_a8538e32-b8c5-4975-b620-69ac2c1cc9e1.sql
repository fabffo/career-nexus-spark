-- Ajouter la colonne metier à la table candidats
ALTER TABLE public.candidats 
ADD COLUMN IF NOT EXISTS metier VARCHAR;