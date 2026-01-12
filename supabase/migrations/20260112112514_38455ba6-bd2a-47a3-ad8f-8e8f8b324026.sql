-- Ajouter les colonnes partenaire à declarations_charges_sociales
ALTER TABLE public.declarations_charges_sociales 
ADD COLUMN IF NOT EXISTS partenaire_type TEXT,
ADD COLUMN IF NOT EXISTS partenaire_id UUID;