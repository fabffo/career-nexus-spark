-- Ajouter la colonne total_mutuelle pour les cotisations complémentaire santé
ALTER TABLE public.bulletins_salaire 
ADD COLUMN IF NOT EXISTS total_mutuelle numeric;