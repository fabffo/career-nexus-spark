-- Ajouter le champ référence client à la table contrats
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS reference_client VARCHAR(100);